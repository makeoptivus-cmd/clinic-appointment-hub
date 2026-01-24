import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AppointmentFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  dateFilter: string;
  setDateFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
}

const statuses = ["All", "New", "Confirmed", "Completed", "Cancelled", "No Show"];

const AppointmentFilters = ({
  searchQuery,
  setSearchQuery,
  dateFilter,
  setDateFilter,
  statusFilter,
  setStatusFilter,
}: AppointmentFiltersProps) => {
  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter("");
    setStatusFilter("All");
  };

  const hasActiveFilters = searchQuery || dateFilter || statusFilter !== "All";

  return (
    <div className="bg-card rounded-xl p-4 mb-4 shadow-sm border">
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <label className="text-sm font-medium text-muted-foreground mb-1 block lg:hidden">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or mobile number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
        </div>

        {/* Date Filter */}
        <div className="w-full lg:w-48">
          <label className="text-sm font-medium text-muted-foreground mb-1 block lg:hidden">
            Filter by Date
          </label>
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-11"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full lg:w-44">
          <label className="text-sm font-medium text-muted-foreground mb-1 block lg:hidden">
            Filter by Status
          </label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "All" ? "All Statuses" : status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={clearFilters}
            className="h-11 lg:w-auto"
          >
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
};

export default AppointmentFilters;
