-- Speed up latest-patient lookup by mobile number
CREATE INDEX IF NOT EXISTS idx_appointments_mobile_updated_at
ON public.appointments (mobile_number, updated_at DESC);
