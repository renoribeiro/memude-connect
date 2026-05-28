-- =====================================================
-- Migration: Fix AI Agent Bugs & Add Audio Follow-ups
-- Data: 2026-05-27
-- Bugs corrigidos: BUG-01, BUG-02, BUG-05, BUG-06, BUG-07
-- Melhorias: Suporte a áudio pré-gravado nos follow-ups
-- =====================================================

-- =====================================================
-- BUG-01 / BUG-07: Corrigir nome da coluna em agent_followup_log
-- A migration anterior criou 'sent_message' mas o código usa 'message_sent'
-- =====================================================
DO $$
BEGIN
  -- Renomear coluna se existir com nome antigo
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_followup_log' AND column_name = 'sent_message'
  ) THEN
    ALTER TABLE agent_followup_log RENAME COLUMN sent_message TO message_sent;
    RAISE NOTICE 'Coluna sent_message renomeada para message_sent';
  ELSE
    -- Garantir que a coluna message_sent existe
    ALTER TABLE agent_followup_log ADD COLUMN IF NOT EXISTS message_sent TEXT;
    RAISE NOTICE 'Coluna message_sent já existe ou foi adicionada';
  END IF;
END;
$$;

-- Garantir que o campo message_sent não seja NULL (para consistência)
ALTER TABLE agent_followup_log ALTER COLUMN message_sent SET DEFAULT '';

-- =====================================================
-- BUG-05: Adicionar 'followup_sent' como valor válido em action_taken
-- A constraint atual não incluía este valor usado pelo followup checker
-- =====================================================
ALTER TABLE agent_messages DROP CONSTRAINT IF EXISTS agent_messages_action_taken_check;
ALTER TABLE agent_messages ADD CONSTRAINT agent_messages_action_taken_check
  CHECK (action_taken IN ('property_search', 'schedule_visit', 'qualify_lead', 'transfer_human', 'followup_sent', 'none'));

-- =====================================================
-- GARANTIR: Tabela agent_followups existe (criada remotamente, garantir localmente)
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE NOT NULL,
  sequence_order INTEGER NOT NULL DEFAULT 1,
  delay_hours NUMERIC NOT NULL DEFAULT 24,
  message_template TEXT NOT NULL DEFAULT '',
  send_after_hour INTEGER DEFAULT 8 CHECK (send_after_hour >= 0 AND send_after_hour <= 23),
  send_before_hour INTEGER DEFAULT 20 CHECK (send_before_hour >= 0 AND send_before_hour <= 23),
  is_active BOOLEAN DEFAULT true,
  skip_if_qualified BOOLEAN DEFAULT false,
  only_if_stages TEXT[],
  use_for_temperature TEXT[] DEFAULT ARRAY['hot', 'warm', 'cool', 'cold']::TEXT[],
  use_after_objection TEXT,
  include_property_reminder BOOLEAN DEFAULT false,
  max_attempts INTEGER DEFAULT 3,
  template_variant TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para agent_followups
