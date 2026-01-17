-- Atualizar configuração do admin_whatsapp se estiver vazio
-- Esta configuração é necessária para notificações de falha de distribuição

-- Primeiro, verificar se já existe e está vazio, então atualizar com um valor padrão
UPDATE system_settings 
SET 
  value = '558594452993',  -- WhatsApp padrão do admin (ajustar conforme necessário)
  description = 'Número do WhatsApp do administrador para receber notificações de falhas na distribuição automática (formato: 5585XXXXXXXXX)',
  updated_at = NOW()
WHERE key = 'admin_whatsapp' 
  AND (value IS NULL OR value = '');

-- Caso não exista, inserir
INSERT INTO system_settings (key, value, description)
SELECT 
  'admin_whatsapp',
  '558594452993',  -- WhatsApp padrão do admin (ajustar conforme necessário)
  'Número do WhatsApp do administrador para receber notificações de falhas na distribuição automática (formato: 5585XXXXXXXXX)'
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE key = 'admin_whatsapp'
);

-- Log da atualização
DO $$
BEGIN
  RAISE NOTICE 'Configuração admin_whatsapp atualizada. IMPORTANTE: Ajuste o número do WhatsApp em Configurações > Sistema se necessário.';
END $$;