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
      // Add updated_at timestamp
      const updatesWithTimestamp = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error: updateError } = await supabase
        .from("appointments")
        .update(updatesWithTimestamp)
        .eq("id", id)
        .select();

      if (updateError) {
        // Log full error details for debugging
        console.error("Update error:", updateError, { id, updates: updatesWithTimestamp });
        
        // Check for RLS policy violation
        if (updateError.code === "42501" || updateError.message.includes("policy")) {
          throw new Error("Permission denied. Please make sure you are logged in.");
        }
        throw updateError;
      }
      
      if (!data || data.length === 0) {
        console.warn("No data returned from update - appointment may not exist", { id, updates: updatesWithTimestamp });
        throw new Error("Appointment not found or update failed");
      }
      
      toast.success("Appointment updated successfully");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update appointment";
      // Log the error and context
      console.error("Update failed:", err, { id, updates });
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
