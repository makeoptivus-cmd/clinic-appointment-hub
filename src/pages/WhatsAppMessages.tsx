import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import AppMenuBar from '@/components/AppMenuBar';
import { createTimelineEvent, parseTimeline } from "@/lib/appointmentTimeline";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Check, Send, Users, Calendar, Loader2, CheckCheck, ListFilter, Filter, AlertCircle } from "lucide-react";

const messageTemplates = {
  session_reminder: "Hi {name}, this is a reminder for your physio session today. Please don't miss it!",
  missed_session: "Hi {name}, you missed your session today. Want to reschedule? Book an appointment or call: https://www.jnphysio.in/",
};

type Appointment = Database['public']['Tables']['appointments']['Row'];
type DeliveryStatus = "pending" | "sent" | "delivered" | "failed";
type DeliveryLog = {
  id: string;
  full_name: string;
  mobile_number: string;
  status: DeliveryStatus;
  at: string;
};

const DELIVERY_STATUS_NOTE_REGEX = /\[WA_STATUS:(pending|sent|delivered|failed)\]/gi;

const isDeliveryStatus = (value: unknown): value is DeliveryStatus =>
  value === "pending" || value === "sent" || value === "delivered" || value === "failed";

const getDeliveryStatusFromAdminNote = (note: string | null): DeliveryStatus | null => {
  if (!note) return null;
  const matches = [...note.matchAll(DELIVERY_STATUS_NOTE_REGEX)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1]?.[1]?.toLowerCase();
  return isDeliveryStatus(last) ? last : null;
};

const withDeliveryStatusMarker = (note: string | null, status: DeliveryStatus) => {
  const stripped = (note || "").replace(DELIVERY_STATUS_NOTE_REGEX, "").trim();
  const marker = `[WA_STATUS:${status}]`;
  return stripped ? `${stripped} ${marker}` : marker;
};

const getDeliveryStatus = (appointment: Appointment): DeliveryStatus => {
  const raw = (appointment as Appointment & { whatsapp_delivery_status?: unknown })
    .whatsapp_delivery_status;
  if (isDeliveryStatus(raw)) return raw;
  const noteStatus = getDeliveryStatusFromAdminNote(appointment.admin_note);
  if (noteStatus) return noteStatus;
  return appointment.message_sent ? "sent" : "pending";
};

type ApiError = {
  code?: string;
  message?: string;
  details?: string | null;
};

const isMissingColumnError = (error: ApiError | null) => {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  const message = (error.message || "").toLowerCase();
  return (
    message.includes("column") &&
    (message.includes("whatsapp_delivery_status") ||
      message.includes("whatsapp_delivery_updated_at") ||
      message.includes("timeline"))
  );
};

const isUnsupportedDeliveryStatusError = (error: ApiError | null) => {
  if (!error) return false;
  if (error.code === "23514") return true;
  const text = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  return (
    text.includes("appointments_whatsapp_delivery_status_check") ||
    (text.includes("check constraint") && text.includes("whatsapp_delivery_status"))
  );
};

