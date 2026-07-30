-- Compatibility RPC for already deployed Edge Function versions. The public
-- wrapper is SECURITY INVOKER, while the private helper prevents authenticated
-- callers from checking another user's role.

BEGIN;

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
    (
      _user_id IS NOT DISTINCT FROM (SELECT auth.uid())
      OR (SELECT auth.role()) = 'service_role'
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION public.has_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.has_role(_user_id, _role)
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO authenticated, service_role;

COMMIT;
