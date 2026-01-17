-- Configurar cron job para verificação de timeouts de distribuição
SELECT cron.schedule(
  'distribution-timeout-checker',
  '*/2 * * * *', -- A cada 2 minutos
  $$
  SELECT
    net.http_post(
        url:='https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/distribution-timeout-checker',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94eWJhc3Z0cGhvc2RtbG1yZm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NTU4MTUsImV4cCI6MjA3MzMzMTgxNX0.Je-WNYEO9LEpBNjT1hNs1Qw_uoo8ErNh53Ipm5XSOFk"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);