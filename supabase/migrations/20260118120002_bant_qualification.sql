-- =====================================================
-- BANT Qualification Enhancement Migration
-- Phase 2: Advanced Lead Qualification
-- =====================================================

-- Add BANT score fields to ai_lead_qualification
ALTER TABLE ai_lead_qualification ADD COLUMN IF NOT EXISTS bant_budget_score INTEGER DEFAULT 0 CHECK (bant_budget_score >= 0 AND bant_budget_score <= 25);
ALTER TABLE ai_lead_qualification ADD COLUMN IF NOT EXISTS bant_authority_score INTEGER DEFAULT 0 CHECK (bant_authority_score >= 0 AND bant_authority_score <= 20);
ALTER TABLE ai_lead_qualification ADD COLUMN IF NOT EXISTS bant_need_score INTEGER DEFAULT 0 CHECK (bant_need_score >= 0 AND bant_need_score <= 30);
ALTER TABLE ai_lead_qualification ADD COLUMN IF NOT EXISTS bant_timeline_score INTEGER DEFAULT 0 CHECK (bant_timeline_score >= 0 AND bant_timeline_score <= 25);

-- Add computed total BANT score
ALTER TABLE ai_lead_qualification ADD COLUMN IF NOT EXISTS bant_total_score INTEGER GENERATED ALWAYS AS (
  COALESCE(bant_budget_score, 0) + 
  COALESCE(bant_authority_score, 0) + 
  COALESCE(bant_need_score, 0) + 
  COALESCE(bant_timeline_score, 0)
) STORED;

-- Add lead temperature classification
ALTER TABLE ai_lead_qualification ADD COLUMN IF NOT EXISTS lead_temperature TEXT GENERATED ALWAYS AS (
  CASE 
    WHEN COALESCE(bant_budget_score, 0) + COALESCE(bant_authority_score, 0) + COALESCE(bant_need_score, 0) + COALESCE(bant_timeline_score, 0) >= 80 THEN 'hot'
    WHEN COALESCE(bant_budget_score, 0) + COALESCE(bant_authority_score, 0) + COALESCE(bant_need_score, 0) + COALESCE(bant_timeline_score, 0) >= 60 THEN 'warm'
    WHEN COALESCE(bant_budget_score, 0) + COALESCE(bant_authority_score, 0) + COALESCE(bant_need_score, 0) + COALESCE(bant_timeline_score, 0) >= 40 THEN 'cool'
    ELSE 'cold'
  END
) STORED;

-- Add BANT details fields
ALTER TABLE ai_lead_qualification ADD COLUMN IF NOT EXISTS budget_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE ai_lead_qualification ADD COLUMN IF NOT EXISTS authority_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE ai_lead_qualification ADD COLUMN IF NOT EXISTS need_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE ai_lead_qualification ADD COLUMN IF NOT EXISTS timeline_details JSONB DEFAULT '{}'::jsonb;

