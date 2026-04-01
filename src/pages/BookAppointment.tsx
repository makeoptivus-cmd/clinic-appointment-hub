import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { CalendarClock, History, Loader2, Phone, UserPlus } from "lucide-react";
import { createRow, readRows } from "@/lib/supabaseCrud";
import { createTimelineEvent } from "@/lib/appointmentTimeline";
import type { Database } from "@/integrations/supabase/types";
import AppMenuBar from "@/components/AppMenuBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AppointmentInsert = Database["public"]["Tables"]["appointments"]["Insert"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

type NewPatientForm = {
  fullName: string;
  mobileNumber: string;
  age: string;
  gender: string;
  problem: string;
  preferredDate: string;
  preferredTime: string;
};

type BookingMode = "existing" | "new";

const BOOKING_WINDOW_DAYS = 5;
const SLOT_INTERVAL_MINUTES = 15;
const MOBILE_CHECK_DEBOUNCE_MS = 180;
const PHYSIO_PROBLEM_OPTIONS = [
  "Neck Pain",
  "Back Pain",
  "Shoulder Pain",
  "Knee Pain",
  "Ankle Pain",
  "Sports Injury",
  "Post-Surgery Rehab",
  "Slip Disc / Sciatica",
  "Arthritis / Joint Stiffness",
  "Stroke / Neuro Rehab",
  "Posture Correction",
  "Other",
] as const;

type TimeSession = {
  key: "morning" | "evening";
  icon: string;
  label: string;
  start: string;
  end: string;
};

type TimeSessionOptions = TimeSession & {
  times: string[];
};

type ExistingPatientSummary = Pick<
  AppointmentRow,
  "id" | "full_name" | "mobile_number" | "preferred_date"
>;

const BASE_SESSIONS: TimeSession[] = [
  { key: "morning", icon: "[AM]", label: "Morning", start: "10:00", end: "13:00" },
  { key: "evening", icon: "[PM]", label: "Evening", start: "17:00", end: "22:00" },
];

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const toTimeValue = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const formatDisplayTime = (time: string) => dayjs(`2000-01-01T${time}`).format("h:mm A");

const formatSessionLabel = (session: TimeSession) =>
  `${session.icon} ${session.label} (${formatDisplayTime(session.start)} - ${formatDisplayTime(
    session.end
  )})`;

const getClinicSessions = (date: dayjs.Dayjs) => {
  if (date.day() === 0) {
    return [BASE_SESSIONS[0]];
  }
  return BASE_SESSIONS;
};

const getSessionTimeOptions = (date: dayjs.Dayjs, referenceNow: dayjs.Dayjs): TimeSessionOptions[] => {
  const isToday = date.isSame(referenceNow, "day");
  const currentMinutes = referenceNow.hour() * 60 + referenceNow.minute();

  return getClinicSessions(date)
    .map((session) => {
      const times: string[] = [];
      const startMinutes = toMinutes(session.start);
      const endMinutes = toMinutes(session.end);

      for (let minute = startMinutes; minute < endMinutes; minute += SLOT_INTERVAL_MINUTES) {
        if (!isToday || minute >= currentMinutes) {
          times.push(toTimeValue(minute));
        }
      }

      return { ...session, times };
    })
    .filter((session) => session.times.length > 0);
};

const getDefaultTime = (date: dayjs.Dayjs, referenceNow: dayjs.Dayjs) => {
  const sessions = getSessionTimeOptions(date, referenceNow);
  return sessions[0]?.times[0] ?? "";
};

const isValidMobile = (mobile: string) => /^[0-9]{10}$/.test(mobile.trim());

const getAvailableDates = (startDate: dayjs.Dayjs, daysAhead: number, referenceNow: dayjs.Dayjs) =>
  Array.from({ length: daysAhead + 1 }, (_, index) => {
    const date = startDate.add(index, "day");
    const sessions = getSessionTimeOptions(date, referenceNow);
    const hasTimes = sessions.some((session) => session.times.length > 0);
    return {
      value: date.format("YYYY-MM-DD"),
      hasTimes,
      label:
        index === 0
          ? `Today (${date.format("ddd, DD MMM")})`
          : index === 1
            ? `Tomorrow (${date.format("ddd, DD MMM")})`
            : date.format("ddd, DD MMM"),
    };
  }).filter((date) => date.hasTimes);

const getSafeSlotTime = (dateValue: string, selectedTime: string, referenceNow: dayjs.Dayjs) => {
  const sessions = getSessionTimeOptions(dayjs(dateValue), referenceNow);
  const allTimes = sessions.flatMap((session) => session.times);
  if (allTimes.includes(selectedTime)) {
    return selectedTime;
  }
  return allTimes[0] ?? "";
};

