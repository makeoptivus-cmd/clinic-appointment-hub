import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
type AppointmentUpdate = Database["public"]["Tables"]["appointments"]["Update"];

interface EditAppointmentDialogProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: AppointmentUpdate) => Promise<boolean>;
}

const statuses = ["New", "Confirmed", "Completed", "Cancelled", "No Show"];
const patientResponses = [
  "Will Come",
  "Will Not Come",
  "Call Not Answered",
  "Asked to Reschedule",
];
const appointmentTypes = ["New Patient", "Follow-up"];

const EditAppointmentDialog = ({
  appointment,
  open,
  onOpenChange,
  onSave,
}: EditAppointmentDialogProps) => {
  const [status, setStatus] = useState("");
  const [patientResponse, setPatientResponse] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [appointmentType, setAppointmentType] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (appointment) {
      setStatus(appointment.status || "New");
      setPatientResponse(appointment.patient_response || "");
      setAdminNote(appointment.admin_note || "");
      setAppointmentType(appointment.appointment_type || "New Patient");
      setAssignedTo(appointment.assigned_to || "");
    }
  }, [appointment]);

  const handleSave = async () => {
    if (!appointment) return;

    setSaving(true);
    const success = await onSave(appointment.id, {
      status,
      patient_response: patientResponse || null,
      admin_note: adminNote || null,
      appointment_type: appointmentType || null,
      assigned_to: assignedTo || null,
    });

    setSaving(false);
    if (success) {
      onOpenChange(false);
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit Appointment</DialogTitle>
          <DialogDescription>
            Update appointment details for{" "}
            <span className="font-semibold text-foreground">
              {appointment.full_name}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-medium">
              Status
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status" className="h-11">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Patient Response */}
          <div className="space-y-2">
            <Label htmlFor="response" className="text-sm font-medium">
              Patient Response
            </Label>
            <Select value={patientResponse} onValueChange={setPatientResponse}>
              <SelectTrigger id="response" className="h-11">
                <SelectValue placeholder="Select response" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {patientResponses.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Appointment Type */}
          <div className="space-y-2">
            <Label htmlFor="type" className="text-sm font-medium">
              Appointment Type
            </Label>
            <Select value={appointmentType} onValueChange={setAppointmentType}>
              <SelectTrigger id="type" className="h-11">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {appointmentTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assigned To */}
          <div className="space-y-2">
            <Label htmlFor="assigned" className="text-sm font-medium">
              Assigned To
            </Label>
            <Input
              id="assigned"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Doctor or staff name"
              className="h-11"
            />
          </div>

          {/* Admin Note */}
          <div className="space-y-2">
            <Label htmlFor="note" className="text-sm font-medium">
              Admin Note
            </Label>
            <Textarea
              id="note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Add any internal notes..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditAppointmentDialog;
