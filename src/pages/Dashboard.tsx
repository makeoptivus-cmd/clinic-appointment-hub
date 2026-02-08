import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAppointments } from "@/hooks/useAppointments";
import DashboardCounters from "@/components/DashboardCounters";
import AppointmentFilters from "@/components/AppointmentFilters";
import AppointmentsTable from "@/components/AppointmentsTable";
import EditAppointmentDialog from "@/components/EditAppointmentDialog";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { appointments, loading, updateAppointment, refetch } = useAppointments();

  // Audio ref for notification sound
  const notificationSound = useRef<HTMLAudioElement | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Edit dialog
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  // Initialize audio and request notification permission
  useEffect(() => {
    notificationSound.current = new Audio('/notification.mp3');
    
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Listen for new appointments in real-time
  useEffect(() => {
    const channel = supabase
      .channel('appointments-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          console.log('🎉 New appointment received:', payload.new);
          
          // Play notification sound
          if (notificationSound.current) {
            notificationSound.current.play()
              .then(() => {
                console.log('✅ Sound played successfully');
              })
              .catch((err) => {
                console.error('❌ Error playing sound:', err);
              });
          }
          
          // Show browser notification
          if (Notification.permission === "granted") {
            const apt = payload.new as Appointment;
            new Notification("New Appointment Booked! 🎉", {
              body: `${apt.full_name} - ${apt.preferred_time}\nReason: ${apt.problem}`,
              icon: '/favicon.ico',
            });
          }
          
          // Refresh the appointments list
          refetch();
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setDialogOpen(true);
  };

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = apt.full_name.toLowerCase().includes(query);
        const matchesMobile = apt.mobile_number.toLowerCase().includes(query);
        if (!matchesName && !matchesMobile) return false;
      }

      if (dateFilter && apt.preferred_date !== dateFilter) {
        return false;
      }

      if (statusFilter !== "All" && apt.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [appointments, searchQuery, dateFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Clinic Appointments
                </h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  {user?.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refetch}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto px-4 py-6">
        <DashboardCounters appointments={appointments} loading={loading} />

        <AppointmentFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {filteredAppointments.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-foreground">
              {appointments.length}
            </span>{" "}
            appointments
          </p>
        </div>

        <AppointmentsTable
          appointments={filteredAppointments}
          loading={loading}
          onEdit={handleEdit}
        />
      </main>

      <EditAppointmentDialog
        appointment={editingAppointment}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={updateAppointment}
      />
    </div>
  );
};

export default Dashboard;