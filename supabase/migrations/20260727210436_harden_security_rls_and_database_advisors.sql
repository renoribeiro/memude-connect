-- Security hardening identified by the 2026-07-27 full application audit.
-- The migration is intentionally idempotent so it can also repair drifted remote state.

REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

ALTER TABLE public.ab_experiments
ADD COLUMN IF NOT EXISTS target_sample_size integer NOT NULL DEFAULT 100
CHECK (target_sample_size BETWEEN 2 AND 1000000);

-- Views must apply the caller's permissions and RLS, not the owner's.
ALTER VIEW IF EXISTS public.corretores_public SET (security_invoker = true);
ALTER VIEW IF EXISTS public.active_rate_limits SET (security_invoker = true);
ALTER VIEW IF EXISTS public.recent_errors SET (security_invoker = true);

-- Never expose transport credentials to the browser. Admins can read operational
-- instance data, while server-side service clients retain full access.
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.evolution_instances;
DROP POLICY IF EXISTS "Allow write access to admins" ON public.evolution_instances;
DROP POLICY IF EXISTS "Admins can read evolution instances" ON public.evolution_instances;
DROP POLICY IF EXISTS "Admins can manage evolution instances" ON public.evolution_instances;

CREATE POLICY "Admins can read evolution instances"
ON public.evolution_instances
FOR SELECT TO authenticated
USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

CREATE POLICY "Admins can manage evolution instances"
ON public.evolution_instances
FOR ALL TO authenticated
USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

REVOKE SELECT ON public.evolution_instances FROM authenticated;
GRANT SELECT (
  id, name, instance_name, api_url, is_active, created_at, updated_at,
  created_by, connection_status, last_health_check
) ON public.evolution_instances TO authenticated;

-- The previous policy was named "Service role" but applied to PUBLIC with true/true.
DROP POLICY IF EXISTS "Service role full access" ON public.lid_phone_map;
REVOKE ALL ON public.lid_phone_map FROM PUBLIC, anon, authenticated;
ALTER TABLE public.lid_phone_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lid_phone_map FORCE ROW LEVEL SECURITY;

-- Authenticated users could previously create notifications for arbitrary users.
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- A user may edit profile fields, but role authority lives exclusively in user_roles.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE((SELECT auth.role()), '') <> 'service_role'
     AND NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'profile role cannot be changed by this user'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_profile_role_escalation_trigger
BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_escalation();

DROP POLICY IF EXISTS "Admin users can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users update own profile; admins update all"
ON public.profiles
FOR UPDATE TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
);

-- Replace CRM authorization based on the mutable legacy profiles.role column.
DROP POLICY IF EXISTS "Admins can manage crm_pipelines" ON public.crm_pipelines;
DROP POLICY IF EXISTS "Admins can manage crm_stages" ON public.crm_stages;
DROP POLICY IF EXISTS "Admins can manage crm_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Admins can manage crm_automations" ON public.crm_automations;
DROP POLICY IF EXISTS "Corretores can view crm_pipelines" ON public.crm_pipelines;
DROP POLICY IF EXISTS "Corretores can view crm_stages" ON public.crm_stages;
DROP POLICY IF EXISTS "Corretores can view their crm_leads" ON public.crm_leads;

CREATE POLICY "Admins can manage crm_pipelines" ON public.crm_pipelines
FOR ALL TO authenticated
USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));
CREATE POLICY "Admins can manage crm_stages" ON public.crm_stages
FOR ALL TO authenticated
USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));
CREATE POLICY "Admins can manage crm_leads" ON public.crm_leads
FOR ALL TO authenticated
USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));
CREATE POLICY "Admins can manage crm_automations" ON public.crm_automations
FOR ALL TO authenticated
USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

