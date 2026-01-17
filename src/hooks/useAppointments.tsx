import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
type AppointmentUpdate = Database["public"]["Tables"]["appointments"]["Update"];

export const useAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from("appointments")
        .select("*")
        .order("preferred_date", { ascending: true })
        .order("preferred_time", { ascending: true });

      if (fetchError) throw fetchError;
      
      setAppointments(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch appointments";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAppointment = async (id: string, updates: AppointmentUpdate) => {
    try {
      const { error: updateError } = await supabase
        .from("appointments")
        .update(updates)
        .eq("id", id);

      if (updateError) throw updateError;
      
      toast.success("Appointment updated successfully");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update appointment";
      toast.error(message);
      return false;
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    fetchAppointments();

    const channel = supabase
      .channel("appointments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setAppointments((prev) => [...prev, payload.new as Appointment]);
            toast.info("New appointment received");
          } else if (payload.eventType === "UPDATE") {
            setAppointments((prev) =>
              prev.map((apt) =>
                apt.id === payload.new.id ? (payload.new as Appointment) : apt
              )
            );
          } else if (payload.eventType === "DELETE") {
            setAppointments((prev) =>
              prev.filter((apt) => apt.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAppointments]);

  return {
    appointments,
    loading,
    error,
    updateAppointment,
    refetch: fetchAppointments,
  };
};
