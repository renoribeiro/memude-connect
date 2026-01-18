-- =====================================================
-- Enterprise Scale Migration
-- Phase 5: Enterprise Scale
-- =====================================================

-- =====================================================
-- Audit Logs (Compliance and Security)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who/What
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  
  -- Action
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- e.g., 'conversation', 'lead', 'agent', 'config'
  entity_id TEXT,
  
  -- Details
  previous_value JSONB,
  new_value JSONB,
  metadata JSONB DEFAULT '{}',
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  
  -- Retention
  is_sensitive BOOLEAN DEFAULT false,
  retention_days INTEGER DEFAULT 90,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by month for scalability
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_agent ON audit_logs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- =====================================================
-- Cache Configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS cache_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  cache_type TEXT NOT NULL CHECK (cache_type IN ('embedding', 'response', 'property', 'knowledge', 'config')),
  ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  max_size_bytes INTEGER,
  is_enabled BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Response Cache (for similar queries)
-- =====================================================
CREATE TABLE IF NOT EXISTS response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  query_text TEXT NOT NULL,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  
  -- Response
  response_text TEXT NOT NULL,
  tokens_used INTEGER,
  model_used TEXT,
  
  -- Metrics
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  
  -- TTL
  expires_at TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(agent_id, query_hash)
);

CREATE INDEX IF NOT EXISTS idx_response_cache_key ON response_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_response_cache_hash ON response_cache(agent_id, query_hash);
CREATE INDEX IF NOT EXISTS idx_response_cache_expires ON response_cache(expires_at);

-- =====================================================
-- Enhanced Knowledge Base (RAG 2.0)
-- =====================================================
ALTER TABLE agent_knowledge_base ADD COLUMN IF NOT EXISTS 
  chunk_index INTEGER DEFAULT 0;
ALTER TABLE agent_knowledge_base ADD COLUMN IF NOT EXISTS 
  total_chunks INTEGER DEFAULT 1;
ALTER TABLE agent_knowledge_base ADD COLUMN IF NOT EXISTS 
  parent_document_id UUID REFERENCES agent_knowledge_base(id) ON DELETE CASCADE;
ALTER TABLE agent_knowledge_base ADD COLUMN IF NOT EXISTS 
  summary TEXT;
ALTER TABLE agent_knowledge_base ADD COLUMN IF NOT EXISTS 
  keywords TEXT[];
ALTER TABLE agent_knowledge_base ADD COLUMN IF NOT EXISTS 
  relevance_boost NUMERIC(3,2) DEFAULT 1.0;
ALTER TABLE agent_knowledge_base ADD COLUMN IF NOT EXISTS 
  last_accessed_at TIMESTAMPTZ;
ALTER TABLE agent_knowledge_base ADD COLUMN IF NOT EXISTS 
  access_count INTEGER DEFAULT 0;

-- =====================================================
-- System Health Metrics
-- =====================================================
CREATE TABLE IF NOT EXISTS system_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL CHECK (metric_type IN (
    'api_latency',
    'llm_latency',
    'db_latency',
    'cache_hit_rate',
    'error_rate',
    'throughput',
    'memory_usage',
    'token_usage'
  )),
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'ms',
  tags JSONB DEFAULT '{}',
  
  -- Time bucket (for aggregation)
  bucket_time TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', NOW()),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_metrics_type_time ON system_health_metrics(metric_type, bucket_time DESC);
CREATE INDEX IF NOT EXISTS idx_health_metrics_bucket ON system_health_metrics(bucket_time DESC);

-- =====================================================
-- Rate Limiting
-- =====================================================
CREATE TABLE IF NOT EXISTS rate_limit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_key TEXT UNIQUE NOT NULL, -- e.g., 'api_calls', 'llm_tokens', 'messages_per_hour'
  limit_type TEXT NOT NULL CHECK (limit_type IN ('per_minute', 'per_hour', 'per_day', 'per_month')),
  max_value INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default rate limits
INSERT INTO rate_limit_config (limit_key, limit_type, max_value, window_seconds, description)
VALUES 
  ('api_calls_per_minute', 'per_minute', 60, 60, 'API calls per minute per IP'),
  ('llm_tokens_per_day', 'per_day', 1000000, 86400, 'LLM tokens per day per agent'),
  ('messages_per_hour', 'per_hour', 100, 3600, 'Messages per hour per conversation')
ON CONFLICT (limit_key) DO NOTHING;

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_config ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can read audit_logs" ON audit_logs 
  FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage cache_config" ON cache_config 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage response_cache" ON response_cache 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage system_health_metrics" ON system_health_metrics 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage rate_limit_config" ON rate_limit_config 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Service role bypass
CREATE POLICY "Service role bypass audit_logs" ON audit_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass cache_config" ON cache_config FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass response_cache" ON response_cache FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass system_health_metrics" ON system_health_metrics FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass rate_limit_config" ON rate_limit_config FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- Function: Write Audit Log
-- =====================================================
CREATE OR REPLACE FUNCTION write_audit_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL,
  p_previous_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    agent_id,
    conversation_id,
    action,
    entity_type,
    entity_id,
    previous_value,
    new_value,
    metadata
  ) VALUES (
    p_user_id,
    p_agent_id,
    p_conversation_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_previous_value,
    p_new_value,
    p_metadata
  ) RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- =====================================================