function WhatsAppMessages() {
  const [selectedType, setSelectedType] = useState('session_reminder');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [sentList, setSentList] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | DeliveryStatus>("all");
  useEffect(() => {
    setDeliveryFilter("pending");
  }, [selectedType]);

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      let query = supabase.from('appointments').select('*');

      if (deliveryFilter === "pending") {
        query = query.eq("message_sent", false);
      } else if (deliveryFilter !== "all") {
        query = query.eq("message_sent", true);
      }

      if (selectedType === "session_reminder") {
        // Patients who have a session today and are not closed/cancelled.
        query = query
          .eq("preferred_date", today)
          .not("status", "in", "(Cancelled,No Show,Missed,Completed,Session Completed)");
      } else if (selectedType === "missed_session") {
        // Patients who were No Show / Missed on the day before selected date.
        const selected = new Date(today);
        selected.setDate(selected.getDate() - 1);
        const prevDay = selected.toISOString().slice(0, 10);
        query = query.eq("preferred_date", prevDay).in("status", ["No Show", "Missed"]);
      }
      const { data, error } = await query
        .order('preferred_date', { ascending: false })
        .order('preferred_time', { ascending: false });
      const filtered = data || [];
      // Deduplicate by mobile_number so each person appears only once
      const uniqueByMobile: Record<string, Appointment> = {};
      filtered.forEach(a => {
        if (!uniqueByMobile[a.mobile_number]) {
          uniqueByMobile[a.mobile_number] = a;
        }
      });
      setAppointments(Object.values(uniqueByMobile));
      if (error) {
        toast.error('Failed to fetch appointments');
      }
      setLoading(false);
    };
    fetchAppointments();
  }, [selectedType, today, deliveryFilter]);

  const updateDeliveryStatus = async (appointment: Appointment, status: DeliveryStatus) => {
    const timeline = parseTimeline((appointment as Appointment & { timeline?: unknown }).timeline as never);
    const timelineEntry = createTimelineEvent(
      "whatsapp",
      `WhatsApp delivery status marked as ${status}`
    );
    const updatedAt = new Date().toISOString();
    const saveStatusWithNoteFallback = async () => {
      const fallback = await supabase
        .from("appointments")
        .update({
          message_sent: status !== "pending",
          admin_note: withDeliveryStatusMarker(appointment.admin_note, status),
        })
        .eq("id", appointment.id)
        .select()
        .single();

      if (fallback.error) {
        toast.error("Failed to update WhatsApp status");
        console.error("WhatsApp status note fallback failed", fallback.error);
        return null;
      }

      return {
        ...(fallback.data as Appointment),
        whatsapp_delivery_status: status,
        whatsapp_delivery_updated_at: updatedAt,
      } as Appointment;
    };

    const { data, error } = await supabase
      .from('appointments')
      .update({
        message_sent: status !== "pending",
        whatsapp_delivery_status: status,
        whatsapp_delivery_updated_at: updatedAt,
        timeline: [...timeline, timelineEntry],
      })
      .eq('id', appointment.id)
      .select()
      .single();

    let updatedRow: Appointment | null = null;

    if (!error) {
      updatedRow = data as Appointment;
      toast.success(`WhatsApp status updated to ${status}`);
    } else if (isMissingColumnError(error as ApiError)) {
      updatedRow = await saveStatusWithNoteFallback();
      if (!updatedRow) return;
      toast.success(`WhatsApp status updated to ${status} (compatibility mode)`);
    } else if (isUnsupportedDeliveryStatusError(error as ApiError)) {
      updatedRow = await saveStatusWithNoteFallback();
      if (!updatedRow) return;
      toast.success(`WhatsApp status updated to ${status} (compatibility mode)`);
    } else {
      toast.error("Failed to update WhatsApp status");
      console.error("WhatsApp status update failed", error);
      return;
    }

    setAppointments((prev) =>
      prev.map((item) => (item.id === appointment.id ? updatedRow! : item))
    );
    setSentList((prev) => [
      {
        id: appointment.id,
        full_name: appointment.full_name,
        mobile_number: appointment.mobile_number,
        status,
        at: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 15));
  };

  const handleSend = async (appointment: Appointment) => {
    const message = messageTemplates[selectedType as keyof typeof messageTemplates].replace('{name}', appointment.full_name);
    window.open(`https://wa.me/${appointment.mobile_number}?text=${encodeURIComponent(message)}`);
    await updateDeliveryStatus(appointment, "sent");
  };

  const filteredAppointments = appointments.filter((appointment) => {
    const status = getDeliveryStatus(appointment);
    return deliveryFilter === "all" ? true : status === deliveryFilter;
  });

  return (
    <div className="min-h-screen bg-background">
      <AppMenuBar />
      <div className="container mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 animate-in fade-in space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-emerald-400 bg-clip-text text-transparent">
              WhatsApp Messages
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Send bulk or individual messages to your patients.
            </p>
          </div>
          <div className="hidden sm:block p-3 bg-green-50 rounded-full dark:bg-green-900/20">
            <MessageCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <Card className="border-green-100 shadow-sm dark:border-green-900/30">
          <CardHeader className="bg-green-50/50 dark:bg-green-900/10 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" /> Message Configuration
            </CardTitle>
            <CardDescription>Select the type of message and date to filter patients</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Message Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="session_reminder">Session Reminder (for today)</SelectItem>
                    <SelectItem value="missed_session">Missed Session</SelectItem>

                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={today}
                    onChange={e => setToday(e.target.value)}
                    className="pl-9 w-full"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Delivery Status</Label>
                <Select value={deliveryFilter} onValueChange={(value) => setDeliveryFilter(value as "all" | DeliveryStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>


          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Patients List */}
          <Card className="lg:col-span-2 shadow-sm border-slate-200/60 h-fit">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
              <div className="space-y-1">
                <CardTitle className="text-lg">Patients List</CardTitle>
                <CardDescription>
                  {filteredAppointments.length} {filteredAppointments.length === 1 ? 'patient' : 'patients'} found
                </CardDescription>
              </div>
              <Users className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-4 px-2 sm:px-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-4 text-green-600" />
                  <p>Loading patients...</p>
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium">No patients found</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mt-1">
                    There are no patients to message for the selected type and date.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAppointments.map(appointment => (
                    <div
                      key={appointment.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-border"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-base">{appointment.full_name}</span>
                          <span className="text-sm text-muted-foreground font-mono mt-0.5">{appointment.mobile_number}</span>
                          <div className="mt-2 sm:hidden flex items-center gap-2">
                            <Badge variant="secondary" className="font-normal">{appointment.status}</Badge>
                            <Badge variant="outline" className="font-normal capitalize">
                              WA: {getDeliveryStatus(appointment)}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4 sm:mt-0 basis-full sm:basis-auto">
                        <div className="hidden sm:flex sm:items-center sm:gap-2">
                          <Badge variant="secondary" className="font-normal">{appointment.status}</Badge>
                          <Badge variant="outline" className="font-normal capitalize">
                            WA: {getDeliveryStatus(appointment)}
                          </Badge>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-none bg-background hover:bg-slate-100"
                            onClick={() => void updateDeliveryStatus(appointment, "delivered")}
                          >
                            <Check className="w-4 h-4 mr-1.5" /> Delivered
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            onClick={() => void updateDeliveryStatus(appointment, "failed")}
                          >
                            <AlertCircle className="w-4 h-4 mr-1.5" /> Failed
                          </Button>
                          <Button
                            className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none shadow-sm"
                            size="sm"
                            onClick={() => void handleSend(appointment)}
                          >
                            <MessageCircle className="w-4 h-4 mr-1.5" /> Send
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Column - Sent List */}
          <Card className="shadow-sm border-slate-200/60 h-fit">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/10 pb-3 border-b">
              <CardTitle className="text-md flex items-center">
                <CheckCheck className="w-4 h-4 mr-2 text-green-600" /> Sent Recently
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {sentList.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground flex flex-col items-center">
                  <CheckCheck className="w-8 h-8 text-slate-200 dark:text-slate-800 mb-2" />
                  <p>No messages marked as sent in this session.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sentList.map((item) => (
                    <div key={`${item.id}-${item.at}`} className="flex items-center gap-3 p-3 text-sm rounded-md bg-green-50/50 dark:bg-green-900/10 border border-green-100/50 dark:border-green-900/30">
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse"></div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate w-full">{item.full_name}</span>
                        <span className="text-xs text-muted-foreground">{item.mobile_number}</span>
                        <span className="text-xs capitalize text-muted-foreground">
                          {item.status} at {new Date(item.at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppMessages;

