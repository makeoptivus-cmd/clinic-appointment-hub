import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Check, Send, Users, Calendar, Loader2, CheckCheck, ListFilter, Filter } from "lucide-react";

const messageTemplates = {
  session_reminder: 'Hi {name}, this is a reminder for your physio session today. Please don’t miss it!',
  missed_session: 'Hi {name}, you missed your session today. Want to reschedule?',
  common_message: 'Hi {name}, here is a message from our clinic!',
  session_not_completed_10days: 'Hi {name}, it has been 10 days since your appointment. Please complete your session or let us know if you need help.'
};

type Appointment = Database['public']['Tables']['appointments']['Row'];

function WhatsAppMessages() {
  const [selectedType, setSelectedType] = useState('session_reminder');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [sentList, setSentList] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  // For common_message selection/filter
  const [filter, setFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  // Modal for WhatsApp links
  const [showLinksModal, setShowLinksModal] = useState(false);

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      let query = supabase.from('appointments').select('*').eq('message_sent', false);
      if (selectedType === 'session_reminder') {
        // Patients who have a session today (status not Missed or Completed)
        query = query.eq('preferred_date', today).not('status', 'in', '(Missed,Completed,Session Completed)');
      } else if (selectedType === 'missed_session') {
        // Patients who were 'No Show' on the day before the selected date
        const selected = new Date(today);
        selected.setDate(selected.getDate() - 1);
        const prevDay = selected.toISOString().slice(0, 10);
        console.log('Missed Session filter: prevDay =', prevDay);
        query = query.eq('preferred_date', prevDay).eq('status', 'No Show');
      } else if (selectedType === 'session_not_completed_10days') {
        // Patients whose appointment was 10+ days ago and status is NOT 'Session Completed'
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        query = query.lte('preferred_date', tenDaysAgo).not('status', 'eq', 'Session Completed');
      } else if (selectedType === 'common_message') {
        // All patients for a common message
        // No extra filter
      }
      const { data, error } = await query.order('preferred_time', { ascending: true });
      let filtered = data || [];
      if (selectedType === 'missed_session') {
        console.log('Missed Session query result:', filtered);
      }
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
      // Reset selection when type changes
      setSelectedIds([]);
      setSelectAll(false);
    };
    fetchAppointments();
  }, [selectedType, today]);

  const handleSend = async (appointment: Appointment) => {
    const message = messageTemplates[selectedType as keyof typeof messageTemplates].replace('{name}', appointment.full_name);
    window.open(`https://wa.me/${appointment.mobile_number}?text=${encodeURIComponent(message)}`);
  };

  // For common_message: send to selected or all
  const handleSendToSelected = () => {
    const selected = appointments.filter(a => selectedIds.includes(a.id));
    selected.forEach(a => handleSend(a));
  };

  const filteredAppointments = selectedType === 'common_message' && filter
    ? appointments.filter(a =>
        a.full_name.toLowerCase().includes(filter.toLowerCase()) ||
        a.mobile_number.includes(filter)
      )
    : appointments;

  const handleSendToAll = () => {
    // Instead of opening all links, show a modal with all WhatsApp links
    setShowLinksModal(true);
  };


  const handleMarkAsSent = async (appointment: Appointment) => {
    const { error } = await supabase
      .from('appointments')
      .update({ message_sent: true })
      .eq('id', appointment.id);
    if (error) {
      toast.error('Failed to mark as sent');
    } else {
      toast.success('Message marked as sent');
      setAppointments(prev => prev.filter(a => a.id !== appointment.id));
      setSentList(prev => [...prev, appointment]);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl animate-in fade-in space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-emerald-400 bg-clip-text text-transparent">
            WhatsApp Messages
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Send bulk or individual messages to your patients.
          </p>
        </div>
        <div className="p-3 bg-green-50 rounded-full dark:bg-green-900/20">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Message Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="session_reminder">Session Reminder (for today)</SelectItem>
                  <SelectItem value="missed_session">Missed Session</SelectItem>
                  <SelectItem value="session_not_completed_10days">Session Not Completed (10+ days)</SelectItem>
                  <SelectItem value="common_message">Common Message</SelectItem>
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
          </div>

          {selectedType === 'common_message' && (
            <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-2 flex-grow w-full">
                  <Label>Filter Patients</Label>
                  <div className="relative">
                    <ListFilter className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search by name or mobile..."
                      value={filter}
                      onChange={e => setFilter(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto mt-2 sm:mt-0">
                   <Button 
                     variant="outline" 
                     className="flex-1 sm:flex-none"
                     onClick={handleSendToAll}
                     disabled={filteredAppointments.length === 0}
                   >
                     <Users className="w-4 h-4 mr-2" /> Send to All
                   </Button>
                   <Button 
                     className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white"
                     onClick={handleSendToSelected}
                     disabled={selectedIds.length === 0}
                   >
                     <Send className="w-4 h-4 mr-2" /> Send to Selected
                   </Button>
                </div>
              </div>

              {filteredAppointments.length > 0 && (
                <div className="flex items-center space-x-2 pt-2 border-t mt-4 border-slate-200 dark:border-slate-800">
                  <Checkbox 
                    id="selectAll" 
                    checked={selectAll}
                    onCheckedChange={(checked) => {
                      setSelectAll(!!checked);
                      if (checked) {
                        setSelectedIds(filteredAppointments.map(a => a.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                  <Label htmlFor="selectAll" className="text-sm cursor-pointer mt-1">
                    Select All {filteredAppointments.length} patients
                  </Label>
                </div>
              )}

              {/* WhatsApp Links Modal */}
              {showLinksModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                  <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full relative">
                    <button className="absolute top-2 right-2 text-xl" onClick={() => setShowLinksModal(false)}>&times;</button>
                    <h3 className="text-lg font-bold mb-4">WhatsApp Links for All Patients</h3>
                    <ul className="max-h-80 overflow-y-auto mb-4">
                      {filteredAppointments.map(a => {
                        const message = messageTemplates[selectedType].replace('{name}', a.full_name);
                        const waLink = `https://wa.me/${a.mobile_number}?text=${encodeURIComponent(message)}`;
                        return (
                          <li key={a.id} className="mb-2 flex items-center">
                            <span className="mr-2">{a.full_name} ({a.mobile_number})</span>
                            <a href={waLink} target="_blank" rel="noopener noreferrer" className="bg-green-500 text-white px-2 py-1 rounded text-xs">Open</a>
                          </li>
                        );
                      })}
                    </ul>
                    <button className="bg-gray-700 text-white px-4 py-2 rounded w-full" onClick={() => setShowLinksModal(false)}>
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
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
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${
                      selectedIds.includes(appointment.id) ? 'border-green-200 bg-green-50/30 dark:border-green-900/50 dark:bg-green-900/10' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {selectedType === 'common_message' && (
                        <div className="mt-1 flex-shrink-0">
                          <Checkbox
                            checked={selectedIds.includes(appointment.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedIds(prev => [...prev, appointment.id]);
                              } else {
                                setSelectedIds(prev => prev.filter(id => id !== appointment.id));
                                setSelectAll(false);
                              }
                            }}
                          />
                        </div>
                      )}
                      
                      <div className="flex flex-col">
                        <span className="font-semibold text-base">{appointment.full_name}</span>
                        <span className="text-sm text-muted-foreground font-mono mt-0.5">{appointment.mobile_number}</span>
                        <div className="mt-2 sm:hidden">
                          <Badge variant="secondary" className="font-normal">{appointment.status}</Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4 sm:mt-0 basis-full sm:basis-auto">
                      <div className="hidden sm:block">
                        <Badge variant="secondary" className="font-normal">{appointment.status}</Badge>
                      </div>
                      
                      {selectedType !== 'common_message' && (
                        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1 sm:flex-none bg-background hover:bg-slate-100"
                            onClick={() => handleMarkAsSent(appointment)}
                          >
                            <Check className="w-4 h-4 mr-1.5" /> Mark
                          </Button>
                          <Button 
                            className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none shadow-sm"
                            size="sm"
                            onClick={() => handleSend(appointment)}
                          >
                            <MessageCircle className="w-4 h-4 mr-1.5" /> Send
                          </Button>
                        </div>
                      )}
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
                {sentList.map(appointment => (
                  <div key={appointment.id} className="flex items-center gap-3 p-3 text-sm rounded-md bg-green-50/50 dark:bg-green-900/10 border border-green-100/50 dark:border-green-900/30">
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse"></div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate w-full">{appointment.full_name}</span>
                      <span className="text-xs text-muted-foreground">{appointment.mobile_number}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default WhatsAppMessages;
