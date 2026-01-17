-- Fase 5: Expandir message_templates para suportar novos tipos de mensagem

-- Adicionar coluna para armazenar configuração de botões e mídia
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS button_config JSONB DEFAULT NULL;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS media_config JSONB DEFAULT NULL;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS list_config JSONB DEFAULT NULL;

-- Comentários para documentação
COMMENT ON COLUMN message_templates.button_config IS 'Configuração de botões interativos: [{"id": "btn1", "text": "Aceitar"}]';
COMMENT ON COLUMN message_templates.media_config IS 'Configuração de mídia: {"type": "image", "url": "...", "caption": "..."}';
COMMENT ON COLUMN message_templates.list_config IS 'Configuração de lista interativa: {"title": "...", "sections": [...]}';

-- Adicionar novos tipos de categoria
ALTER TYPE template_category ADD VALUE IF NOT EXISTS 'visit_distribution';
ALTER TYPE template_category ADD VALUE IF NOT EXISTS 'payment_reminder';
ALTER TYPE template_category ADD VALUE IF NOT EXISTS 'feedback_request';

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_message_templates_type ON message_templates(type);
CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active) WHERE is_active = true;

-- Inserir templates de exemplo com botões
INSERT INTO message_templates (name, category, type, subject, content, variables, button_config, is_system, is_active)
VALUES 
(
  'Distribuição de Visita com Botões',
  'visit_distribution',
  'whatsapp',
  'Nova Visita Disponível',
  '🏠 *NOVA OPORTUNIDADE DE VISITA*

*Cliente:* {{lead_nome}}
*Telefone:* {{lead_telefone}}
*Empreendimento:* {{empreendimento_nome}}
*Data solicitada:* {{data_visita}}
*Horário:* {{horario_visita}}

⏰ Você tem {{timeout_minutos}} minutos para responder.',
  '["lead_nome", "lead_telefone", "empreendimento_nome", "data_visita", "horario_visita", "timeout_minutos"]'::jsonb,
  '[
    {"id": "accept", "text": "✅ Aceitar"},
    {"id": "reject", "text": "❌ Recusar"}
  ]'::jsonb,
  true,
  true
),
(
  'Confirmação de Visita com Botões',
  'visit_confirmation',
  'whatsapp',
  'Confirmar Visita',
  '📅 *CONFIRMAÇÃO DE VISITA*

Olá {{corretor_nome}}!

Confirme sua visita:
*Cliente:* {{lead_nome}}
*Data:* {{data_visita}}
*Horário:* {{horario_visita}}
*Local:* {{empreendimento_nome}}',
  '["corretor_nome", "lead_nome", "data_visita", "horario_visita", "empreendimento_nome"]'::jsonb,
  '[
    {"id": "confirm", "text": "✅ Confirmar"},
    {"id": "reschedule", "text": "📅 Reagendar"},
    {"id": "cancel", "text": "❌ Cancelar"}
  ]'::jsonb,
  true,
  true
)
ON CONFLICT DO NOTHING;