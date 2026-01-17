-- Sprint 2: Melhorias Técnicas
-- Tarefa 2.1: Rate Limiting
-- Tarefa 2.3: Logging Estruturado

-- ============================================
-- TAREFA 2.1: TABELA DE RATE LIMITING
-- ============================================

-- Tabela para controle de rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 minute'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para cleanup automático de registros expirados
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

-- Comentário descritivo
COMMENT ON TABLE rate_limits IS 'Controle de rate limiting por chave (corretor, função, etc)';

-- Função para incrementar rate limit e validar
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_key TEXT, 
  p_max INTEGER DEFAULT 10,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(current_count INTEGER, is_allowed BOOLEAN) AS $$
DECLARE
  v_count INTEGER;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_expires_at := NOW() + (p_window_seconds || ' seconds')::INTERVAL;
  
  -- Insere ou atualiza o contador
  INSERT INTO rate_limits (key, count, expires_at) 
  VALUES (p_key, 1, v_expires_at)
  ON CONFLICT (key) 
  DO UPDATE SET 
    count = CASE 
      WHEN rate_limits.expires_at < NOW() THEN 1  -- Reset se expirou
      ELSE rate_limits.count + 1  -- Incrementa se ainda válido
    END,
    expires_at = CASE
      WHEN rate_limits.expires_at < NOW() THEN v_expires_at  -- Nova janela
      ELSE rate_limits.expires_at  -- Mantém janela atual
    END
  RETURNING count INTO v_count;
  
  -- Retorna contador atual e se está permitido
  RETURN QUERY SELECT v_count, (v_count <= p_max);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para limpar rate limits expirados (chamada por cron)
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limits 
  WHERE expires_at < NOW() - INTERVAL '5 minutes';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- TAREFA 2.3: TABELA DE LOGGING ESTRUTURADO
-- ============================================

-- Enum para níveis de log
CREATE TYPE log_level AS ENUM ('debug', 'info', 'warn', 'error', 'critical');

-- Tabela para logs estruturados da aplicação
CREATE TABLE IF NOT EXISTS application_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level log_level NOT NULL,
  function_name TEXT NOT NULL,
  event TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  corretor_id UUID REFERENCES corretores(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  error_stack TEXT,
  request_id TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries comuns
CREATE INDEX IF NOT EXISTS idx_application_logs_timestamp ON application_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_application_logs_level ON application_logs(level);
CREATE INDEX IF NOT EXISTS idx_application_logs_function ON application_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_application_logs_user ON application_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_application_logs_event ON application_logs(event);

-- Índice GIN para busca em metadata
CREATE INDEX IF NOT EXISTS idx_application_logs_metadata ON application_logs USING GIN(metadata);

-- Comentário descritivo
COMMENT ON TABLE application_logs IS 'Logs estruturados de edge functions e eventos do sistema';

-- Função para cleanup automático de logs antigos (>30 dias)
CREATE OR REPLACE FUNCTION cleanup_old_application_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM application_logs 
  WHERE timestamp < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Rate Limits: apenas service role pode acessar
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage rate limits" 
ON rate_limits FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Application Logs: admin pode ler, service role pode inserir
ALTER TABLE application_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read all logs" 
ON application_logs FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert logs" 
ON application_logs FOR INSERT 
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can read their own error logs" 
ON application_logs FOR SELECT 
USING (
  user_id = auth.uid() 
  AND level IN ('error', 'critical')
);

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- View para resumo de rate limits ativos
CREATE OR REPLACE VIEW active_rate_limits AS
SELECT 
  key,
  count,
  expires_at,
  (expires_at - NOW()) AS time_remaining,
  CASE 
    WHEN count >= 10 THEN 'blocked'
    WHEN count >= 7 THEN 'warning'
    ELSE 'ok'
  END AS status
FROM rate_limits
WHERE expires_at > NOW()
ORDER BY count DESC;

GRANT SELECT ON active_rate_limits TO authenticated;

-- View para análise de erros recentes
CREATE OR REPLACE VIEW recent_errors AS
SELECT 
  timestamp,
  level,
  function_name,
  event,
  message,
  metadata,
  user_id,
  corretor_id,
  lead_id
FROM application_logs
WHERE level IN ('error', 'critical')
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

GRANT SELECT ON recent_errors TO authenticated;

-- Log de sucesso
DO $$
BEGIN
  RAISE NOTICE 'Sprint 2 - Tabelas de Rate Limiting e Logging criadas com sucesso!';
END $$;