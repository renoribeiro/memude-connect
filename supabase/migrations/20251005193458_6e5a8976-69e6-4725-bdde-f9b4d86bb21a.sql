-- ================================================
-- FASE 1 & 2: SECURITY FIXES - USER ROLES TABLE (CORRIGIDO)
-- ================================================

-- Step 1: Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'corretor', 'cliente');

-- Step 2: Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 4: Migrate existing role data from profiles to user_roles
-- Convert text to app_role enum
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT 
  user_id, 
  CASE role::text
    WHEN 'admin' THEN 'admin'::public.app_role
    WHEN 'corretor' THEN 'corretor'::public.app_role
    WHEN 'cliente' THEN 'cliente'::public.app_role
  END as role,
  created_at
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 5: Create RLS policies for user_roles table
CREATE POLICY "Admin can manage all user roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Step 6: Update ALL RLS policies to use has_role function

-- ============= AUDIT LOGS =============
DROP POLICY IF EXISTS "Admin users can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;

CREATE POLICY "Admin users can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own audit logs"
ON public.audit_logs
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.id = audit_logs.user_id
  ))
);

-- ============= BAIRROS =============
DROP POLICY IF EXISTS "Admin users can manage bairros" ON public.bairros;

CREATE POLICY "Admin users can manage bairros"
ON public.bairros
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= COMMUNICATION_LOG =============
DROP POLICY IF EXISTS "Admin users can manage all communication_log" ON public.communication_log;

CREATE POLICY "Admin users can manage all communication_log"
ON public.communication_log
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= CONSTRUTORAS =============
DROP POLICY IF EXISTS "Admin users can manage construtoras" ON public.construtoras;

CREATE POLICY "Admin users can manage construtoras"
ON public.construtoras
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= CORRETOR_BAIRROS =============
DROP POLICY IF EXISTS "Admin users can manage corretor_bairros" ON public.corretor_bairros;

CREATE POLICY "Admin users can manage corretor_bairros"
ON public.corretor_bairros
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= CORRETOR_CONSTRUTORAS =============
DROP POLICY IF EXISTS "Admin users can manage corretor_construtoras" ON public.corretor_construtoras;

CREATE POLICY "Admin users can manage corretor_construtoras"
ON public.corretor_construtoras
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= CORRETORES =============
DROP POLICY IF EXISTS "Admin users can manage all corretores including deleted" ON public.corretores;

CREATE POLICY "Admin users can manage all corretores including deleted"
ON public.corretores
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= DISTRIBUTION_ATTEMPTS =============
DROP POLICY IF EXISTS "Admin users can view all distribution attempts" ON public.distribution_attempts;

CREATE POLICY "Admin users can view all distribution attempts"
ON public.distribution_attempts
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- ============= DISTRIBUTION_METRICS =============
DROP POLICY IF EXISTS "Admin pode gerenciar métricas" ON public.distribution_metrics;

CREATE POLICY "Admin pode gerenciar métricas"
ON public.distribution_metrics
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= DISTRIBUTION_QUEUE =============
DROP POLICY IF EXISTS "Admin users can manage distribution queue" ON public.distribution_queue;

CREATE POLICY "Admin users can manage distribution queue"
ON public.distribution_queue
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= DISTRIBUTION_SETTINGS =============
DROP POLICY IF EXISTS "Admin users can manage distribution settings" ON public.distribution_settings;

CREATE POLICY "Admin users can manage distribution settings"
ON public.distribution_settings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= EMPREENDIMENTOS =============
DROP POLICY IF EXISTS "Admin users can manage empreendimentos" ON public.empreendimentos;

CREATE POLICY "Admin users can manage empreendimentos"
ON public.empreendimentos
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= LEAD_DISTRIBUTION_LOG =============
DROP POLICY IF EXISTS "Admin users can manage lead_distribution_log" ON public.lead_distribution_log;

CREATE POLICY "Admin users can manage lead_distribution_log"
ON public.lead_distribution_log
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= LEADS =============
DROP POLICY IF EXISTS "Admin users can manage all leads" ON public.leads;

