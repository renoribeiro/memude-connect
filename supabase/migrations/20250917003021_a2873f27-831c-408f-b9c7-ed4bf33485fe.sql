-- Criar tabelas para templates de relatórios
CREATE TABLE public.report_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_config JSONB NOT NULL,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_public BOOLEAN NOT NULL DEFAULT false,
  category TEXT NOT NULL DEFAULT 'custom'
);

-- Habilitar RLS
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- Políticas para report_templates
CREATE POLICY "Users can view public templates or their own templates" 
ON public.report_templates 
FOR SELECT 
USING (is_public = true OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.id = report_templates.created_by
));

CREATE POLICY "Users can create their own templates" 
ON public.report_templates 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.id = report_templates.created_by
));

CREATE POLICY "Users can update their own templates" 
ON public.report_templates 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.id = report_templates.created_by
));

CREATE POLICY "Admin users can manage all templates" 
ON public.report_templates 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

-- Criar tabela para relatórios agendados
CREATE TABLE public.scheduled_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_template_id UUID REFERENCES public.report_templates(id) ON DELETE CASCADE NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'quarterly')),
  recipients JSONB NOT NULL, -- Array de emails
  email_subject TEXT NOT NULL,
  email_message TEXT,
  next_run TIMESTAMP WITH TIME ZONE NOT NULL,
  last_run TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Políticas para scheduled_reports
CREATE POLICY "Users can view their own scheduled reports" 
ON public.scheduled_reports 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.id = scheduled_reports.created_by
));

CREATE POLICY "Users can create their own scheduled reports" 
ON public.scheduled_reports 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.id = scheduled_reports.created_by
));

CREATE POLICY "Users can update their own scheduled reports" 
ON public.scheduled_reports 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.id = scheduled_reports.created_by
));

CREATE POLICY "Admin users can manage all scheduled reports" 
ON public.scheduled_reports 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

-- Criar tabela para logs de auditoria
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para audit_logs
CREATE POLICY "Admin users can view all audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (auth.email() = 'reno@re9.online');

-- Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.id = audit_logs.user_id
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_report_templates_updated_at
BEFORE UPDATE ON public.report_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at
BEFORE UPDATE ON public.scheduled_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir templates padrão
INSERT INTO public.report_templates (name, description, template_config, created_by, is_public, category) VALUES
('Relatório de Performance de Corretores', 'Análise detalhada da performance dos corretores', 
 '{"charts": ["corretor_performance", "visitas_by_corretor"], "metrics": ["total_leads", "conversion_rate"], "period": "monthly"}',
 (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1), true, 'performance'),
('Análise de Conversão de Leads', 'Taxa de conversão e funil de vendas', 
 '{"charts": ["conversion_funnel", "leads_by_status"], "metrics": ["conversion_rate", "total_leads"], "period": "monthly"}',
 (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1), true, 'leads'),
('Relatório Financeiro Mensal', 'Resumo financeiro e performance de vendas', 
 '{"charts": ["revenue_trend", "empreendimentos_performance"], "metrics": ["total_revenue", "avg_ticket"], "period": "monthly"}',
 (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1), true, 'financial'),
('ROI por Fonte de Lead', 'Análise de retorno sobre investimento por canal', 
 '{"charts": ["roi_by_source", "lead_sources"], "metrics": ["roi", "cost_per_lead"], "period": "quarterly"}',
 (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1), true, 'marketing'),
('Relatório de Satisfação do Cliente', 'Avaliações e feedback dos clientes', 
 '{"charts": ["satisfaction_trend", "ratings_distribution"], "metrics": ["avg_rating", "nps"], "period": "monthly"}',
 (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1), true, 'satisfaction');