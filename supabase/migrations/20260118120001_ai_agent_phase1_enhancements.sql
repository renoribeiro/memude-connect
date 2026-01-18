-- =====================================================
-- AI Agents Enhancement Migration
-- Phase 1: Core Enhancement
-- =====================================================

-- Add new columns to ai_agents for humanization and enhanced features
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS llm_provider TEXT DEFAULT 'openai';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS humanization_enabled BOOLEAN DEFAULT true;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS typing_delay_min_ms INTEGER DEFAULT 2000;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS typing_delay_max_ms INTEGER DEFAULT 8000;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS split_long_messages BOOLEAN DEFAULT true;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS use_casual_language BOOLEAN DEFAULT true;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS regional_expressions TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add customer_name to conversations
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- =====================================================
-- Knowledge Base for RAG-enhanced responses
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('faq', 'objection', 'neighborhood', 'financing', 'property_type', 'company_policy', 'other')),
  question_patterns TEXT[] NOT NULL,
  answer TEXT NOT NULL,
  embedding vector(1536),
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Sentiment Analysis Logging
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_sentiment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES agent_messages(id) ON DELETE CASCADE,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative', 'urgent', 'frustrated')),
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  triggers_detected TEXT[],
  suggested_action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Intent Classification Cache
-- =====================================================
CREATE TABLE IF NOT EXISTS intent_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_hash TEXT NOT NULL UNIQUE,
  primary_intent TEXT NOT NULL,
  confidence NUMERIC(3,2),
  entities JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes for Performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_knowledge_base_agent ON agent_knowledge_base(agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON agent_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_active ON agent_knowledge_base(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sentiment_log_conversation ON conversation_sentiment_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_log_sentiment ON conversation_sentiment_log(sentiment);
CREATE INDEX IF NOT EXISTS idx_intent_cache_hash ON intent_classifications(message_hash);

-- Vector index for knowledge base semantic search
CREATE INDEX IF NOT EXISTS idx_knowledge_base_vector ON agent_knowledge_base 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 50);

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE agent_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sentiment_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_classifications ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can manage agent_knowledge_base" ON agent_knowledge_base 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage conversation_sentiment_log" ON conversation_sentiment_log 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage intent_classifications" ON intent_classifications 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Service role bypass
CREATE POLICY "Service role bypass agent_knowledge_base" ON agent_knowledge_base FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass conversation_sentiment_log" ON conversation_sentiment_log FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass intent_classifications" ON intent_classifications FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- Function: Match Knowledge Base by Similarity
-- =====================================================
CREATE OR REPLACE FUNCTION match_knowledge_base(
  query_embedding vector(1536),
  p_agent_id UUID,
  p_category TEXT DEFAULT NULL,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  question_patterns TEXT[],
  answer TEXT,
  priority INTEGER,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kb.id,
    kb.category,
    kb.question_patterns,
    kb.answer,
    kb.priority,
    1 - (kb.embedding <=> query_embedding) as similarity
  FROM agent_knowledge_base kb
  WHERE kb.agent_id = p_agent_id
    AND kb.is_active = true
    AND (p_category IS NULL OR kb.category = p_category)
    AND kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.priority DESC, kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE agent_knowledge_base IS 'Base de conhecimento vetorizada para respostas RAG do agente';
COMMENT ON TABLE conversation_sentiment_log IS 'Log de análise de sentimento das mensagens';
COMMENT ON TABLE intent_classifications IS 'Cache de classificações de intenção para performance';
