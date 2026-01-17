-- Remove the UNIQUE constraint on visitas.lead_id to allow multiple visits per lead
-- This is necessary because a lead can have multiple visits (scheduled, confirmed, completed, cancelled, etc.)

-- Drop the unique constraint (which will also remove the index)
ALTER TABLE public.visitas DROP CONSTRAINT IF EXISTS visitas_lead_id_key;

-- Create a regular (non-unique) index for performance
CREATE INDEX IF NOT EXISTS idx_visitas_lead_id ON public.visitas(lead_id);

-- Add comment to document that multiple visits per lead are allowed
COMMENT ON TABLE public.visitas IS 'Stores visit records. A lead can have multiple visits with different statuses and dates.';