-- =====================================================
-- Lead Score History for Progression Analysis
-- =====================================================
CREATE TABLE IF NOT EXISTS lead_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id UUID REFERENCES ai_lead_qualification(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE,
  
  -- BANT scores at this point
  bant_budget INTEGER DEFAULT 0,
  bant_authority INTEGER DEFAULT 0,
  bant_need INTEGER DEFAULT 0,
  bant_timeline INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  temperature TEXT,
  
  -- Context
  triggered_by TEXT, -- 'message', 'qualification_update', 'manual'
  message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BANT Question Templates
-- =====================================================
CREATE TABLE IF NOT EXISTS bant_question_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  bant_category TEXT NOT NULL CHECK (bant_category IN ('budget', 'authority', 'need', 'timeline')),
  question_text TEXT NOT NULL,
  follow_up_if TEXT, -- 'positive', 'negative', 'unclear'
  follow_up_question TEXT,
  sequence_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_lead_score_history_qual ON lead_score_history(qualification_id);
CREATE INDEX IF NOT EXISTS idx_lead_score_history_conv ON lead_score_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_lead_score_history_time ON lead_score_history(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_bant_questions_agent ON bant_question_templates(agent_id);
CREATE INDEX IF NOT EXISTS idx_bant_questions_category ON bant_question_templates(bant_category);
CREATE INDEX IF NOT EXISTS idx_qualification_temperature ON ai_lead_qualification(lead_temperature);

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE lead_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE bant_question_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lead_score_history" ON lead_score_history 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage bant_question_templates" ON bant_question_templates 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Service role bypass lead_score_history" ON lead_score_history FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass bant_question_templates" ON bant_question_templates FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- Function: Calculate and Update BANT Score
-- =====================================================
CREATE OR REPLACE FUNCTION update_bant_score(
  p_qualification_id UUID,
  p_triggered_by TEXT DEFAULT 'message',
  p_message_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_score INTEGER,
  temperature TEXT,
  budget_score INTEGER,
  authority_score INTEGER,
  need_score INTEGER,
  timeline_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_qual RECORD;
  v_conversation_id UUID;
BEGIN
  -- Get current qualification data
  SELECT * INTO v_qual FROM ai_lead_qualification WHERE id = p_qualification_id;
  
  IF v_qual IS NULL THEN
    RETURN;
  END IF;
  
  v_conversation_id := v_qual.conversation_id;
  
  -- Insert score history record
  INSERT INTO lead_score_history (
    qualification_id,
    conversation_id,
    bant_budget,
    bant_authority,
    bant_need,
    bant_timeline,
    total_score,
    temperature,
    triggered_by,
    message_id
  ) VALUES (
    p_qualification_id,
    v_conversation_id,
    v_qual.bant_budget_score,
    v_qual.bant_authority_score,
    v_qual.bant_need_score,
    v_qual.bant_timeline_score,
    v_qual.bant_total_score,
    v_qual.lead_temperature,
    p_triggered_by,
    p_message_id
  );
  
  -- Return current scores
  RETURN QUERY SELECT 
    v_qual.bant_total_score,
    v_qual.lead_temperature,
    v_qual.bant_budget_score,
    v_qual.bant_authority_score,
    v_qual.bant_need_score,
    v_qual.bant_timeline_score;
END;
$$;

-- =====================================================
-- Function: Get Lead Temperature Stats
-- =====================================================
CREATE OR REPLACE FUNCTION get_lead_temperature_stats(
  p_agent_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  temperature TEXT,
  count BIGINT,
  percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM ai_lead_qualification q
  JOIN agent_conversations c ON c.id = q.conversation_id
  WHERE (p_agent_id IS NULL OR c.agent_id = p_agent_id)
    AND q.created_at >= NOW() - (p_days || ' days')::interval;
  
  IF v_total = 0 THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    q.lead_temperature,
    COUNT(*),
    ROUND((COUNT(*)::NUMERIC / v_total) * 100, 1)
  FROM ai_lead_qualification q
  JOIN agent_conversations c ON c.id = q.conversation_id
  WHERE (p_agent_id IS NULL OR c.agent_id = p_agent_id)
    AND q.created_at >= NOW() - (p_days || ' days')::interval
  GROUP BY q.lead_temperature
  ORDER BY 
    CASE q.lead_temperature 
      WHEN 'hot' THEN 1 
      WHEN 'warm' THEN 2 
      WHEN 'cool' THEN 3 
      ELSE 4 
    END;
END;
$$;

-- =====================================================
-- Insert Default BANT Questions
-- =====================================================
INSERT INTO bant_question_templates (agent_id, bant_category, question_text, sequence_order)
SELECT 
  id as agent_id,
  unnest(ARRAY['budget', 'budget', 'authority', 'authority', 'need', 'need', 'timeline', 'timeline']) as bant_category,
  unnest(ARRAY[
    'Você já tem uma ideia do valor que pretende investir?',
    'Está considerando financiamento ou compra à vista?',
    'A decisão será tomada por você ou envolve mais alguém?',
    'Sua família já está alinhada com a busca pelo novo imóvel?',
    'O que é mais importante pra você no novo imóvel?',
    'Quantos quartos você precisa no mínimo?',
    'Para quando você pretende se mudar?',
    'Já está visitando imóveis ou está começando a pesquisar agora?'
  ]) as question_text,
  unnest(ARRAY[1, 2, 1, 2, 1, 2, 1, 2]) as sequence_order
FROM ai_agents 
WHERE is_active = true
ON CONFLICT DO NOTHING;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE lead_score_history IS 'Histórico de scores BANT para análise de progressão do lead';
COMMENT ON TABLE bant_question_templates IS 'Templates de perguntas BANT configuráveis por agente';
COMMENT ON FUNCTION update_bant_score IS 'Atualiza e registra histórico de score BANT';
COMMENT ON FUNCTION get_lead_temperature_stats IS 'Retorna estatísticas de temperatura de leads por período';
