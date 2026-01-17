-- FASE 1: Database Adjustments for Visit Distribution System

-- 1. Add tipo_imovel column to empreendimentos table
ALTER TABLE public.empreendimentos 
ADD COLUMN tipo_imovel tipo_imovel_enum DEFAULT 'todos';

COMMENT ON COLUMN public.empreendimentos.tipo_imovel IS 'Tipo de imóvel do empreendimento para matching com corretores';

-- 2. Create visit_distribution_queue table
CREATE TABLE public.visit_distribution_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visita_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  current_attempt INTEGER NOT NULL DEFAULT 1,
  assigned_corretor_id UUID,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_visit_distribution_queue_visita 
    FOREIGN KEY (visita_id) REFERENCES public.visitas(id) ON DELETE CASCADE,
  CONSTRAINT fk_visit_distribution_queue_corretor 
    FOREIGN KEY (assigned_corretor_id) REFERENCES public.corretores(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.visit_distribution_queue IS 'Fila de distribuição automática de visitas para corretores';

-- Enable RLS on visit_distribution_queue
ALTER TABLE public.visit_distribution_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for visit_distribution_queue
CREATE POLICY "Admin users can manage visit distribution queue"
  ON public.visit_distribution_queue
  FOR ALL
  USING (auth.email() = 'reno@re9.online');

CREATE POLICY "Corretores can view queue for their visits"
  ON public.visit_distribution_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN corretores c ON c.profile_id = p.id
      WHERE p.user_id = auth.uid() 
      AND c.id = visit_distribution_queue.assigned_corretor_id
    )
  );

-- 3. Create visit_distribution_attempts table
CREATE TABLE public.visit_distribution_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visita_id UUID NOT NULL,
  corretor_id UUID NOT NULL,
  attempt_order INTEGER NOT NULL,
  message_sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  timeout_at TIMESTAMP WITH TIME ZONE NOT NULL,
  response_received_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'timeout', 'error')),
  response_message TEXT,
  response_type TEXT,
  whatsapp_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_visit_distribution_attempts_visita 
    FOREIGN KEY (visita_id) REFERENCES public.visitas(id) ON DELETE CASCADE,
  CONSTRAINT fk_visit_distribution_attempts_corretor 
    FOREIGN KEY (corretor_id) REFERENCES public.corretores(id) ON DELETE CASCADE,
  CONSTRAINT unique_visita_corretor_attempt 
    UNIQUE (visita_id, corretor_id, attempt_order)
);

COMMENT ON TABLE public.visit_distribution_attempts IS 'Histórico de tentativas de distribuição de visitas para corretores';

-- Enable RLS on visit_distribution_attempts
ALTER TABLE public.visit_distribution_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for visit_distribution_attempts
CREATE POLICY "Admin users can view all visit distribution attempts"
  ON public.visit_distribution_attempts
  FOR SELECT
  USING (auth.email() = 'reno@re9.online');

CREATE POLICY "Corretores can view their own attempts"
  ON public.visit_distribution_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN corretores c ON c.profile_id = p.id
      WHERE p.user_id = auth.uid() 
      AND c.id = visit_distribution_attempts.corretor_id
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_visit_distribution_queue_visita ON public.visit_distribution_queue(visita_id);
CREATE INDEX idx_visit_distribution_queue_status ON public.visit_distribution_queue(status);
CREATE INDEX idx_visit_distribution_queue_corretor ON public.visit_distribution_queue(assigned_corretor_id);

CREATE INDEX idx_visit_distribution_attempts_visita ON public.visit_distribution_attempts(visita_id);
CREATE INDEX idx_visit_distribution_attempts_corretor ON public.visit_distribution_attempts(corretor_id);
CREATE INDEX idx_visit_distribution_attempts_status ON public.visit_distribution_attempts(status);
CREATE INDEX idx_visit_distribution_attempts_timeout ON public.visit_distribution_attempts(timeout_at) WHERE status = 'pending';