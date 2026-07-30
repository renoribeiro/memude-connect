-- Final safe cleanup from the post-deployment advisor pass.

-- Service-role access bypasses RLS. Client roles receive an explicit deny so
-- the private LID mapping table can never be queried directly.
DROP POLICY IF EXISTS "Deny client access" ON public.lid_phone_map;
CREATE POLICY "Deny client access"
ON public.lid_phone_map
FOR ALL TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Extension operators are needed by semantic-search functions. The extensions
-- schema is not writable by client roles, so including it is deterministic.
DO $$
DECLARE
  function_record record;
BEGIN
  FOR function_record IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, extensions, pg_temp',
      function_record.signature
    );
  END LOOP;
END
$$;

-- Drop byte-for-byte duplicate indexes while preserving one covering index for
-- each access path.
DROP INDEX IF EXISTS public.idx_followups_agent_order;
DROP INDEX IF EXISTS public.idx_corretores_profile;
DROP INDEX IF EXISTS public.idx_leads_corretor;
DROP INDEX IF EXISTS public.idx_visitas_lead;
