-- Repair the queue/attempt relationship affected by the legacy sender and
-- close only abandoned queues that have no pending work left.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

WITH unique_active_queue AS (
  SELECT
    attempt.id AS attempt_id,
    (array_agg(queue.id ORDER BY queue.created_at DESC))[1] AS queue_id
  FROM public.distribution_attempts AS attempt
  JOIN public.distribution_queue AS queue
    ON queue.lead_id = attempt.lead_id
   AND queue.status IN ('pending', 'in_progress', 'processing')
  WHERE attempt.queue_id IS NULL
  GROUP BY attempt.id
  HAVING count(*) = 1
)
UPDATE public.distribution_attempts AS attempt
SET queue_id = candidate.queue_id
FROM unique_active_queue AS candidate
WHERE attempt.id = candidate.attempt_id
  AND attempt.queue_id IS NULL;

UPDATE public.distribution_queue AS queue
SET status = 'failed',
    completed_at = COALESCE(queue.completed_at, now()),
    failure_reason = COALESCE(
      NULLIF(queue.failure_reason, ''),
      'Encerrada pela auditoria: tentativa finalizada sem avanço automático da fila'
    )
WHERE queue.status IN ('pending', 'in_progress', 'processing')
  AND queue.created_at < now() - interval '30 minutes'
  AND NOT EXISTS (
    SELECT 1
    FROM public.distribution_attempts AS attempt
    WHERE attempt.queue_id = queue.id
      AND attempt.status = 'pending'
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_distribution_queue_one_active_per_lead
  ON public.distribution_queue (lead_id)
  WHERE status IN ('pending', 'in_progress', 'processing');

COMMIT;
