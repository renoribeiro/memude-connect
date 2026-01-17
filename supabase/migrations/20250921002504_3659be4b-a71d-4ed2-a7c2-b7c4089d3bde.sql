-- Tabela para configurações de distribuição automática
CREATE TABLE public.distribution_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timeout_minutes INTEGER NOT NULL DEFAULT 15,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  auto_distribution_enabled BOOLEAN NOT NULL DEFAULT true,
  notification_method TEXT NOT NULL DEFAULT 'whatsapp',
  fallback_to_admin BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Tabela para log de tentativas de distribuição
CREATE TABLE public.distribution_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id),
  corretor_id UUID NOT NULL REFERENCES public.corretores(id),
  attempt_order INTEGER NOT NULL,
  message_sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  response_received_at TIMESTAMP WITH TIME ZONE,
  response_type TEXT CHECK (response_type IN ('accepted', 'rejected', 'timeout')),
  response_message TEXT,
  timeout_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'timeout')),
  whatsapp_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para fila de distribuição
CREATE TABLE public.distribution_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id),
  current_attempt INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  assigned_corretor_id UUID REFERENCES public.corretores(id),
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.distribution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_queue ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para distribution_settings
CREATE POLICY "Admin users can manage distribution settings" 
ON public.distribution_settings 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

-- Políticas RLS para distribution_attempts
CREATE POLICY "Admin users can view all distribution attempts" 
ON public.distribution_attempts 
FOR SELECT 
USING (auth.email() = 'reno@re9.online');

CREATE POLICY "Corretores can view their own attempts" 
ON public.distribution_attempts 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles p 
  JOIN corretores c ON c.profile_id = p.id 
  WHERE p.user_id = auth.uid() AND c.id = distribution_attempts.corretor_id
));

-- Políticas RLS para distribution_queue
CREATE POLICY "Admin users can manage distribution queue" 
ON public.distribution_queue 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

CREATE POLICY "Corretores can view queue for their leads" 
ON public.distribution_queue 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles p 
  JOIN corretores c ON c.profile_id = p.id 
  WHERE p.user_id = auth.uid() AND c.id = distribution_queue.assigned_corretor_id
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_distribution_settings_updated_at
BEFORE UPDATE ON public.distribution_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configurações padrão do sistema
INSERT INTO public.system_settings (key, value, description) VALUES
('auto_distribution_enabled', 'true', 'Habilita distribuição automática de leads'),
('distribution_timeout_minutes', '15', 'Tempo limite em minutos para resposta do corretor'),
('distribution_max_attempts', '5', 'Número máximo de tentativas de distribuição'),
('whatsapp_distribution_enabled', 'true', 'Habilita distribuição via WhatsApp'),
('admin_notification_enabled', 'true', 'Habilita notificações para administrador em caso de falha');

-- Inserir configuração padrão na tabela distribution_settings
INSERT INTO public.distribution_settings (
  timeout_minutes, 
  max_attempts, 
  auto_distribution_enabled, 
  notification_method, 
  fallback_to_admin
) VALUES (15, 5, true, 'whatsapp', true);