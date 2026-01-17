-- Criar tabela para logs de webhook
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  instance_name TEXT,
  payload JSONB NOT NULL,
  processed_successfully BOOLEAN DEFAULT false,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_instance ON webhook_logs(instance_name);

-- RLS
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Admin pode visualizar e gerenciar logs de webhook
CREATE POLICY "Admin pode gerenciar logs de webhook"
  ON webhook_logs FOR ALL
  TO authenticated
  USING (auth.email() = 'reno@re9.online');

-- Comentário na tabela
COMMENT ON TABLE webhook_logs IS 'Armazena logs de todos os webhooks recebidos da Evolution API para monitoramento e debugging';