CREATE POLICY "Corretores can view crm_pipelines" ON public.crm_pipelines
FOR SELECT TO authenticated
USING ((SELECT public.has_role((SELECT auth.uid()), 'corretor'::public.app_role)));
CREATE POLICY "Corretores can view crm_stages" ON public.crm_stages
FOR SELECT TO authenticated
USING ((SELECT public.has_role((SELECT auth.uid()), 'corretor'::public.app_role)));
CREATE POLICY "Corretores can view their crm_leads" ON public.crm_leads
FOR SELECT TO authenticated
USING (
  (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  OR EXISTS (
    SELECT 1
    FROM public.leads AS l
    JOIN public.corretores AS c ON c.id = l.corretor_designado_id
    JOIN public.profiles AS p ON p.id = c.profile_id
    WHERE p.user_id = (SELECT auth.uid())
      AND l.id = crm_leads.lead_id
  )
);

-- SECURITY DEFINER functions had implicit PUBLIC EXECUTE and mutable search_path.
-- Revoke the implicit privilege, retain service access, and grant only the RPCs
-- that authenticated application users legitimately call.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_lead(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_visit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_dashboard_stats(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversion_funnel(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_temperature_stats(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ab_test_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_visita(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_visita(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_visita(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_cpf(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_brazilian_phone(text) TO authenticated;

-- These reporting functions should obey the caller's RLS.
ALTER FUNCTION public.get_agent_dashboard_stats(uuid, integer) SECURITY INVOKER;
ALTER FUNCTION public.get_conversion_funnel(uuid, integer) SECURITY INVOKER;
ALTER FUNCTION public.get_lead_temperature_stats(uuid, integer) SECURITY INVOKER;
ALTER FUNCTION public.get_ab_test_results(uuid) SECURITY INVOKER;

-- Partition children were directly exposed without RLS. Access is only through
-- their RLS-protected parent tables.
DO $$
DECLARE
  partition_child record;
BEGIN
  FOR partition_child IN
    SELECT child_ns.nspname AS schema_name, child_table.relname AS table_name
    FROM pg_inherits
    JOIN pg_class AS child_table ON child_table.oid = pg_inherits.inhrelid
    JOIN pg_namespace AS child_ns ON child_ns.oid = child_table.relnamespace
    WHERE child_ns.nspname = 'public'
      AND child_table.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      partition_child.schema_name,
      partition_child.table_name
    );
    EXECUTE format(
      'REVOKE ALL ON %I.%I FROM PUBLIC, anon, authenticated',
      partition_child.schema_name,
      partition_child.table_name
    );
  END LOOP;
END
$$;

-- Add covering indexes for every currently unindexed foreign key.
DO $$
DECLARE
  fk record;
  index_name text;
BEGIN
  FOR fk IN
    SELECT
      c.oid AS table_oid,
      n.nspname AS schema_name,
      c.relname AS table_name,
      con.conname,
      con.conkey,
      string_agg(quote_ident(a.attname), ', ' ORDER BY keys.position) AS columns_sql
    FROM pg_constraint AS con
    JOIN pg_class AS c ON c.oid = con.conrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS keys(attnum, position)
    JOIN pg_attribute AS a ON a.attrelid = c.oid AND a.attnum = keys.attnum
    WHERE con.contype = 'f' AND n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index AS i
        WHERE i.indrelid = con.conrelid
          AND i.indisvalid
          AND (i.indkey::smallint[])[0:cardinality(con.conkey)-1] = con.conkey
      )
    GROUP BY c.oid, n.nspname, c.relname, con.conname, con.conkey
  LOOP
    index_name := left('idx_fk_' || fk.table_name || '_' || md5(fk.conname), 63);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      index_name, fk.schema_name, fk.table_name, fk.columns_sql
    );
  END LOOP;
END
$$;

-- Store cron authentication only in Vault. Values are generated server-side and
-- never committed to source control or exposed through the REST API.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'internal_function_secret') THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'internal_function_secret',
      'Authenticates pg_cron calls to Edge Functions'
    );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.verify_internal_function_secret(_candidate text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    _candidate IS NOT NULL
    AND length(_candidate) BETWEEN 32 AND 256
    AND EXISTS (
      SELECT 1
      FROM vault.decrypted_secrets
      WHERE name = 'internal_function_secret'
        AND extensions.digest(convert_to(decrypted_secret, 'UTF8'), 'sha256')
          = extensions.digest(convert_to(_candidate, 'UTF8'), 'sha256')
    );
$$;

REVOKE ALL ON FUNCTION public.verify_internal_function_secret(text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_internal_function_secret(text)
TO service_role;

DELETE FROM public.system_settings WHERE key = 'cron_secret';

-- Remove drifted, duplicated, hard-coded cron calls.
DO $$
DECLARE
  job record;
BEGIN
  FOR job IN
    SELECT jobid FROM cron.job
    WHERE command ILIKE '%functions/v1/%'
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END
$$;

SELECT cron.schedule(
  'memude-sync-wordpress',
  '0 0 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/sync-wordpress-properties',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')
    ),
    body := '{"scheduled":true}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'memude-distribution-timeouts',
  '*/2 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/distribution-timeout-checker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'memude-visit-distribution-timeouts',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/visit-distribution-timeout-checker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'memude-calculate-metrics',
  '0 2 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/calculate-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'memude-proactive-notifications',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/proactive-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'memude-ai-followups',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/ai-followup-checker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'memude-message-queue',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/evolution-process-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'memude-payment-reminders',
  '0 8 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/payment-reminder-checker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'memude-monitor-visits',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/monitor-visits',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'memude-scheduled-reports',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/schedule-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
