import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const getStatusClass = () => {
    switch (status) {
      case "New":
        return "status-new";
      case "Confirmed":
        return "status-confirmed";
      case "Completed":
        return "status-completed";
      case "Cancelled":
        return "status-cancelled";
      case "No Show":
        return "status-no-show";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border",
        getStatusClass(),
        className
      )}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
