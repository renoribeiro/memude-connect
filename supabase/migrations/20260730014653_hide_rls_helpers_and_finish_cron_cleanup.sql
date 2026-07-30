-- Production audit remediation: keep RLS helper functions outside the exposed
-- API schema, prevent callers from probing another user's authorization, and
-- remove the duplicate WordPress cleanup schedule.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.can_access_lead(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_access_visit(uuid, uuid) SET SCHEMA private;

CREATE OR REPLACE FUNCTION private.has_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT
    _user_id IS NOT DISTINCT FROM (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION private.can_access_lead(
  p_user_id uuid,
  p_corretor_designado_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RETURN FALSE;
  END IF;

  IF private.has_role(p_user_id, 'admin'::public.app_role) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.corretores c ON c.profile_id = p.id
    WHERE p.user_id = p_user_id
      AND c.id = p_corretor_designado_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.can_access_visit(
  p_user_id uuid,
  p_corretor_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RETURN FALSE;
  END IF;

  IF private.has_role(p_user_id, 'admin'::public.app_role) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.corretores c ON c.profile_id = p.id
    WHERE p.user_id = p_user_id
      AND c.id = p_corretor_id
  );
END;
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_access_lead(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_access_visit(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_lead(uuid, uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_visit(uuid, uuid)
  TO anon, authenticated, service_role;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cleanup-sync-logs-weekly';

-- Validate the corrected FK-safe cleanup immediately. The daily schedule remains.
SELECT public.cleanup_old_sync_logs();

COMMIT;
