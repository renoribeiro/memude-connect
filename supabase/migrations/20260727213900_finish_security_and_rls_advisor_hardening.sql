-- Follow-up hardening after validating the first audit migration in production.

-- The central CRM has no anonymous database reads. Authentication endpoints are
-- provided by Supabase Auth and do not require privileges on the public schema.
DO $$
DECLARE
  relation_record record;
BEGIN
  FOR relation_record IN
    SELECT n.nspname AS schema_name, c.relname AS relation_name
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
  LOOP
    EXECUTE format(
      'REVOKE ALL ON %I.%I FROM anon',
      relation_record.schema_name,
      relation_record.relation_name
    );
  END LOOP;
END
$$;

-- Resolve the remaining mutable search_path advisories.
ALTER FUNCTION public.update_conversation_metrics() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_vendas_updated_at() SET search_path = public, pg_temp;

-- Pure validation helpers do not require owner privileges.
ALTER FUNCTION public.validate_cpf(text) SECURITY INVOKER;
ALTER FUNCTION public.normalize_brazilian_phone(text) SECURITY INVOKER;

-- Supabase recommends extensions outside the API-exposed public schema.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

-- A public bucket does not need a broad SELECT policy for public object URLs.
-- Listing and all mutations remain restricted to administrators.
DROP POLICY IF EXISTS "Permitir leitura para usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Administradores podem listar comprovantes" ON storage.objects;
CREATE POLICY "Administradores podem listar comprovantes"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
);

DROP POLICY IF EXISTS "Permitir atualizacao para administradores" ON storage.objects;
CREATE POLICY "Permitir atualizacao para administradores"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
)
WITH CHECK (
  bucket_id = 'comprovantes'
  AND (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
);

-- Partition children are inaccessible directly, but explicit deny policies make
-- that invariant visible to automated security checks as well.
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
      'DROP POLICY IF EXISTS %I ON %I.%I',
      'Deny direct partition access',
      partition_child.schema_name,
      partition_child.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      'Deny direct partition access',
      partition_child.schema_name,
      partition_child.table_name
    );
  END LOOP;
END
$$;

-- Cache auth context once per statement instead of recalculating it per row.
DO $$
DECLARE
  policy_record record;
  optimized_using text;
  optimized_check text;
  alter_sql text;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND (
        COALESCE(qual, '') ~ 'auth\.(uid|role|jwt)\(\)'
        OR COALESCE(with_check, '') ~ 'auth\.(uid|role|jwt)\(\)'
      )
  LOOP
    optimized_using := policy_record.qual;
    optimized_check := policy_record.with_check;

    IF optimized_using IS NOT NULL THEN
      optimized_using := replace(optimized_using, 'auth.uid()', '(SELECT auth.uid())');
      optimized_using := replace(optimized_using, 'auth.role()', '(SELECT auth.role())');
      optimized_using := replace(optimized_using, 'auth.jwt()', '(SELECT auth.jwt())');
    END IF;
    IF optimized_check IS NOT NULL THEN
      optimized_check := replace(optimized_check, 'auth.uid()', '(SELECT auth.uid())');
      optimized_check := replace(optimized_check, 'auth.role()', '(SELECT auth.role())');
      optimized_check := replace(optimized_check, 'auth.jwt()', '(SELECT auth.jwt())');
    END IF;

    alter_sql := format(
      'ALTER POLICY %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
    IF optimized_using IS NOT NULL THEN
      alter_sql := alter_sql || format(' USING (%s)', optimized_using);
    END IF;
    IF optimized_check IS NOT NULL THEN
      alter_sql := alter_sql || format(' WITH CHECK (%s)', optimized_check);
    END IF;
    EXECUTE alter_sql;
  END LOOP;
END
$$;
