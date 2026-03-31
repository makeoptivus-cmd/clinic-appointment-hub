-- Add timeline, reschedule/cancel, WhatsApp delivery tracking, and revenue amount fields
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rescheduled_from_date DATE,
ADD COLUMN IF NOT EXISTS rescheduled_from_time TIME,
ADD COLUMN IF NOT EXISTS whatsapp_delivery_status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS whatsapp_delivery_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT,
ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Normalize existing rows for delivery status
UPDATE public.appointments
SET whatsapp_delivery_status = CASE
  WHEN message_sent = true THEN 'sent'
  ELSE 'pending'
END
WHERE whatsapp_delivery_status IS NULL OR whatsapp_delivery_status = '';

-- Keep delivery status values constrained
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_whatsapp_delivery_status_check'
  ) THEN
    ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_whatsapp_delivery_status_check
    CHECK (whatsapp_delivery_status IN ('pending', 'sent', 'delivered', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_whatsapp_delivery_status
ON public.appointments (whatsapp_delivery_status);

CREATE INDEX IF NOT EXISTS idx_appointments_preferred_date_status
ON public.appointments (preferred_date, status);
