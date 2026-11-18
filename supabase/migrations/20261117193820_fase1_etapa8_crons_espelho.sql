-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

select cron.schedule('fase1-planilha-espelho', '* * * * *', $c$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/sheets-espelho',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')),
    body := '{"modo":"enviar"}'::jsonb,
    timeout_milliseconds := 60000
  );
$c$);

select cron.schedule('fase1-planilha-conferencia', '30 6 * * *', $c$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/sheets-espelho',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')),
    body := '{"modo":"conferencia"}'::jsonb,
    timeout_milliseconds := 120000
  );
$c$);
;
