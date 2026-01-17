-- Add 'interesse' column to visitas table
ALTER TABLE public.visitas ADD COLUMN interesse boolean DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.visitas.interesse IS 'Indicates if the lead showed interest in buying during the visit';
