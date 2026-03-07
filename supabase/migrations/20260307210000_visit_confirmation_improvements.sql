-- Add confirmation tracking columns to visitas table
ALTER TABLE visitas 
  ADD COLUMN IF NOT EXISTS lead_confirmou boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS corretor_confirmou boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmation_metadata jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN visitas.lead_confirmou IS 'Whether the lead confirmed attendance via WhatsApp reminder (null=no response, true=confirmed, false=declined)';
COMMENT ON COLUMN visitas.corretor_confirmou IS 'Whether the broker confirmed attendance via WhatsApp reminder (null=no response, true=confirmed, false=declined)';
COMMENT ON COLUMN visitas.confirmation_metadata IS 'JSON metadata about confirmations: timestamps, raw messages, reminder types';
