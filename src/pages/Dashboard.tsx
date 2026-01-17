import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAppointments } from "@/hooks/useAppointments";
import DashboardCounters from "@/components/DashboardCounters";
import AppointmentFilters from "@/components/AppointmentFilters";
import AppointmentsTable from "@/components/AppointmentsTable";
import EditAppointmentDialog from "@/components/EditAppointmentDialog";
import type { Database } from "@/integrations/supabase/types";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { appointments, loading, updateAppointment, refetch } = useAppointments();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Edit dialog
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);

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
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = apt.full_name.toLowerCase().includes(query);
        const matchesMobile = apt.mobile_number.toLowerCase().includes(query);
        if (!matchesName && !matchesMobile) return false;
      }

      // Date filter
      if (dateFilter && apt.preferred_date !== dateFilter) {
        return false;
      }

      // Status filter
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
        {/* Counters */}
        <DashboardCounters appointments={appointments} loading={loading} />

        {/* Filters */}
        <AppointmentFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />

        {/* Total Count */}
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

        {/* Table */}
        <AppointmentsTable
          appointments={filteredAppointments}
          loading={loading}
          onEdit={handleEdit}
        />
      </main>

      {/* Edit Dialog */}
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
