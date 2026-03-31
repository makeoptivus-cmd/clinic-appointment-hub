-- Ensure WhatsApp delivery status supports all tracking states.
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS whatsapp_delivery_status TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_delivery_updated_at TIMESTAMP WITH TIME ZONE;

UPDATE public.appointments
SET whatsapp_delivery_status = CASE
  WHEN COALESCE(message_sent, false) = true THEN 'sent'
  ELSE 'pending'
END
WHERE whatsapp_delivery_status IS NULL OR whatsapp_delivery_status = '';

ALTER TABLE public.appointments
DROP CONSTRAINT IF EXISTS appointments_whatsapp_delivery_status_check;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_whatsapp_delivery_status_check
CHECK (whatsapp_delivery_status IN ('pending', 'sent', 'delivered', 'failed'));

CREATE INDEX IF NOT EXISTS idx_appointments_whatsapp_delivery_status
ON public.appointments (whatsapp_delivery_status);
