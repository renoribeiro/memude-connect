-- Inserir configurações para o sistema de cron jobs
INSERT INTO public.system_settings (key, value, description) VALUES
('distribution_cron_enabled', 'true', 'Habilita verificação automática de timeouts'),
('distribution_check_interval', '60', 'Intervalo em segundos para verificar timeouts'),
('admin_whatsapp', '', 'Número do WhatsApp do administrador para notificações'),
('whatsapp_official_token', '', 'Token da API Oficial do WhatsApp'),
('whatsapp_phone_number_id', '', 'ID do número de telefone da API Oficial')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;