-- Function: Get/Set Cache
-- =====================================================
CREATE OR REPLACE FUNCTION get_cached_response(
  p_agent_id UUID,
  p_query_text TEXT
)
RETURNS TABLE (
  response_text TEXT,
  tokens_used INTEGER,
  is_fresh BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  v_hash := md5(lower(trim(p_query_text)));
  
  RETURN QUERY
  SELECT 
    rc.response_text,
    rc.tokens_used,
    (rc.expires_at > NOW()) as is_fresh
  FROM response_cache rc
  WHERE rc.agent_id = p_agent_id
    AND rc.query_hash = v_hash
    AND rc.expires_at > NOW()
  LIMIT 1;
  
  -- Update hit count
  UPDATE response_cache
  SET hit_count = hit_count + 1,
      last_hit_at = NOW()
  WHERE agent_id = p_agent_id
    AND query_hash = v_hash;
END;
$$;

CREATE OR REPLACE FUNCTION set_cached_response(
  p_agent_id UUID,
  p_query_text TEXT,
  p_response_text TEXT,
  p_tokens_used INTEGER DEFAULT 0,
  p_model_used TEXT DEFAULT NULL,
  p_ttl_seconds INTEGER DEFAULT 3600
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_hash TEXT;
BEGIN
  v_hash := md5(lower(trim(p_query_text)));
  
  INSERT INTO response_cache (
    cache_key,
    query_hash,
    query_text,
    agent_id,
    response_text,
    tokens_used,
    model_used,
    expires_at
  ) VALUES (
    'response:' || p_agent_id || ':' || v_hash,
    v_hash,
    p_query_text,
    p_agent_id,
    p_response_text,
    p_tokens_used,
    p_model_used,
    NOW() + (p_ttl_seconds || ' seconds')::interval
  )
  ON CONFLICT (agent_id, query_hash) 
  DO UPDATE SET
    response_text = EXCLUDED.response_text,
    tokens_used = EXCLUDED.tokens_used,
    model_used = EXCLUDED.model_used,
    expires_at = EXCLUDED.expires_at,
    hit_count = 0
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- =====================================================
-- Function: Enhanced Knowledge Search
-- =====================================================
CREATE OR REPLACE FUNCTION search_knowledge_enhanced(
  p_agent_id UUID,
  p_query_embedding VECTOR(1536),
  p_limit INTEGER DEFAULT 5,
  p_min_similarity NUMERIC DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  similarity NUMERIC,
  keywords TEXT[],
  relevance_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    (1 - (kb.embedding <=> p_query_embedding))::NUMERIC as similarity,
    kb.keywords,
    -- Combine similarity with relevance boost and access patterns
    ((1 - (kb.embedding <=> p_query_embedding)) * kb.relevance_boost * 
     (1 + LEAST(kb.access_count, 100) / 500.0))::NUMERIC as relevance_score
  FROM agent_knowledge_base kb
  WHERE kb.agent_id = p_agent_id
    AND kb.is_active = true
    AND (1 - (kb.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY relevance_score DESC
  LIMIT p_limit;
  
  -- Update access statistics
  UPDATE agent_knowledge_base
  SET access_count = access_count + 1,
      last_accessed_at = NOW()
  WHERE agent_id = p_agent_id
    AND id IN (
      SELECT kb2.id FROM agent_knowledge_base kb2
      WHERE kb2.agent_id = p_agent_id
        AND kb2.is_active = true
        AND (1 - (kb2.embedding <=> p_query_embedding)) >= p_min_similarity
      LIMIT p_limit
    );
END;
$$;

-- =====================================================
-- Function: Get System Health Summary
-- =====================================================
CREATE OR REPLACE FUNCTION get_system_health_summary(
  p_hours INTEGER DEFAULT 1
)
RETURNS TABLE (
  metric_type TEXT,
  avg_value NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  p95_value NUMERIC,
  sample_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    shm.metric_type,
    ROUND(AVG(shm.value), 2) as avg_value,
    ROUND(MIN(shm.value), 2) as min_value,
    ROUND(MAX(shm.value), 2) as max_value,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY shm.value)::NUMERIC, 2) as p95_value,
    COUNT(*) as sample_count
  FROM system_health_metrics shm
  WHERE shm.bucket_time >= NOW() - (p_hours || ' hours')::interval
  GROUP BY shm.metric_type
  ORDER BY shm.metric_type;
END;
$$;

-- =====================================================
-- Function: Cleanup Expired Data
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS TABLE (
  table_name TEXT,
  rows_deleted BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cache_deleted BIGINT;
  v_metrics_deleted BIGINT;
  v_audit_deleted BIGINT;
BEGIN
  -- Clean expired cache
  DELETE FROM response_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS v_cache_deleted = ROW_COUNT;
  
  -- Clean old metrics (keep 7 days)
  DELETE FROM system_health_metrics WHERE bucket_time < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS v_metrics_deleted = ROW_COUNT;
  
  -- Clean old audit logs based on retention
  DELETE FROM audit_logs 
  WHERE created_at < NOW() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;
  
  RETURN QUERY
  SELECT 'response_cache'::TEXT, v_cache_deleted
  UNION ALL
  SELECT 'system_health_metrics'::TEXT, v_metrics_deleted
  UNION ALL
  SELECT 'audit_logs'::TEXT, v_audit_deleted;
END;
$$;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE audit_logs IS 'Audit trail for compliance and security monitoring';
COMMENT ON TABLE cache_config IS 'Configuration for different cache types';
COMMENT ON TABLE response_cache IS 'Cache for similar LLM queries to reduce costs';
COMMENT ON TABLE system_health_metrics IS 'Time-series health metrics for monitoring';
COMMENT ON TABLE rate_limit_config IS 'Rate limiting configuration';
