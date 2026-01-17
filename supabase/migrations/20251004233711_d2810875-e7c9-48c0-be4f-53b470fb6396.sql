-- Criar enum para tipos de notificação
CREATE TYPE notification_type AS ENUM (
  'new_lead',
  'lead_distributed',
  'lead_accepted',
  'lead_rejected',
  'lead_timeout',
  'new_visit',
  'visit_confirmed',
  'visit_completed',
  'visit_cancelled',
  'distribution_timeout',
  'system_alert',
  'info'
);

-- Criar tabela de notificações
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  related_lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  related_visit_id UUID REFERENCES public.visitas(id) ON DELETE CASCADE,
  related_corretor_id UUID REFERENCES public.corretores(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Criar índices para performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON public.notifications(type);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Usuários podem ver apenas suas próprias notificações
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Usuários podem marcar suas próprias notificações como lidas
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admin pode ver todas as notificações
CREATE POLICY "Admin can view all notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  auth.email() = 'reno@re9.online'
);

-- Service role pode inserir notificações (para edge functions)
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Função para limpar notificações antigas (30 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications 
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND read = true;
END;
$$;

-- Função helper para criar notificação
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type notification_type,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_related_lead_id UUID DEFAULT NULL,
  p_related_visit_id UUID DEFAULT NULL,
  p_related_corretor_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    metadata,
    related_lead_id,
    related_visit_id,
    related_corretor_id
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_metadata,
    p_related_lead_id,
    p_related_visit_id,
    p_related_corretor_id
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Habilitar realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;