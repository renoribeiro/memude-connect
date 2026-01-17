-- Inserir configurações para o sistema de cron jobs
INSERT INTO public.system_settings (key, value, description) VALUES
('distribution_cron_enabled', 'true', 'Habilita verificação automática de timeouts'),
('distribution_check_interval', '60', 'Intervalo em segundos para verificar timeouts'),
('admin_whatsapp', '', 'Número do WhatsApp do administrador para notificações'),
('whatsapp_official_token', '', 'Token da API Oficial do WhatsApp'),
('whatsapp_phone_number_id', '', 'ID do número de telefone da API Oficial');

-- Função para configurar cron job (será chamada manualmente pelo admin)
CREATE OR REPLACE FUNCTION public.setup_distribution_cron()
RETURNS TEXT AS $$
BEGIN
  -- Remove job existente se houver
  PERFORM cron.unschedule('distribution-timeout-check');
  
  -- Cria novo job para verificar timeouts a cada minuto
  PERFORM cron.schedule(
    'distribution-timeout-check',
    '* * * * *', -- A cada minuto
    $$
    SELECT net.http_post(
      url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/distribution-timeout-checker',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94eWJhc3Z0cGhvc2RtbG1yZm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NTU4MTUsImV4cCI6MjA3MzMzMTgxNX0.Je-WNYEO9LEpBNjT1hNs1Qw_uoo8ErNh53Ipm5XSOFk"}'::jsonb,
      body := '{"automated": true}'::jsonb
    );
    $$
  );
  
  RETURN 'Cron job configurado com sucesso';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;