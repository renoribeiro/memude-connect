-- Two legacy jobs built their URL dynamically, so they were not matched by the
-- first cleanup's literal "/functions/v1/" filter.
DO $$
DECLARE
  legacy_job record;
BEGIN
  FOR legacy_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'visit-distribution-timeout-checker-minutely',
      'monitor-visits-hourly'
    )
       OR (
         command ILIKE '%net.http_post%'
         AND command ILIKE '%system_settings%'
         AND command ILIKE '%cron_secret%'
       )
  LOOP
    PERFORM cron.unschedule(legacy_job.jobid);
  END LOOP;
END
$$;
