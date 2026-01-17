-- Recriar o job cron já que as extensões foram recriadas
SELECT extensions.cron.schedule(
  'sync-wordpress-properties-daily',
  '0 0 * * *', -- Executa todo dia às 00:00
  $$
  SELECT
    extensions.net.http_post(
        url:='https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/sync-wordpress-properties',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94eWJhc3Z0cGhvc2RtbG1yZm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NTU4MTUsImV4cCI6MjA3MzMzMTgxNX0.Je-WNYEO9LEpBNjT1hNs1Qw_uoo8ErNh53Ipm5XSOFk"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Recriar agendamento de limpeza
SELECT extensions.cron.schedule(
  'cleanup-sync-logs-weekly',
  '0 2 * * 0', -- Todo domingo às 02:00
  'SELECT cleanup_old_sync_logs();'
);