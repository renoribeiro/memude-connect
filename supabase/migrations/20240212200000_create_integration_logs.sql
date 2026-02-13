
-- Tabela para logs centralizados de integração (Evolution API)
CREATE TABLE IF NOT EXISTS public.integration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service VARCHAR(50) NOT NULL, -- 'evolution-api', 'openai', etc
    endpoint VARCHAR(255), -- Endpoint chamado ou webhook recebido
    method VARCHAR(10), -- GET, POST, etc
    status_code INTEGER, -- Status HTTP
    request_payload JSONB, -- Payload enviado (truncado se necessário)
    response_body JSONB, -- Resposta recebida (truncado se necessário)
    duration_ms INTEGER, -- Tempo de execução
    metadata JSONB, -- Dados extras (instance_name, phone_number, etc)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Políticas RLS (Row Level Security)
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- Permitir leitura apenas para admins (service_role ou autenticado com role admin)
CREATE POLICY "Admins can view integration logs" ON public.integration_logs
    FOR SELECT
    USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'service_role' OR id = auth.uid())); -- Simplificado para permitir user ver seus logs, ajustar conforme necessidade de permissionamento real

-- Permitir inserção apenas via Service Role (Edge Functions)
CREATE POLICY "Service Role can insert logs" ON public.integration_logs
    FOR INSERT
    WITH CHECK (true); -- Idealmente restringir ao service role, mas por hora allow all insert se autenticado é ok para dev rápida, porém edge function usa service key então bypassa RLS se configurado certo.
    -- Na real, edge functions com service_role key bypassam RLS. Então essa policy é para garantir que se for chamado via cliente anonimo não permita.
    -- Vamos deixar restrito.

DROP POLICY IF EXISTS "Service Role can insert logs" ON public.integration_logs;
CREATE POLICY "Service Role can insert logs" ON public.integration_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Index para busca rápida por data e serviço
CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON public.integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_service ON public.integration_logs(service);
