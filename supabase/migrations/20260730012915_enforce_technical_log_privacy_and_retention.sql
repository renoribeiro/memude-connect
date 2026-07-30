-- Production audit remediation: remove legacy payloads that may contain PII
-- and enforce a short, automatic retention window for technical logs.

BEGIN;

UPDATE public.webhook_logs
SET payload = jsonb_build_object('legacy_payload_redacted', true)
WHERE payload IS NOT NULL
  AND payload <> '{}'::jsonb;

UPDATE public.integration_logs
SET
  request_payload = CASE
    WHEN request_payload IS NULL THEN NULL
    ELSE jsonb_build_object('legacy_payload_redacted', true)
  END,
  response_body = CASE
    WHEN response_body IS NULL THEN NULL
    ELSE jsonb_build_object('legacy_payload_redacted', true)
  END,
  metadata = CASE
    WHEN metadata IS NULL THEN NULL
    ELSE jsonb_build_object('legacy_payload_redacted', true)
  END
WHERE request_payload IS NOT NULL
   OR response_body IS NOT NULL
   OR metadata IS NOT NULL;

UPDATE public.application_logs
SET metadata = '{}'::jsonb
WHERE metadata IS NOT NULL
  AND metadata <> '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.cleanup_old_technical_logs()
RETURNS TABLE (
  application_logs_deleted bigint,
  integration_logs_deleted bigint,
  webhook_logs_deleted bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  app_count bigint;
  integration_count bigint;
  webhook_count bigint;
BEGIN
  DELETE FROM public.application_logs
  WHERE timestamp < now() - interval '30 days';
  GET DIAGNOSTICS app_count = ROW_COUNT;

  DELETE FROM public.integration_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS integration_count = ROW_COUNT;

  DELETE FROM public.webhook_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS webhook_count = ROW_COUNT;

  RETURN QUERY SELECT app_count, integration_count, webhook_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_technical_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_technical_logs() TO service_role;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cleanup-old-technical-logs';

SELECT cron.schedule(
  'cleanup-old-technical-logs',
  '30 2 * * *',
  $cron$SELECT public.cleanup_old_technical_logs();$cron$
);

COMMENT ON FUNCTION public.cleanup_old_technical_logs() IS
  'Deletes technical logs older than 30 days; scheduled daily for LGPD data minimization.';

COMMIT;
