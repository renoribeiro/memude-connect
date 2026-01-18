-- =====================================================
-- AI Agents for MeMude Connect
-- Migration: Create tables for AI WhatsApp Agents
-- =====================================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- TABLE: ai_agents
-- Main configuration for AI agents
-- =====================================================
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Personality Configuration
  persona_name TEXT DEFAULT 'Ana',
  persona_role TEXT DEFAULT 'Consultora de Imóveis',
  tone TEXT DEFAULT 'professional_friendly' CHECK (tone IN ('professional', 'friendly', 'formal', 'casual', 'professional_friendly')),
  greeting_message TEXT,
  
  -- AI Configuration
  ai_model TEXT DEFAULT 'gpt-4o-mini',
  max_tokens INTEGER DEFAULT 500,
  temperature NUMERIC(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  system_prompt TEXT NOT NULL,
  
  -- Qualification Configuration
  qualification_questions JSONB DEFAULT '[]'::jsonb,
  qualification_stages JSONB DEFAULT '["greeting", "interest", "budget", "location", "timeline", "schedule"]'::jsonb,
  
  -- Property Search Configuration
  enable_property_search BOOLEAN DEFAULT true,
  max_properties_to_show INTEGER DEFAULT 3,
  
  -- Limits and Timeouts
  max_messages_per_conversation INTEGER DEFAULT 50,
  conversation_timeout_hours INTEGER DEFAULT 24,
  
  -- Triggers and Actions
  trigger_keywords TEXT[] DEFAULT ARRAY['comprar', 'apartamento', 'casa', 'imóvel', 'imovel'],
  fallback_action TEXT DEFAULT 'notify_admin' CHECK (fallback_action IN ('notify_admin', 'transfer_human', 'end_conversation')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- =====================================================
-- TABLE: agent_conversations
-- Conversations between AI agents and leads
-- =====================================================
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  
  -- Conversation State
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'transferred', 'expired')),
  current_stage TEXT DEFAULT 'greeting',
  
  -- Collected Qualification Data
  qualification_data JSONB DEFAULT '{}'::jsonb,
  lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  
  -- Context for RAG
  conversation_summary TEXT,
  last_intent TEXT,
  
  -- Presented Properties
  presented_properties UUID[] DEFAULT ARRAY[]::UUID[],
  interested_properties UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Metrics
  total_messages INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  
  UNIQUE(agent_id, phone_number)
);

-- =====================================================
-- TABLE: agent_messages
-- Individual messages in conversations
-- =====================================================
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE NOT NULL,
  
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- Metadata
  tokens_used INTEGER DEFAULT 0,
  intent_detected TEXT,
  entities_extracted JSONB DEFAULT '{}'::jsonb,
  
  -- Actions Executed
  action_taken TEXT CHECK (action_taken IN ('property_search', 'schedule_visit', 'qualify_lead', 'transfer_human', 'none')),
  action_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: ai_lead_qualification
-- Lead qualification data collected by AI
-- =====================================================
CREATE TABLE ai_lead_qualification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Desired Property Profile
  property_type TEXT CHECK (property_type IN ('residencial', 'comercial', 'terreno', 'rural')),
  min_price NUMERIC,
  max_price NUMERIC,
  min_bedrooms INTEGER,
  max_bedrooms INTEGER,
  preferred_neighborhoods TEXT[],
  preferred_features TEXT[],
  
  -- Client Profile
  urgency TEXT CHECK (urgency IN ('immediate', '3_months', '6_months', '1_year', 'just_researching')),
  financing_needed BOOLEAN,
  has_property_to_sell BOOLEAN,
  decision_maker BOOLEAN,
  
  -- Score and Status
  qualification_score INTEGER DEFAULT 0 CHECK (qualification_score >= 0 AND qualification_score <= 100),
  is_qualified BOOLEAN DEFAULT false,
  disqualification_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: agent_prompts
-- Customizable prompts by category
-- =====================================================
CREATE TABLE agent_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('system', 'greeting', 'qualification', 'property_presentation', 'objection_handling', 'closing', 'fallback')),
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(agent_id, name)
);

-- =====================================================
-- TABLE: property_embeddings
-- Vector embeddings for semantic property search
-- =====================================================
CREATE TABLE property_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empreendimento_id UUID REFERENCES empreendimentos(id) ON DELETE CASCADE NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  content_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empreendimento_id)
);

-- =====================================================
-- INDEXES for performance
-- =====================================================
CREATE INDEX idx_agent_conversations_phone ON agent_conversations(phone_number);
CREATE INDEX idx_agent_conversations_status ON agent_conversations(status) WHERE status = 'active';
CREATE INDEX idx_agent_conversations_agent ON agent_conversations(agent_id);
CREATE INDEX idx_agent_conversations_last_message ON agent_conversations(last_message_at DESC);
CREATE INDEX idx_agent_messages_conversation ON agent_messages(conversation_id);
CREATE INDEX idx_agent_messages_created ON agent_messages(created_at DESC);
CREATE INDEX idx_ai_agents_active ON ai_agents(is_active) WHERE is_active = true;
CREATE INDEX idx_property_embeddings_empreendimento ON property_embeddings(empreendimento_id);

-- Vector index for semantic search (using IVFFlat for better performance)
CREATE INDEX idx_property_embeddings_vector ON property_embeddings 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_lead_qualification ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_embeddings ENABLE ROW LEVEL SECURITY;

