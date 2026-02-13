
-- Tabela para fila de mensagens (Async WhatsApp)
CREATE TABLE IF NOT EXISTS public.message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID REFERENCES public.evolution_instances(id), -- Opcional, se nulo usa a ativa/default
    phone_number VARCHAR(20) NOT NULL,
    message_body JSONB NOT NULL, -- Payload completo da mensagem (tipo, text, media, etc)
    priority INT DEFAULT 0, -- Maior número = maior prioridade
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    attempts INT DEFAULT 0,
    last_attempt TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_message_queue_status_created ON public.message_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_message_queue_phone ON public.message_queue(phone_number);

-- RLS
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Service Role can manage queue" ON public.message_queue
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Permissão para admins verem a fila (debugging)
CREATE POLICY "Admins can view queue" ON public.message_queue
    FOR SELECT
    USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'service_role' OR id = auth.uid()));
