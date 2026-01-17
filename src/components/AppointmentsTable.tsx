import { format, isToday, parseISO } from "date-fns";
import { Phone, Edit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "./StatusBadge";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

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
                <td className="p-4">
                  <div>
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
              <div>
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
    </div>
  );
};

export default AppointmentsTable;
