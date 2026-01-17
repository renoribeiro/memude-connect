-- Adicionar coluna metadata à tabela message_templates se não existir
ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Atualizar template de distribuição de visitas com metadata para botões
UPDATE message_templates
SET 
  metadata = jsonb_build_object(
    'use_buttons', true,
    'button_config', jsonb_build_object(
      'buttons', jsonb_build_array(
        jsonb_build_object('type', 'replyButton', 'displayText', '✅ SIM'),
        jsonb_build_object('type', 'replyButton', 'displayText', '❌ NÃO')
      ),
      'footer_text', '⏰ Responda o mais rápido possível'
    )
  ),
  updated_at = now()
WHERE category = 'visit_distribution' 
  AND type = 'whatsapp'
  AND is_system = true;