ALTER TABLE agent_followups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agent_followups' AND policyname = 'Admins can manage agent_followups'
  ) THEN
    CREATE POLICY "Admins can manage agent_followups" ON agent_followups
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agent_followups' AND policyname = 'Service role bypass agent_followups'
  ) THEN
    CREATE POLICY "Service role bypass agent_followups" ON agent_followups
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END;
$$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_agent_followups_agent ON agent_followups(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_followups_sequence ON agent_followups(agent_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_agent_followups_active ON agent_followups(is_active) WHERE is_active = true;

-- =====================================================
-- MELHORIA-01: Suporte a Áudio e Mídia nos Follow-ups
-- Adicionar colunas para mídia nos follow-ups
-- =====================================================
ALTER TABLE agent_followups ADD COLUMN IF NOT EXISTS
  media_type TEXT DEFAULT 'text' CHECK (media_type IN ('text', 'audio', 'image', 'video'));

ALTER TABLE agent_followups ADD COLUMN IF NOT EXISTS
  audio_url TEXT;

ALTER TABLE agent_followups ADD COLUMN IF NOT EXISTS
  audio_caption TEXT;

ALTER TABLE agent_followups ADD COLUMN IF NOT EXISTS
  image_url TEXT;

ALTER TABLE agent_followups ADD COLUMN IF NOT EXISTS
  image_caption TEXT;

-- =====================================================
-- MELHORIA: Adicionar coluna timezone_offset para horário correto
-- =====================================================
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS
  timezone_offset INTEGER DEFAULT -3 CHECK (timezone_offset >= -12 AND timezone_offset <= 14);

-- =====================================================
-- MELHORIA: Métricas de follow-up na tabela de log
-- =====================================================
ALTER TABLE agent_followup_log ADD COLUMN IF NOT EXISTS
  media_type TEXT DEFAULT 'text';

ALTER TABLE agent_followup_log ADD COLUMN IF NOT EXISTS
  audio_sent BOOLEAN DEFAULT false;

-- =====================================================
-- MELHORIA: Configuração de cadência máxima global
-- =====================================================
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS
  max_followup_attempts INTEGER DEFAULT 5;

ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS
  followup_pause_stages TEXT[] DEFAULT ARRAY['closing']::TEXT[];

-- =====================================================
-- MELHORIA: Índice para busca de leads com followup pendente
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_followup_log_responded
  ON agent_followup_log(conversation_id, lead_responded)
  WHERE lead_responded = false;

CREATE INDEX IF NOT EXISTS idx_agent_conversations_followup
  ON agent_conversations(last_message_at, status)
  WHERE status = 'active';

-- =====================================================
-- FUNÇÃO: Verificar se lead pode receber follow-up
-- Leva em conta máximo de tentativas e estágio de pausa
-- =====================================================
CREATE OR REPLACE FUNCTION can_send_followup(
  p_conversation_id UUID,
  p_agent_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sent_count INTEGER;
  v_max_attempts INTEGER;
  v_current_stage TEXT;
  v_pause_stages TEXT[];
  v_lead_responded_after_last BOOLEAN;
BEGIN
  -- Buscar configurações do agente
  SELECT max_followup_attempts, followup_pause_stages
  INTO v_max_attempts, v_pause_stages
  FROM ai_agents WHERE id = p_agent_id;

  v_max_attempts := COALESCE(v_max_attempts, 5);
  v_pause_stages := COALESCE(v_pause_stages, ARRAY['closing']::TEXT[]);

  -- Verificar estágio atual da conversa
  SELECT current_stage INTO v_current_stage
  FROM agent_conversations WHERE id = p_conversation_id;

  -- Pausar se estiver em estágio de fechamento
  IF v_current_stage = ANY(v_pause_stages) THEN
    RETURN FALSE;
  END IF;

  -- Contar total de follow-ups já enviados
  SELECT COUNT(*) INTO v_sent_count
  FROM agent_followup_log
  WHERE conversation_id = p_conversation_id;

  -- Verificar limite máximo
  IF v_sent_count >= v_max_attempts THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- =====================================================
-- COMENTÁRIOS
-- =====================================================
COMMENT ON COLUMN agent_followups.media_type IS 'Tipo de mídia do follow-up: text, audio, image, video';
COMMENT ON COLUMN agent_followups.audio_url IS 'URL do áudio pré-gravado para envio via WhatsApp';
COMMENT ON COLUMN agent_followups.audio_caption IS 'Legenda opcional para o áudio';
COMMENT ON COLUMN agent_followups.image_url IS 'URL da imagem para envio via WhatsApp';
COMMENT ON COLUMN agent_followups.image_caption IS 'Legenda da imagem enviada no follow-up';
COMMENT ON COLUMN ai_agents.timezone_offset IS 'Offset de fuso horário em horas (ex: -3 para Brasília)';
COMMENT ON COLUMN ai_agents.max_followup_attempts IS 'Máximo de follow-ups enviados por lead';
COMMENT ON COLUMN ai_agents.followup_pause_stages IS 'Estágios em que follow-ups são pausados';
