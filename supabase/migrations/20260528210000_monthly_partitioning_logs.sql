-- =====================================================
-- Migration: Onda 3 - Monthly Partitioning & SQL Optimization (P2)
-- Date: 2026-05-28
-- Description:
-- 1. Partition central log tables (integration_logs and audit_logs) by month.
-- 2. Create high-performance indexes for CRM, distribution, and timeouts.
-- 3. Mitigate RLS loop recursion by creating SECURITY DEFINER helper functions.
-- =====================================================

-- ==========================================
-- 1. PARTITIONING CENTRAL LOGS
-- ==========================================

-- A. Rename old tables to backup names
ALTER TABLE IF EXISTS public.integration_logs RENAME TO integration_logs_old;
ALTER TABLE IF EXISTS public.audit_logs RENAME TO audit_logs_old;

-- B. Create new parent partitioned table for integration_logs
CREATE TABLE public.integration_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    service VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    request_payload JSONB,
    response_body JSONB,
    duration_ms INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- C. Create monthly partitions for integration_logs
CREATE TABLE public.integration_logs_default PARTITION OF public.integration_logs DEFAULT;

CREATE TABLE public.integration_logs_y2026m05 PARTITION OF public.integration_logs
    FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');

CREATE TABLE public.integration_logs_y2026m06 PARTITION OF public.integration_logs
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

CREATE TABLE public.integration_logs_y2026m07 PARTITION OF public.integration_logs
    FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');

CREATE TABLE public.integration_logs_y2026m08 PARTITION OF public.integration_logs
    FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');

CREATE TABLE public.integration_logs_y2026m09 PARTITION OF public.integration_logs
    FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

CREATE TABLE public.integration_logs_y2026m10 PARTITION OF public.integration_logs
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

CREATE TABLE public.integration_logs_y2026m11 PARTITION OF public.integration_logs
    FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');

CREATE TABLE public.integration_logs_y2026m12 PARTITION OF public.integration_logs
    FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

-- D. Create new parent partitioned table for audit_logs (Using actual active 2025 DB Schema)
CREATE TABLE public.audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- E. Create monthly partitions for audit_logs
CREATE TABLE public.audit_logs_default PARTITION OF public.audit_logs DEFAULT;

CREATE TABLE public.audit_logs_y2026m05 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');

CREATE TABLE public.audit_logs_y2026m06 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

CREATE TABLE public.audit_logs_y2026m07 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');

CREATE TABLE public.audit_logs_y2026m08 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');

CREATE TABLE public.audit_logs_y2026m09 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

CREATE TABLE public.audit_logs_y2026m10 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

CREATE TABLE public.audit_logs_y2026m11 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');

CREATE TABLE public.audit_logs_y2026m12 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

-- F. Migrate existing logs safely
INSERT INTO public.integration_logs (id, service, endpoint, method, status_code, request_payload, response_body, duration_ms, metadata, created_at)
SELECT id, service, endpoint, method, status_code, request_payload, response_body, duration_ms, metadata, created_at
FROM public.integration_logs_old;

INSERT INTO public.audit_logs (id, user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at)
SELECT id, user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at
FROM public.audit_logs_old;

-- G. Safely drop old tables
DROP TABLE IF EXISTS public.integration_logs_old CASCADE;
DROP TABLE IF EXISTS public.audit_logs_old CASCADE;

-- H. Configure RLS & Policies on parent integration_logs
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view integration logs" ON public.integration_logs
    FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service Role can insert logs" ON public.integration_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- I. Configure RLS & Policies on parent audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit_logs" ON public.audit_logs
    FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role bypass audit_logs" ON public.audit_logs
    FOR ALL
    USING (auth.role() = 'service_role');

-- J. Re-create default parent indexes (propagated automatically to partitions)
CREATE INDEX idx_integration_logs_created_at ON public.integration_logs(created_at DESC);
CREATE INDEX idx_integration_logs_service ON public.integration_logs(service);

CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);


-- ==========================================
-- 2. HIGH-PERFORMANCE INDEXING
-- ==========================================

-- A. Foreign Key coverage indexes
CREATE INDEX IF NOT EXISTS idx_leads_corretor_designado_cov 
ON public.leads(corretor_designado_id) 
WHERE corretor_designado_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_visitas_corretor_cov 
ON public.visitas(corretor_id) 
WHERE corretor_id IS NOT NULL;

-- B. Fast partial timeout indexes
CREATE INDEX IF NOT EXISTS idx_distribution_attempts_status_timeout_partial 
ON public.distribution_attempts(status, timeout_at) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_visit_distribution_attempts_status_timeout_partial 
ON public.visit_distribution_attempts(status, timeout_at) 
WHERE status = 'pending';


-- ==========================================
-- 3. PREVENTING RLS RECURSION LOOPS
-- ==========================================

-- A. Lead Access helper (Security Definer)
CREATE OR REPLACE FUNCTION public.can_access_lead(
  p_user_id UUID,
  p_corretor_designado_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- 1. Admins have complete access
  IF public.has_role(p_user_id, 'admin') THEN
    RETURN TRUE;
  END IF;

  -- 2. Check if user is the assigned broker
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles p
    JOIN public.corretores c ON c.profile_id = p.id
    WHERE p.user_id = p_user_id 
      AND c.id = p_corretor_designado_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- B. Visit Access helper (Security Definer)
CREATE OR REPLACE FUNCTION public.can_access_visit(
  p_user_id UUID,
  p_corretor_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- 1. Admins have complete access
  IF public.has_role(p_user_id, 'admin') THEN
    RETURN TRUE;
  END IF;

  -- 2. Check if user is the assigned broker for the visit
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles p
    JOIN public.corretores c ON c.profile_id = p.id
    WHERE p.user_id = p_user_id 
      AND c.id = p_corretor_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- C. Apply new consolidated, recursion-free RLS policies to leads
DROP POLICY IF EXISTS "Admin users can manage all leads" ON public.leads;
DROP POLICY IF EXISTS "Corretores can view assigned leads" ON public.leads;

CREATE POLICY "Consolidated leads access policy" ON public.leads
    FOR ALL
    USING (public.can_access_lead(auth.uid(), corretor_designado_id));

-- D. Apply new consolidated, recursion-free RLS policies to visitas
DROP POLICY IF EXISTS "Admin can manage all visitas" ON public.visitas;
DROP POLICY IF EXISTS "Admins can manage all visitas" ON public.visitas;
DROP POLICY IF EXISTS "Corretores can view their own visitas" ON public.visitas;
DROP POLICY IF EXISTS "Corretores can update their own visitas" ON public.visitas;

CREATE POLICY "Consolidated visitas access policy" ON public.visitas
    FOR ALL
    USING (public.can_access_visit(auth.uid(), corretor_id));