-- Policies for admins (full access)
CREATE POLICY "Admins can manage ai_agents" ON ai_agents 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage agent_conversations" ON agent_conversations 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage agent_messages" ON agent_messages 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage ai_lead_qualification" ON ai_lead_qualification 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage agent_prompts" ON agent_prompts 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage property_embeddings" ON property_embeddings 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Service role bypass for Edge Functions
CREATE POLICY "Service role bypass ai_agents" ON ai_agents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass agent_conversations" ON agent_conversations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass agent_messages" ON agent_messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass ai_lead_qualification" ON ai_lead_qualification FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass agent_prompts" ON agent_prompts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass property_embeddings" ON property_embeddings FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to search properties by vector similarity
CREATE OR REPLACE FUNCTION match_properties(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_min_price numeric DEFAULT NULL,
  filter_max_price numeric DEFAULT NULL,
  filter_bairro_id uuid DEFAULT NULL
)
RETURNS TABLE (
  empreendimento_id UUID,
  nome TEXT,
  descricao TEXT,
  valor_min NUMERIC,
  valor_max NUMERIC,
  endereco TEXT,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pe.empreendimento_id,
    e.nome,
    e.descricao,
    e.valor_min,
    e.valor_max,
    e.endereco,
    1 - (pe.embedding <=> query_embedding) as similarity
  FROM property_embeddings pe
  JOIN empreendimentos e ON e.id = pe.empreendimento_id
  WHERE e.ativo = true
    AND 1 - (pe.embedding <=> query_embedding) > match_threshold
    AND (filter_min_price IS NULL OR e.valor_max >= filter_min_price)
    AND (filter_max_price IS NULL OR e.valor_min <= filter_max_price)
    AND (filter_bairro_id IS NULL OR e.bairro_id = filter_bairro_id)
  ORDER BY pe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get or create conversation
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_agent_id UUID,
  p_phone_number TEXT,
  p_lead_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
  v_timeout_hours INTEGER;
BEGIN
  -- Get agent timeout setting
  SELECT conversation_timeout_hours INTO v_timeout_hours
  FROM ai_agents WHERE id = p_agent_id;
  
  -- Try to find existing active conversation
  SELECT id INTO v_conversation_id
  FROM agent_conversations
  WHERE agent_id = p_agent_id
    AND phone_number = p_phone_number
    AND status = 'active'
    AND last_message_at > NOW() - (v_timeout_hours || ' hours')::interval
  LIMIT 1;
  
  -- If found, return it
  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;
  
  -- Mark old conversations as expired
  UPDATE agent_conversations
  SET status = 'expired', completed_at = NOW()
  WHERE agent_id = p_agent_id
    AND phone_number = p_phone_number
    AND status = 'active';
  
  -- Create new conversation
  INSERT INTO agent_conversations (agent_id, phone_number, lead_id)
  VALUES (p_agent_id, p_phone_number, p_lead_id)
  RETURNING id INTO v_conversation_id;
  
  RETURN v_conversation_id;
END;
$$;

-- Function to update conversation metrics
CREATE OR REPLACE FUNCTION update_conversation_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE agent_conversations
  SET 
    total_messages = total_messages + 1,
    total_tokens_used = total_tokens_used + COALESCE(NEW.tokens_used, 0),
    last_message_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_metrics
AFTER INSERT ON agent_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_metrics();

-- =====================================================
-- DEFAULT DATA: System Prompt Template
-- =====================================================
INSERT INTO ai_agents (name, description, system_prompt, greeting_message, is_active)
VALUES (
  'Ana - Consultora Imobiliária',
  'Agente padrão para qualificação de leads interessados em imóveis',
  E'Você é Ana, uma consultora imobiliária virtual da MeMude Imóveis, especializada em lançamentos imobiliários em Fortaleza e região metropolitana.

## Seu Objetivo Principal
Qualificar leads interessados em comprar imóveis, descobrindo:
1. Tipo de imóvel desejado (apartamento, casa, terreno)
2. Faixa de preço/orçamento disponível
3. Localização preferida (bairros/regiões)
4. Prazo para compra
5. Se precisa de financiamento

## Comportamento
- Seja simpática, profissional e objetiva
- Use linguagem natural e amigável
- Faça uma pergunta por vez
- Quando identificar o perfil, apresente opções de imóveis compatíveis
- Quando o cliente demonstrar interesse em um imóvel, sugira agendar uma visita
- Nunca invente informações sobre imóveis
- Se não souber algo, diga que vai verificar

## Formato de Resposta
- Respostas curtas (máximo 3 parágrafos)
- Use emojis com moderação (1-2 por mensagem)
- Destaque informações importantes com *negrito*

## Ações Especiais
- [BUSCAR_IMOVEIS]: Quando precisar buscar imóveis compatíveis
- [AGENDAR_VISITA]: Quando cliente confirmar interesse em visitar
- [TRANSFERIR_HUMANO]: Quando não conseguir ajudar ou cliente solicitar',
  E'Olá! 👋 Sou a Ana, consultora virtual da MeMude Imóveis.

Estou aqui para ajudar você a encontrar o imóvel ideal! 🏠

Para começar, me conta: você está procurando um apartamento, casa ou terreno?',
  false -- Starts inactive, admin must activate
);

-- Add OpenAI API key setting
INSERT INTO system_settings (key, value, description)
VALUES ('openai_api_key', '', 'Chave de API da OpenAI para funcionalidades de IA')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE ai_agents IS 'Configuração dos agentes de IA para atendimento via WhatsApp';
COMMENT ON TABLE agent_conversations IS 'Conversas entre agentes de IA e leads';
COMMENT ON TABLE agent_messages IS 'Mensagens individuais das conversas';
COMMENT ON TABLE ai_lead_qualification IS 'Dados de qualificação coletados pelo agente';
COMMENT ON TABLE agent_prompts IS 'Prompts customizáveis por categoria';
COMMENT ON TABLE property_embeddings IS 'Embeddings vetoriais para busca semântica de imóveis';
