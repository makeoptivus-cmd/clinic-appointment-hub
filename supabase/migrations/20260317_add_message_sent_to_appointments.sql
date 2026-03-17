-- Migration: Add message_sent field to appointments table
ALTER TABLE public.appointments
ADD COLUMN message_sent BOOLEAN NOT NULL DEFAULT FALSE;