CREATE POLICY "Admin users can manage all leads"
ON public.leads
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= MESSAGE_TEMPLATES =============
DROP POLICY IF EXISTS "Admin users can manage all templates" ON public.message_templates;

CREATE POLICY "Admin users can manage all templates"
ON public.message_templates
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= NOTIFICATIONS =============
DROP POLICY IF EXISTS "Admin can view all notifications" ON public.notifications;

CREATE POLICY "Admin can view all notifications"
ON public.notifications
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- ============= PROFILES =============
DROP POLICY IF EXISTS "Admin users can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin users can view all profiles" ON public.profiles;

CREATE POLICY "Admin users can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE POLICY "Admin users can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

-- ============= REPORT_TEMPLATES =============
DROP POLICY IF EXISTS "Admin users can manage all templates" ON public.report_templates;

CREATE POLICY "Admin users can manage all templates"
ON public.report_templates
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= SCHEDULED_REPORTS =============
DROP POLICY IF EXISTS "Admin users can manage all scheduled reports" ON public.scheduled_reports;

CREATE POLICY "Admin users can manage all scheduled reports"
ON public.scheduled_reports
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= SYSTEM_SETTINGS =============
-- CRITICAL FIX: Restrict system_settings access to admin only
DROP POLICY IF EXISTS "Allow authenticated and service role to read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admin users can update system settings" ON public.system_settings;

CREATE POLICY "Admin users can manage system settings"
ON public.system_settings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Allow service role to read settings (for edge functions)
CREATE POLICY "Service role can read system settings"
ON public.system_settings
FOR SELECT
USING (auth.jwt()->>'role' = 'service_role');

-- ============= TEMPLATE_VARIABLES =============
DROP POLICY IF EXISTS "Admin users can manage all variables" ON public.template_variables;

CREATE POLICY "Admin users can manage all variables"
ON public.template_variables
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= VISIT_DISTRIBUTION_ATTEMPTS =============
DROP POLICY IF EXISTS "Admin users can view all visit distribution attempts" ON public.visit_distribution_attempts;

CREATE POLICY "Admin users can view all visit distribution attempts"
ON public.visit_distribution_attempts
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- ============= VISIT_DISTRIBUTION_QUEUE =============
DROP POLICY IF EXISTS "Admin users can manage visit distribution queue" ON public.visit_distribution_queue;

CREATE POLICY "Admin users can manage visit distribution queue"
ON public.visit_distribution_queue
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= VISITAS =============
DROP POLICY IF EXISTS "Admin users can manage all visitas" ON public.visitas;

CREATE POLICY "Admin users can manage all visitas"
ON public.visitas
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= WEBHOOK_LOGS =============
DROP POLICY IF EXISTS "Admin pode gerenciar logs de webhook" ON public.webhook_logs;

CREATE POLICY "Admin pode gerenciar logs de webhook"
ON public.webhook_logs
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= WHATSAPP_NUMBER_VERIFICATION =============
DROP POLICY IF EXISTS "Admin pode gerenciar verificações" ON public.whatsapp_number_verification;

CREATE POLICY "Admin pode gerenciar verificações"
ON public.whatsapp_number_verification
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= WP_CATEGORIES_CACHE =============
DROP POLICY IF EXISTS "Admin users can manage wp_categories_cache" ON public.wp_categories_cache;

CREATE POLICY "Admin users can manage wp_categories_cache"
ON public.wp_categories_cache
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= WP_SYNC_LOG =============
DROP POLICY IF EXISTS "Admin users can manage wp_sync_log" ON public.wp_sync_log;

CREATE POLICY "Admin users can manage wp_sync_log"
ON public.wp_sync_log
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============= WP_SYNC_PERFORMANCE =============
DROP POLICY IF EXISTS "Admin users can manage wp_sync_performance" ON public.wp_sync_performance;

CREATE POLICY "Admin users can manage wp_sync_performance"
ON public.wp_sync_performance
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Step 7: Add index for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- Step 8: Add helpful comments
COMMENT ON TABLE public.user_roles IS 'Stores user roles separately from profiles to prevent privilege escalation attacks';
COMMENT ON FUNCTION public.has_role IS 'Security definer function to check if a user has a specific role without triggering RLS recursion';