const BookAppointment = () => {
  const navigate = useNavigate();
  const referenceNow = useMemo(() => dayjs(), []);
  const today = referenceNow.format("YYYY-MM-DD");
  const availableDates = useMemo(
    () => getAvailableDates(dayjs(today), BOOKING_WINDOW_DAYS, referenceNow),
    [today, referenceNow]
  );
  const defaultDate = availableDates[0]?.value ?? today;
  const defaultTime = getDefaultTime(dayjs(defaultDate), referenceNow);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(
    null
  );
  const [bookingMode, setBookingMode] = useState<BookingMode>("existing");

  const [searchNumber, setSearchNumber] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [latestPatient, setLatestPatient] = useState<AppointmentRow | null>(null);
  const [checkingNewMobile, setCheckingNewMobile] = useState(false);
  const [existingNewPatient, setExistingNewPatient] = useState<ExistingPatientSummary | null>(
    null
  );
  const [newMobileError, setNewMobileError] = useState<string | null>(null);
  const mobileCheckCacheRef = useRef<Record<string, ExistingPatientSummary | null>>({});
  const mobileCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileCheckRequestIdRef = useRef(0);

  const [quickDate, setQuickDate] = useState(defaultDate);
  const [quickTime, setQuickTime] = useState(defaultTime);
  const [newPatient, setNewPatient] = useState<NewPatientForm>({
    fullName: "",
    mobileNumber: "",
    age: "",
    gender: "",
    problem: "",
    preferredDate: defaultDate,
    preferredTime: defaultTime,
  });

  const quickTimeSessions = useMemo(
    () => getSessionTimeOptions(dayjs(quickDate), referenceNow),
    [quickDate, referenceNow]
  );
  const newPatientTimeSessions = useMemo(
    () => getSessionTimeOptions(dayjs(newPatient.preferredDate), referenceNow),
    [newPatient.preferredDate, referenceNow]
  );

  const clearMessages = () => {
    setFeedback(null);
    setSearchError(null);
    setSearchNotice(null);
  };

  const handleModeChange = (mode: BookingMode) => {
    setBookingMode(mode);
    clearMessages();
  };

  useEffect(() => {
    return () => {
      if (mobileCheckTimerRef.current) {
        clearTimeout(mobileCheckTimerRef.current);
      }
      mobileCheckRequestIdRef.current += 1;
    };
  }, []);

  const updateNewPatient = (field: keyof NewPatientForm, value: string) => {
    setNewPatient((prev) => ({ ...prev, [field]: value }));
  };

  const handleQuickDateChange = (dateValue: string) => {
    setQuickDate(dateValue);
    setQuickTime((prevTime) => getSafeSlotTime(dateValue, prevTime, referenceNow));
  };

  const handleNewPatientDateChange = (dateValue: string) => {
    setNewPatient((prev) => ({
      ...prev,
      preferredDate: dateValue,
      preferredTime: getSafeSlotTime(dateValue, prev.preferredTime, referenceNow),
    }));
  };

  const saveAppointment = async (payload: AppointmentInsert) => {
    setLoading(true);
    setFeedback(null);
    try {
      // Dynamically detect valid schema columns to safely drop fields from pending migrations
      const { data } = await readRows<AppointmentRow>("appointments", { limit: 1 });
      let finalPayload = payload;
      
      if (data && data.length > 0) {
        const validKeys = Object.keys(data[0]);
        const safePayload: any = {};
        Object.keys(payload).forEach(key => {
          if (validKeys.includes(key)) {
            safePayload[key] = (payload as any)[key];
          }
        });
        finalPayload = safePayload as AppointmentInsert;
      }

      const { error } = await createRow<AppointmentInsert>("appointments", finalPayload);
      if (error) {
        setFeedback({ type: "error", text: error.message || "Failed to create appointment." });
        return false;
      }
      setFeedback({ type: "success", text: "Appointment booked successfully." });
      return true;
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to create appointment.",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getLatestPatientByMobile = async (mobile: string) => {
    const { data, error } = await readRows<AppointmentRow>("appointments", {
      eq: { mobile_number: mobile.trim() },
      order: { column: "updated_at", ascending: false },
      limit: 1,
    });

    if (error) {
      throw new Error(error.message || "Failed to fetch patient data.");
    }

    return data?.[0] ?? null;
  };

  const getExistingPatientSummaryByMobile = async (mobile: string) => {
    const { data, error } = await readRows<ExistingPatientSummary>("appointments", {
      select: "id, full_name, mobile_number, preferred_date",
      eq: { mobile_number: mobile.trim() },
      order: { column: "updated_at", ascending: false },
      limit: 1,
    });

    if (error) {
      throw new Error(error.message || "Failed to fetch patient data.");
    }

    return data?.[0] ?? null;
  };

  const clearScheduledMobileCheck = () => {
    if (mobileCheckTimerRef.current) {
      clearTimeout(mobileCheckTimerRef.current);
      mobileCheckTimerRef.current = null;
    }
  };

  const checkNewMobile = async (mobile: string, forceNetwork = false) => {
    const trimmedMobile = mobile.trim();
    setNewMobileError(null);

    if (!trimmedMobile || !isValidMobile(trimmedMobile)) {
      clearScheduledMobileCheck();
      mobileCheckRequestIdRef.current += 1;
      setCheckingNewMobile(false);
      setExistingNewPatient(null);
      return null;
    }

    if (!forceNetwork && Object.prototype.hasOwnProperty.call(mobileCheckCacheRef.current, trimmedMobile)) {
      setCheckingNewMobile(false);
      const cachedPatient = mobileCheckCacheRef.current[trimmedMobile];
      setExistingNewPatient(cachedPatient);
      return cachedPatient;
    }

    const requestId = ++mobileCheckRequestIdRef.current;
    setCheckingNewMobile(true);
    try {
      const existingPatient = await getExistingPatientSummaryByMobile(trimmedMobile);
      if (requestId !== mobileCheckRequestIdRef.current) {
        return null;
      }
      mobileCheckCacheRef.current[trimmedMobile] = existingPatient;
      setExistingNewPatient(existingPatient);
      return existingPatient;
    } catch (err) {
      if (requestId !== mobileCheckRequestIdRef.current) {
        return null;
      }
      const message = err instanceof Error ? err.message : "Failed to verify mobile number.";
      setNewMobileError(message);
      setExistingNewPatient(null);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      if (requestId === mobileCheckRequestIdRef.current) {
        setCheckingNewMobile(false);
      }
    }
  };

  const scheduleNewMobileCheck = (mobile: string) => {
    clearScheduledMobileCheck();
    const trimmedMobile = mobile.trim();
    if (!isValidMobile(trimmedMobile)) {
      return;
    }

    mobileCheckTimerRef.current = setTimeout(() => {
      void checkNewMobile(trimmedMobile).catch(() => undefined);
    }, MOBILE_CHECK_DEBOUNCE_MS);
  };

  const handleSearch = async () => {
    clearMessages();

    const trimmedSearch = searchNumber.trim();
    if (!isValidMobile(trimmedSearch)) {
      setSearchError("Enter a valid mobile number (exactly 10 digits).");
      setLatestPatient(null);
      return;
    }

    setSearching(true);
    try {
      const mostRecent = await getLatestPatientByMobile(trimmedSearch);
      setLatestPatient(mostRecent);
      if (!mostRecent) {
        setBookingMode("new");
        setSearchNotice("No result found. Please add a new appointment.");
        setNewPatient((prev) => ({ ...prev, mobileNumber: trimmedSearch }));
        clearScheduledMobileCheck();
        mobileCheckRequestIdRef.current += 1;
        setCheckingNewMobile(false);
        setExistingNewPatient(null);
        setNewMobileError(null);
        return;
      }
      setBookingMode("existing");
      setSearchNotice(`Patient found: ${mostRecent.full_name}. Continue with follow-up booking.`);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed.");
      setLatestPatient(null);
    } finally {
      setSearching(false);
    }
  };

  const handleBookFollowUp = async (patient: AppointmentRow) => {
    clearMessages();

    if (!quickTime) {
      setFeedback({ type: "error", text: "No available time slots for the selected date." });
      return;
    }

    const nowIso = new Date().toISOString();
    const timeline = [createTimelineEvent("created", "Follow-up appointment booked")];
    const ok = await saveAppointment({
      full_name: patient.full_name,
      mobile_number: patient.mobile_number,
      preferred_date: quickDate,
      preferred_time: quickTime || null,
      age: patient.age ?? null,
      gender: patient.gender ?? null,
      problem: patient.problem ?? null,
      appointment_type: "Follow-up",
      status: "New",
      message_sent: false,
      whatsapp_delivery_status: "pending",
      timeline,
      created_at: nowIso,
      updated_at: nowIso,
    });

    if (ok) {
      setTimeout(() => navigate("/"), 800);
    }
  };

  const handleBookNewPatient = async (event: FormEvent) => {
    event.preventDefault();
    clearMessages();

    if (!newPatient.fullName.trim()) {
      setFeedback({ type: "error", text: "Patient name is required." });
      return;
    }

    if (!isValidMobile(newPatient.mobileNumber)) {
      setFeedback({ type: "error", text: "Enter a valid mobile number (exactly 10 digits)." });
      return;
    }

    clearScheduledMobileCheck();
    if (checkingNewMobile) {
      setFeedback({
        type: "error",
        text: "Please wait a moment. We are still checking this mobile number.",
      });
      return;
    }

    let existingPatient: ExistingPatientSummary | null = null;
    try {
      existingPatient = await checkNewMobile(newPatient.mobileNumber);
    } catch {
      setFeedback({
        type: "error",
        text: "Could not verify mobile number. Please try again.",
      });
      return;
    }

    if (existingPatient) {
      setFeedback({
        type: "error",
        text: "This mobile number already exists. Patient is old. Please use Existing Patient Follow-up.",
      });
      return;
    }

    const parsedAge = newPatient.age.trim() ? Number(newPatient.age) : null;
    if (parsedAge !== null && (Number.isNaN(parsedAge) || parsedAge < 0 || parsedAge > 120)) {
      setFeedback({ type: "error", text: "Enter a valid age." });
      return;
    }

    const nowIso = new Date().toISOString();
    const timeline = [createTimelineEvent("created", "New appointment booked")];
    const ok = await saveAppointment({
      full_name: newPatient.fullName.trim(),
      mobile_number: newPatient.mobileNumber.trim(),
      preferred_date: newPatient.preferredDate,
      preferred_time: newPatient.preferredTime || null,
      age: parsedAge,
      gender: newPatient.gender || null,
      problem: newPatient.problem || null,
      appointment_type: "New Patient",
      status: "New",
      message_sent: false,
      whatsapp_delivery_status: "pending",
      timeline,
      created_at: nowIso,
      updated_at: nowIso,
    });

    if (!ok) {
      return;
    }

    setNewPatient({
      fullName: "",
      mobileNumber: "",
      age: "",
      gender: "",
      problem: "",
      preferredDate: defaultDate,
      preferredTime: defaultTime,
    });
    setExistingNewPatient(null);
    setNewMobileError(null);
    setTimeout(() => navigate("/"), 800);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppMenuBar />
      <div className="container mx-auto max-w-5xl p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Book Appointment</h1>
            <p className="text-sm text-muted-foreground">
              Create a new booking or quickly schedule a follow-up for existing patients.
            </p>
          </div>
        </div>
      

      {feedback && (
        <Card className={feedback.type === "error" ? "border-destructive/40" : "border-emerald-400/40"}>
          <CardContent className="pt-6">
            <p className={feedback.type === "error" ? "text-destructive text-sm" : "text-emerald-700 text-sm"}>
              {feedback.text}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Search By Phone Number
          </CardTitle>
          <CardDescription>
            If number exists, continue with old patient follow-up. If not found, add a new
            appointment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="topSearchNumber">Mobile Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="topSearchNumber"
                  type="tel"
                  value={searchNumber}
                  onChange={(event) =>
                    setSearchNumber(event.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="Enter 10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={handleSearch} disabled={searching} className="w-full">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>
          </div>

          {searchError && <p className="text-sm text-destructive">{searchError}</p>}
          {searchNotice && !searchError && (
            <p className="text-sm text-emerald-700">{searchNotice}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={bookingMode === "existing" ? "default" : "outline"}
          onClick={() => handleModeChange("existing")}
          className="w-full sm:w-auto"
        >
          <History className="mr-2 h-4 w-4" />
          Old Patient
        </Button>
        <Button
          type="button"
          variant={bookingMode === "new" ? "default" : "outline"}
          onClick={() => handleModeChange("new")}
          className="w-full sm:w-auto"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          New Appointment
        </Button>
      </div>

      {bookingMode === "existing" && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Existing Patient Follow-up
          </CardTitle>
          <CardDescription>
            Search from the top bar and complete follow-up booking for existing patient.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {latestPatient ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Preferred Date</Label>
                  <Select value={quickDate} onValueChange={handleQuickDateChange}>
                    <SelectTrigger aria-label="Preferred Date">
                      <SelectValue placeholder="Select available date" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDates.map((date) => (
                        <SelectItem key={date.value} value={date.value}>
                          {date.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Only available dates are shown.</p>
                </div>
                <div className="space-y-2">
                  <Label>Preferred Time</Label>
                  <Select value={quickTime} onValueChange={setQuickTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {quickTimeSessions.map((session) => (
                        <SelectGroup key={session.key}>
                          <SelectLabel className="pl-2">{formatSessionLabel(session)}</SelectLabel>
                          {session.times.map((time) => (
                            <SelectItem key={`${session.key}-${time}`} value={time}>
                              {formatDisplayTime(time)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Past time slots are hidden for today.
                  </p>
                </div>
              </div>
              <div className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-semibold">{latestPatient.full_name}</p>
                  <p className="text-sm text-muted-foreground">{latestPatient.mobile_number}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last visit: {dayjs(latestPatient.preferred_date).format("DD MMM YYYY")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Latest record updated:{" "}
                    {dayjs(latestPatient.updated_at || latestPatient.created_at).format("DD MMM YYYY, h:mm A")}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => handleBookFollowUp(latestPatient)}
                  disabled={loading}
                  className="sm:w-auto w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Book Follow-up"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No patient selected. Search phone number from the top bar.
            </p>
          )}
        </CardContent>
      </Card>
      )}

      {bookingMode === "new" && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            New Appointment
          </CardTitle>
          <CardDescription>
            Create a fresh booking entry. Only Name and Mobile Number are mandatory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleBookNewPatient}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={newPatient.fullName} onChange={(event) => updateNewPatient("fullName", event.target.value)} placeholder="Patient full name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobileNumber">Mobile Number</Label>
                <Input
                  id="mobileNumber"
                  type="tel"
                  value={newPatient.mobileNumber}
                  onChange={(event) => {
                    const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 10);
                    updateNewPatient("mobileNumber", digitsOnly);
                    setNewMobileError(null);
                    if (digitsOnly.length < 10) {
                      clearScheduledMobileCheck();
                      mobileCheckRequestIdRef.current += 1;
                      setCheckingNewMobile(false);
                      setExistingNewPatient(null);
                      return;
                    }
                    scheduleNewMobileCheck(digitsOnly);
                  }}
                  onBlur={() => {
                    clearScheduledMobileCheck();
                    void checkNewMobile(newPatient.mobileNumber).catch(() => undefined);
                  }}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  required
                />
                {checkingNewMobile && (
                  <p className="text-xs text-muted-foreground">Checking existing patient...</p>
                )}
                {newMobileError && <p className="text-xs text-destructive">{newMobileError}</p>}
                {existingNewPatient && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                    Old patient found: <strong>{existingNewPatient.full_name}</strong>. Last visit{" "}
                    {dayjs(existingNewPatient.preferred_date).format("DD MMM YYYY")}. Please use
                    Existing Patient Follow-up.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input id="age" type="number" min={0} max={120} value={newPatient.age} onChange={(event) => updateNewPatient("age", event.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={newPatient.gender || "not-selected"} onValueChange={(value) => updateNewPatient("gender", value === "not-selected" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not-selected">Not specified</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Problem (Optional)</Label>
              <Select
                value={newPatient.problem || "not-selected"}
                onValueChange={(value) =>
                  updateNewPatient("problem", value === "not-selected" ? "" : value)
                }
              >
                <SelectTrigger aria-label="Problem">
                  <SelectValue placeholder="Select physio problem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not-selected">Select problem</SelectItem>
                  {PHYSIO_PROBLEM_OPTIONS.map((problem) => (
                    <SelectItem key={problem} value={problem}>
                      {problem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Preferred Date</Label>
                <Select value={newPatient.preferredDate} onValueChange={handleNewPatientDateChange}>
                  <SelectTrigger aria-label="Preferred Date">
                    <SelectValue placeholder="Select available date" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.map((date) => (
                      <SelectItem key={date.value} value={date.value}>
                        {date.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Only available dates are shown.</p>
              </div>
              <div className="space-y-2">
                <Label>Preferred Time</Label>
                <Select value={newPatient.preferredTime} onValueChange={(value) => updateNewPatient("preferredTime", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {newPatientTimeSessions.map((session) => (
                      <SelectGroup key={session.key}>
                        <SelectLabel className="pl-2">{formatSessionLabel(session)}</SelectLabel>
                        {session.times.map((time) => (
                          <SelectItem key={`${session.key}-${time}`} value={time}>
                            {formatDisplayTime(time)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Past time slots are hidden for today.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => navigate("/")}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || checkingNewMobile || Boolean(existingNewPatient)}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    Book Appointment
                  </span>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}
      </div>
    </div>
  );
};

export default BookAppointment;

