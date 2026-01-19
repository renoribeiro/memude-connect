-- Migration: Backfill queue_id for existing visit_distribution_attempts
-- This ensures existing records work with the updated query logic

-- Backfill queue_id for existing records that have null queue_id
UPDATE visit_distribution_attempts vda
SET queue_id = vdq.id
FROM visit_distribution_queue vdq
WHERE vda.visita_id = vdq.visita_id
  AND vda.queue_id IS NULL;

-- Also backfill distribution_attempts if needed (for lead distribution)
UPDATE distribution_attempts da
SET queue_id = dq.id
FROM distribution_queue dq
WHERE da.lead_id = dq.lead_id
  AND da.queue_id IS NULL;

-- Log completion
DO $$
DECLARE
  visit_count INTEGER;
  lead_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO visit_count FROM visit_distribution_attempts WHERE queue_id IS NOT NULL;
  SELECT COUNT(*) INTO lead_count FROM distribution_attempts WHERE queue_id IS NOT NULL;
  RAISE NOTICE 'Backfill complete: % visit attempts, % lead attempts with queue_id', visit_count, lead_count;
END $$;
