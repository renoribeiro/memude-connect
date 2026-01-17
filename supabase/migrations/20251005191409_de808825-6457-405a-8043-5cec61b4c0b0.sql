-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule daily metrics calculation (every day at 2 AM)
SELECT cron.schedule(
  'calculate-daily-metrics',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/calculate-metrics',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94eWJhc3Z0cGhvc2RtbG1yZm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NTU4MTUsImV4cCI6MjA3MzMzMTgxNX0.Je-WNYEO9LEpBNjT1hNs1Qw_uoo8ErNh53Ipm5XSOFk"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Schedule hourly proactive notifications (every hour)
SELECT cron.schedule(
  'send-proactive-notifications',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/proactive-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94eWJhc3Z0cGhvc2RtbG1yZm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NTU4MTUsImV4cCI6MjA3MzMzMTgxNX0.Je-WNYEO9LEpBNjT1hNs1Qw_uoo8ErNh53Ipm5XSOFk"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Schedule daily cleanup of old WhatsApp verifications (every day at 3 AM)
SELECT cron.schedule(
  'cleanup-old-whatsapp-verifications',
  '0 3 * * *',
  $$
  SELECT cleanup_old_whatsapp_verification();
  $$
);

-- Schedule daily cleanup of old notifications (every day at 4 AM)
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 4 * * *',
  $$
  SELECT cleanup_old_notifications();
  $$
);

-- Schedule daily cleanup of old sync logs (every day at 5 AM)
SELECT cron.schedule(
  'cleanup-old-sync-logs',
  '0 5 * * *',
  $$
  SELECT cleanup_old_sync_logs();
  $$
);