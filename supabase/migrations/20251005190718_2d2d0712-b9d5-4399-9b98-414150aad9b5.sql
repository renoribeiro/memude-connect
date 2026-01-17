-- Sprint 2 & 3: Tabelas para Cache, Métricas e Notificações

-- 1. Tabela de cache de verificação de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_number_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  exists_on_whatsapp BOOLEAN NOT NULL,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para busca rápida por número
CREATE INDEX idx_whatsapp_verification_phone ON whatsapp_number_verification(phone_number);
CREATE INDEX idx_whatsapp_verification_last_verified ON whatsapp_number_verification(last_verified_at);

-- RLS para whatsapp_number_verification
ALTER TABLE whatsapp_number_verification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode gerenciar verificações"
  ON whatsapp_number_verification
  FOR ALL
  USING (auth.email() = 'reno@re9.online');

CREATE POLICY "Usuários autenticados podem ler verificações"
  ON whatsapp_number_verification
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 2. Tabela de métricas de distribuição
CREATE TABLE IF NOT EXISTS distribution_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_distributions INTEGER DEFAULT 0,
  successful_distributions INTEGER DEFAULT 0,
  failed_distributions INTEGER DEFAULT 0,
  avg_response_time_minutes NUMERIC(10, 2),
  total_attempts INTEGER DEFAULT 0,
  total_timeouts INTEGER DEFAULT 0,
  total_accepts INTEGER DEFAULT 0,
  total_rejects INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para busca por data
CREATE INDEX idx_distribution_metrics_date ON distribution_metrics(date DESC);

-- RLS para distribution_metrics
ALTER TABLE distribution_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode gerenciar métricas"
  ON distribution_metrics
  FOR ALL
  USING (auth.email() = 'reno@re9.online');

CREATE POLICY "Usuários autenticados podem ler métricas"
  ON distribution_metrics
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 3. Adicionar campos para métricas de corretores
ALTER TABLE corretores 
ADD COLUMN IF NOT EXISTS total_accepts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_rejects INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_response_time_minutes NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- 4. Função para limpar cache antigo automaticamente
CREATE OR REPLACE FUNCTION cleanup_old_whatsapp_verification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove verificações com mais de 7 dias
  DELETE FROM whatsapp_number_verification 
  WHERE last_verified_at < NOW() - INTERVAL '7 days';
END;
$$;

-- 5. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_verification_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER whatsapp_verification_updated_at
BEFORE UPDATE ON whatsapp_number_verification
FOR EACH ROW
EXECUTE FUNCTION update_whatsapp_verification_updated_at();

CREATE TRIGGER distribution_metrics_updated_at
BEFORE UPDATE ON distribution_metrics
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Log de sucesso
DO $$
BEGIN
  RAISE NOTICE '✓ Sprint 2 & 3: Tabelas criadas com sucesso!';
  RAISE NOTICE '✓ whatsapp_number_verification - Cache de verificação';
  RAISE NOTICE '✓ distribution_metrics - Métricas de distribuição';
  RAISE NOTICE '✓ Campos adicionados em corretores para tracking';
  RAISE NOTICE '✓ RLS habilitado em todas as tabelas';
END $$;
