import { CalendarDays, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface Appointment {
  id: string;
  preferred_date: string;
  status: string;
}

interface DashboardCountersProps {
  appointments: Appointment[];
  loading: boolean;
}

const DashboardCounters = ({ appointments, loading }: DashboardCountersProps) => {
  const today = format(new Date(), "yyyy-MM-dd");

  const todayCount = appointments.filter(
    (apt) => apt.preferred_date === today
  ).length;

  const newCount = appointments.filter(
    (apt) => apt.status === "New"
  ).length;

  const confirmedCount = appointments.filter(
    (apt) => apt.status === "Confirmed"
  ).length;

  const counters = [
    {
      label: "Today's Appointments",
      value: todayCount,
      icon: CalendarDays,
      className: "counter-today",
    },
    {
      label: "New Appointments",
      value: newCount,
      icon: AlertCircle,
      className: "counter-new",
    },
    {
      label: "Confirmed",
      value: confirmedCount,
      icon: CheckCircle2,
      className: "counter-confirmed",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl shimmer"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {counters.map((counter) => (
        <div
          key={counter.label}
          className={`counter-card ${counter.className}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">
                {counter.label}
              </p>
              <p className="text-3xl font-bold">{counter.value}</p>
            </div>
            <counter.icon className="w-8 h-8 text-white/40" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardCounters;
