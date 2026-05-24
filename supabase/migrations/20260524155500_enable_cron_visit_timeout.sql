-- Habilitar a extensão pg_cron e pg_net se ainda não estiverem habilitadas
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Agendar o monitoramento de timeout de distribuição de visitas para rodar a cada 1 minuto
-- Este cron chama a edge function 'visit-distribution-timeout-checker' que verificará 
-- se o tempo limite de 15 minutos foi atingido para cada tentativa de distribuição de visita.

select
  cron.schedule(
    'visit-distribution-timeout-checker-minutely',
    '* * * * *', 
    $$
    select
      net.http_post(
          url:='https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/visit-distribution-timeout-checker',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94eWJhc3Z0cGhvc2RtbG1yZm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NTU4MTUsImV4cCI6MjA3MzMzMTgxNX0.Je-WNYEO9LEpBNjT1hNs1Qw_uoo8ErNh53Ipm5XSOFk"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
  );
