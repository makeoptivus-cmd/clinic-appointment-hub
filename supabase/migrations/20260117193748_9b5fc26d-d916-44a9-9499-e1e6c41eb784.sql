-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  problem TEXT,
  preferred_date DATE NOT NULL,
  preferred_time TIME,
  status TEXT NOT NULL DEFAULT 'New',
  patient_response TEXT,
  admin_note TEXT,
  appointment_type TEXT DEFAULT 'New Patient',
  assigned_to TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Create policies - allow both authenticated and anonymous users
CREATE POLICY "Anyone can view all appointments" 
ON public.appointments 
FOR SELECT 
TO authenticated, anon
USING (true);

CREATE POLICY "Anyone can insert appointments" 
ON public.appointments 
FOR INSERT 
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Anyone can update appointments" 
ON public.appointments 
FOR UPDATE 
TO authenticated, anon
USING (true);

CREATE POLICY "Anyone can delete appointments" 
ON public.appointments 
FOR DELETE 
TO authenticated, anon
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;