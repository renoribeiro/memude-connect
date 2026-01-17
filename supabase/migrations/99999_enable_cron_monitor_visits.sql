-- Habilitar a extensão pg_cron se ainda não estiver habilitada
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Agendar o monitoramento de visitas para rodar a cada hora (minuto 0)
-- IMPORTANTE: Substitua 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/monitor-visits' pela URL real da sua função
-- e 'YOUR_SERVICE_ROLE_KEY' pela sua chave real de serviço (disponível no dashboard).

select
  cron.schedule(
    'monitor-visits-hourly',
    '0 * * * *', 
    $$
    select
      net.http_post(
          url:='https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/monitor-visits',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
  );

-- Para verificar os jobs agendados:
-- select * from cron.job;

-- Para remover o agendamento se necessário:
-- select cron.unschedule('monitor-visits-hourly');
