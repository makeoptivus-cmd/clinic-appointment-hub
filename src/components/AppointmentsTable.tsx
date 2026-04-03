import { useState, useEffect } from "react";
import { format, isToday, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Edit2, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "./StatusBadge";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];

interface AppointmentsTableProps {
  appointments: Appointment[];
  loading: boolean;
  onEdit: (appointment: Appointment) => void;
}

const AppointmentsTable = ({
  appointments,
  loading,
  onEdit,
}: AppointmentsTableProps) => {
  const [selectedNote, setSelectedNote] = useState<{ name: string; note: string } | null>(null);
  const [masterProfilePhone, setMasterProfilePhone] = useState<string | null>(null);
  const [masterProfileData, setMasterProfileData] = useState<Appointment[] | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (!masterProfilePhone) {
      setMasterProfileData(null);
      return;
    }
    const fetchProfile = async () => {
      setLoadingProfile(true);
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("mobile_number", masterProfilePhone)
        .order("preferred_date", { ascending: false });
      setMasterProfileData(data || []);
      setLoadingProfile(false);
    };
    fetchProfile();
  }, [masterProfilePhone]);

  const handlePatientClick = (e: React.MouseEvent, appointment: Appointment) => {
    if (e.detail === 3) {
      setMasterProfilePhone(appointment.mobile_number);
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return "-";
    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, "h:mm a");
  };

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), "MMM d, yyyy");
  };

  const isAppointmentToday = (dateStr: string) => {
    return isToday(parseISO(dateStr));
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border shadow-sm p-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading appointments...</span>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="bg-card rounded-xl border shadow-sm p-12 text-center">
        <p className="text-muted-foreground text-lg">No appointments found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Try adjusting your filters or check back later
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto custom-scrollbar">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left p-4 font-semibold text-sm">Patient</th>
              <th className="text-left p-4 font-semibold text-sm">Mobile</th>
              <th className="text-left p-4 font-semibold text-sm">Date</th>
              <th className="text-left p-4 font-semibold text-sm">Time</th>
              <th className="text-left p-4 font-semibold text-sm">Problem</th>
              <th className="text-left p-4 font-semibold text-sm">Status</th>
              <th className="text-left p-4 font-semibold text-sm">Response</th>
              <th className="text-left p-4 font-semibold text-sm">Admin Note</th>
              <th className="text-left p-4 font-semibold text-sm">Type</th>
              <th className="text-left p-4 font-semibold text-sm">Assigned To</th>
              <th className="text-left p-4 font-semibold text-sm">Updated At</th>
              <th className="text-center p-4 font-semibold text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appointment) => (
              <tr
                key={appointment.id}
                className={cn(
                  "border-b last:border-b-0 hover:bg-muted/30 transition-colors",
                  isAppointmentToday(appointment.preferred_date) && "today-row"
                )}
              >
                <td className="p-4" onClick={(e) => handlePatientClick(e, appointment)}>
                  <div className="cursor-pointer select-none">
                    <p className="font-medium">{appointment.full_name}</p>
                    {appointment.age && appointment.gender && (
                      <p className="text-sm text-muted-foreground">
                        {appointment.age} yrs, {appointment.gender}
                      </p>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <a
                    href={`tel:${appointment.mobile_number}`}
                    className="phone-link inline-flex items-center gap-1"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {appointment.mobile_number}
                  </a>
                </td>
                <td className="p-4">
                  <span
                    className={cn(
                      isAppointmentToday(appointment.preferred_date) &&
                        "text-primary font-semibold"
                    )}
                  >
                    {formatDate(appointment.preferred_date)}
                  </span>
                </td>
                <td className="p-4 text-muted-foreground">
                  {formatTime(appointment.preferred_time)}
                </td>
                <td className="p-4 max-w-[200px]">
                  <p className="truncate text-sm">{appointment.problem || "-"}</p>
                </td>
                <td className="p-4">
                  <StatusBadge status={appointment.status} />
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {appointment.patient_response || "-"}
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {appointment.admin_note ? (
                    <button
                      onClick={() => setSelectedNote({ name: appointment.full_name, note: appointment.admin_note! })}
                      className="flex items-center gap-1 text-left hover:text-primary transition-colors cursor-pointer max-w-[150px]"
                    >
                      <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{appointment.admin_note}</span>
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {appointment.appointment_type || "-"}
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {appointment.assigned_to || "-"}
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {appointment.updated_at ? formatDate(appointment.updated_at) : "-"}
                </td>
                <td className="p-4 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(appointment)}
                    className="hover:bg-primary/10 hover:text-primary"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden divide-y">
        {appointments.map((appointment) => (
          <div
            key={appointment.id}
            className={cn(
              "p-4",
              isAppointmentToday(appointment.preferred_date) && "today-row"
            )}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="cursor-pointer select-none" onClick={(e) => handlePatientClick(e, appointment)}>
                <p className="font-semibold text-lg">{appointment.full_name}</p>
                {appointment.age && appointment.gender && (
                  <p className="text-sm text-muted-foreground">
                    {appointment.age} yrs, {appointment.gender}
                  </p>
                )}
              </div>
              <StatusBadge status={appointment.status} />
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`tel:${appointment.mobile_number}`}
                  className="phone-link"
                >
                  {appointment.mobile_number}
                </a>
              </div>

              <p>
                <span className="text-muted-foreground">Date: </span>
                <span
                  className={cn(
                    "text-foreground",
                    isAppointmentToday(appointment.preferred_date) &&
                      "text-primary font-semibold"
                  )}
                >
                  {formatDate(appointment.preferred_date)}
                </span>
                {appointment.preferred_time && (
                  <span className="text-muted-foreground">
                    {" "}
                    at {formatTime(appointment.preferred_time)}
                  </span>
                )}
              </p>

              {appointment.problem && (
                <p>
                  <span className="text-muted-foreground">Problem: </span>
                  {appointment.problem}
                </p>
              )}
              {appointment.patient_response && (
                <p>
                  <span className="text-muted-foreground">Response: </span>
                  {appointment.patient_response}
                </p>
              )}
              {appointment.admin_note && (
                <button
                  onClick={() => setSelectedNote({ name: appointment.full_name, note: appointment.admin_note! })}
                  className="flex items-center gap-1 text-left hover:text-primary transition-colors cursor-pointer w-full"
                >
                  <span className="text-muted-foreground">Admin Note: </span>
                  <span className="truncate flex-1">{appointment.admin_note}</span>
                  <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                </button>
              )}
              {appointment.appointment_type && (
                <p>
                  <span className="text-muted-foreground">Type: </span>
                  {appointment.appointment_type}
                </p>
              )}
              {appointment.assigned_to && (
                <p>
                  <span className="text-muted-foreground">Assigned To: </span>
                  {appointment.assigned_to}
                </p>
              )}
              {appointment.updated_at && (
                <p>
                  <span className="text-muted-foreground">Updated At: </span>
                  {formatDate(appointment.updated_at)}
                </p>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(appointment)}
              className="w-full mt-4"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Appointment
            </Button>
          </div>
        ))}
      </div>

      {/* Admin Note Modal */}
      <Dialog open={!!selectedNote} onOpenChange={(open) => !open && setSelectedNote(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Admin Note
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2 flex-1 overflow-hidden">
            <div className="text-sm text-muted-foreground">
              Patient: <span className="font-medium text-foreground">{selectedNote?.name}</span>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 border max-h-[50vh] overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                {selectedNote?.note}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Master Profile Modal */}
      <Dialog open={!!masterProfilePhone} onOpenChange={(open) => !open && setMasterProfilePhone(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl pb-2 border-b">
              Patient Master Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {loadingProfile ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : masterProfileData && masterProfileData.length > 0 ? (
              <>
                <div className="bg-muted/30 p-4 rounded-lg border">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Full Name</p>
                      <p className="font-semibold text-lg">{masterProfileData[0].full_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Mobile Number</p>
                      <p className="font-medium">{masterProfileData[0].mobile_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Age & Gender</p>
                      <p className="font-medium">
                        {masterProfileData[0].age || "-"} yrs, {masterProfileData[0].gender || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Visits</p>
                      <p className="font-medium">{masterProfileData.length}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm border-b pb-2">Visit History</h4>
                  <div className="space-y-3">
                    {masterProfileData.map((visit) => (
                      <div key={visit.id} className="p-3 border rounded-md text-sm space-y-2 bg-card">
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-primary">
                            {formatDate(visit.preferred_date)}
                          </span>
                          <StatusBadge status={visit.status} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <p><span className="text-muted-foreground">Type:</span> {visit.appointment_type || "-"}</p>
                          <p><span className="text-muted-foreground">Assigned:</span> {visit.assigned_to || "-"}</p>
                          <p className="col-span-2"><span className="text-muted-foreground">Problem:</span> {visit.problem || "-"}</p>
                          {visit.admin_note && (
                            <p className="col-span-2"><span className="text-muted-foreground">Note:</span> {visit.admin_note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground">No records found.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppointmentsTable;
