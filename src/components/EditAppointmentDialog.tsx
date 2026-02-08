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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Loader2, Save, CalendarPlus, Upload, X, FileImage, ZoomIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  
  // Follow-up appointment fields
  const [uptoDate, setUptoDate] = useState("");
  const [followUpDates, setFollowUpDates] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Assessment images
  const [assessmentImagePaths, setAssessmentImagePaths] = useState<string[]>([]);
  const [assessmentImageUrls, setAssessmentImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<number | null>(null);

  // Load signed URLs for images
  const loadImageUrls = async (imagePaths: string[]) => {
    if (!imagePaths || imagePaths.length === 0) {
      setAssessmentImageUrls([]);
      return;
    }

    try {
      const urls = await Promise.all(
        imagePaths.map(async (path) => {
          const { data, error } = await supabase.storage
            .from('assessment-images')
            .createSignedUrl(path, 3600);

          if (error) {
            console.error('Error creating signed URL:', error);
            return '';
          }

          return data.signedUrl;
        })
      );

      setAssessmentImageUrls(urls.filter(url => url !== ''));
    } catch (error) {
      console.error('Error loading image URLs:', error);
    }
  };

  useEffect(() => {
    if (appointment) {
      setStatus(appointment.status || "New");
      setPatientResponse(appointment.patient_response || "none");
      setAdminNote(appointment.admin_note || "");
      setAppointmentType(appointment.appointment_type || "New Patient");
      setAssignedTo(appointment.assigned_to || "");
      
      const imagePaths = (appointment as any).assessment_images || [];
      setAssessmentImagePaths(imagePaths);
      loadImageUrls(imagePaths);
      
      setUptoDate("");
      setFollowUpDates([]);
      setSelectedDates([]);
    }
  }, [appointment]);

  const generateDateRange = (endDate: string) => {
    if (!appointment) return;
    
    const dates: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const start = new Date(today);
    start.setDate(start.getDate() + 1);
    
    const end = new Date(endDate);
    
    while (start <= end) {
      dates.push(start.toISOString().split('T')[0]);
      start.setDate(start.getDate() + 1);
    }
    
    setFollowUpDates(dates);
    setSelectedDates(prev => prev.filter(date => dates.includes(date)));
  };

  const handleUptoDateChange = (date: string) => {
    setUptoDate(date);
    if (date) {
      generateDateRange(date);
    } else {
      setFollowUpDates([]);
      setSelectedDates([]);
    }
  };

  const toggleDateSelection = (date: string) => {
    setSelectedDates(prev => 
      prev.includes(date) 
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !appointment) return;

    const files = Array.from(event.target.files);
    setUploading(true);

    try {
      const uploadedPaths: string[] = [];

      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          alert(`${file.name} is not an image file`);
          continue;
        }

        if (file.size > 5 * 1024 * 1024) {
          alert(`${file.name} is too large. Max size is 5MB`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${appointment.id}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('assessment-images')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          alert(`Error uploading ${file.name}: ${uploadError.message}`);
          continue;
        }

        uploadedPaths.push(fileName);
      }

      const newPaths = [...assessmentImagePaths, ...uploadedPaths];
      setAssessmentImagePaths(newPaths);
      
      await loadImageUrls(newPaths);
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Error uploading images');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  // Open delete confirmation dialog
  const confirmDelete = (index: number) => {
    setImageToDelete(index);
    setDeleteDialogOpen(true);
  };

  // Actually delete the image
  const handleRemoveImage = async () => {
    if (imageToDelete === null) return;

    try {
      const filePath = assessmentImagePaths[imageToDelete];

      const { error } = await supabase.storage
        .from('assessment-images')
        .remove([filePath]);

      if (error) {
        console.error('Delete error:', error);
      }

      const newPaths = assessmentImagePaths.filter((_, i) => i !== imageToDelete);
      setAssessmentImagePaths(newPaths);
      
      const newUrls = assessmentImageUrls.filter((_, i) => i !== imageToDelete);
      setAssessmentImageUrls(newUrls);
    } catch (error) {
      console.error('Error removing image:', error);
    } finally {
      setDeleteDialogOpen(false);
      setImageToDelete(null);
    }
  };

  const createFollowUpAppointments = async () => {
    if (!appointment || selectedDates.length === 0) return false;

    try {
      const followUpAppointments = selectedDates.map(date => ({
        full_name: appointment.full_name,
        mobile_number: appointment.mobile_number,
        problem: appointment.problem,
        preferred_date: date,
        preferred_time: appointment.preferred_time,
        age: appointment.age,
        gender: appointment.gender,
        status: 'Confirmed',
        appointment_type: 'Follow-up',
        assigned_to: assignedTo || appointment.assigned_to,
        admin_note: `Follow-up appointment created from ${appointment.preferred_date}`,
      }));

      const { error } = await supabase
        .from('appointments')
        .insert(followUpAppointments);

      if (error) {
        console.error('Error creating follow-up appointments:', error);
        alert('Error creating follow-up appointments: ' + error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  };

  const handleSave = async () => {
    if (!appointment) return;

    setSaving(true);

    const success = await onSave(appointment.id, {
      status,
      patient_response: patientResponse === "none" ? null : patientResponse,
      admin_note: adminNote || null,
      appointment_type: appointmentType || null,
      assigned_to: assignedTo || null,
      assessment_images: assessmentImagePaths.length > 0 ? assessmentImagePaths : null,
    } as any);

    if (success && selectedDates.length > 0) {
      const followUpSuccess = await createFollowUpAppointments();
      if (followUpSuccess) {
        alert(`✅ Updated appointment and created ${selectedDates.length} follow-up appointments!`);
      }
    }

    setSaving(false);
    if (success) {
      onOpenChange(false);
    }
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  if (!appointment) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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
                  <SelectItem value="none">None</SelectItem>
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

            {/* Assessment Images Upload */}
            <div className="pt-2 space-y-3 border-t">
              <div className="flex items-center gap-2">
                <FileImage className="h-5 w-5 text-primary" />
                <Label className="text-sm font-semibold">Assessment Sheet Images</Label>
              </div>

              {/* Upload Button */}
              <div className="space-y-2">
                <Label htmlFor="assessment-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 hover:border-primary/50 hover:bg-primary/5 transition-all text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium text-foreground mb-1">
                      {uploading ? 'Uploading...' : 'Click to upload assessment images'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG up to 5MB (multiple files allowed)
                    </p>
                  </div>
                  <Input
                    id="assessment-upload"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </Label>
              </div>

              {/* Image Gallery */}
              {assessmentImageUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {assessmentImageUrls.map((imageUrl, index) => (
                    <div
                      key={index}
                      className="relative group aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all"
                    >
                      <img
                        src={imageUrl}
                        alt={`Assessment ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Image overlay with actions */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedImage(imageUrl)}
                          className="h-8 w-8 p-0"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => confirmDelete(index)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Image number badge */}
                      <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Follow-up Appointments Section */}
            <div className="pt-2 space-y-3 border-t">
              <div className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-primary" />
                <Label className="text-sm font-semibold">Create Follow-up Appointments</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="uptoDate" className="text-sm font-medium">
                  Appointments Up to Date
                </Label>
                <Input
                  id="uptoDate"
                  type="date"
                  value={uptoDate}
                  onChange={(e) => handleUptoDateChange(e.target.value)}
                  min={getMinDate()}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Select end date to schedule multiple follow-up appointments (only future dates)
                </p>
              </div>

              {followUpDates.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Select Dates
                    </Label>
                    <span className="text-xs font-medium text-primary">
                      {selectedDates.length} selected
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto p-3 bg-muted/30 rounded-lg border">
                    {followUpDates.map((date) => {
                      const dateObj = new Date(date);
                      const isSelected = selectedDates.includes(date);
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => toggleDateSelection(date)}
                          className={`
                            flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all
                            ${isSelected 
                              ? 'border-primary bg-primary text-primary-foreground shadow-md' 
                              : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5'
                            }
                          `}
                        >
                          <span className="text-xs font-medium mb-1">
                            {dateObj.toLocaleDateString('en-IN', { weekday: 'short' })}
                          </span>
                          <span className="text-lg font-bold">
                            {dateObj.getDate()}
                          </span>
                          <span className="text-xs">
                            {dateObj.toLocaleDateString('en-IN', { month: 'short' })}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedDates.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-700 font-medium">
                        ✓ {selectedDates.length} follow-up appointment{selectedDates.length > 1 ? 's' : ''} will be created automatically
                      </p>
                    </div>
                  )}
                </div>
              )}
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
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {selectedDates.length > 0 
                    ? `Save & Create ${selectedDates.length} Follow-up${selectedDates.length > 1 ? 's' : ''}`
                    : 'Save Changes'
                  }
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assessment Image?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setImageToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveImage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview Dialog - Responsive Full Screen */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-4xl max-h-[95vh] p-2 sm:p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg">Assessment Image</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center overflow-auto max-h-[80vh] sm:max-h-[75vh]">
            <img
              src={selectedImage || ''}
              alt="Assessment preview"
              className="w-full h-auto max-h-[75vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditAppointmentDialog;