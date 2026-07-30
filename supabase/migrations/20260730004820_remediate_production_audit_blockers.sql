-- Production audit remediation: authorization, Storage, retention and stale queues.
-- This migration is intentionally idempotent so the production state can be
-- reconstructed from Git even when part of the hardening was applied manually.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Destructive visit RPCs: use caller privileges and explicit authorization.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_visita(visita_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _actor_id uuid := auth.uid();
  _is_admin boolean := false;
  _is_assigned_corretor boolean := false;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Autenticação obrigatória';
  END IF;

  SELECT public.has_role(_actor_id, 'admin'::public.app_role)
    INTO _is_admin;

  SELECT EXISTS (
    SELECT 1
    FROM public.visitas AS v
    JOIN public.corretores AS c ON c.id = v.corretor_id
    JOIN public.profiles AS p ON p.id = c.profile_id
    WHERE v.id = $1
      AND p.user_id = _actor_id
  ) INTO _is_assigned_corretor;

  IF NOT (_is_admin OR _is_assigned_corretor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sem permissão para excluir esta visita';
  END IF;

  UPDATE public.visitas AS v
     SET deleted_at = now(),
         updated_at = now()
   WHERE v.id = $1
     AND v.deleted_at IS NULL;

  UPDATE public.leads AS l
     SET status = 'cancelado',
         updated_at = now()
   WHERE l.id = (
     SELECT v.lead_id
     FROM public.visitas AS v
     WHERE v.id = $1
   )
     AND l.status = 'visita_agendada';
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_visita(visita_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _actor_id uuid := auth.uid();
  _is_admin boolean := false;
  _is_assigned_corretor boolean := false;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Autenticação obrigatória';
  END IF;

  SELECT public.has_role(_actor_id, 'admin'::public.app_role)
    INTO _is_admin;

  SELECT EXISTS (
    SELECT 1
    FROM public.visitas AS v
    JOIN public.corretores AS c ON c.id = v.corretor_id
    JOIN public.profiles AS p ON p.id = c.profile_id
    WHERE v.id = $1
      AND p.user_id = _actor_id
  ) INTO _is_assigned_corretor;

  IF NOT (_is_admin OR _is_assigned_corretor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sem permissão para restaurar esta visita';
  END IF;

  UPDATE public.visitas AS v
     SET deleted_at = NULL,
         updated_at = now()
   WHERE v.id = $1
     AND v.deleted_at IS NOT NULL;

  UPDATE public.leads AS l
     SET status = 'visita_agendada',
         updated_at = now()
   WHERE l.id = (
     SELECT v.lead_id
     FROM public.visitas AS v
     WHERE v.id = $1
   )
     AND l.status = 'cancelado';
END;
$function$;

CREATE OR REPLACE FUNCTION public.hard_delete_visita(visita_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _actor_id uuid := auth.uid();
BEGIN
  IF _actor_id IS NULL
     OR NOT public.has_role(_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A exclusão permanente é restrita a administradores';
  END IF;

  DELETE FROM public.visit_distribution_attempts AS vda
   WHERE vda.visita_id = $1;

  DELETE FROM public.visit_distribution_queue AS vdq
   WHERE vdq.visita_id = $1;

  DELETE FROM public.visitas AS v
   WHERE v.id = $1;
END;
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_visita(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_visita(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hard_delete_visita(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_visita(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_visita(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_visita(uuid) TO authenticated;

-- The hard-delete transaction needs an admin policy for the attempts table.
DROP POLICY IF EXISTS "Admin users can manage visit distribution attempts"
  ON public.visit_distribution_attempts;
CREATE POLICY "Admin users can manage visit distribution attempts"
  ON public.visit_distribution_attempts
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

-- Replace overlapping visit policies with one admin policy and explicit
-- assigned-corretor policies. WITH CHECK prevents ownership reassignment.
DROP POLICY IF EXISTS "Admin users can manage all visitas" ON public.visitas;
DROP POLICY IF EXISTS "Consolidated visitas access policy" ON public.visitas;
DROP POLICY IF EXISTS "Corretores can view their own active visitas" ON public.visitas;
DROP POLICY IF EXISTS "Corretores can update their own active visitas" ON public.visitas;

CREATE POLICY "Admins manage visitas"
  ON public.visitas
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

CREATE POLICY "Corretores view assigned visitas"
  ON public.visitas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.corretores AS c
      JOIN public.profiles AS p ON p.id = c.profile_id
      WHERE c.id = visitas.corretor_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Corretores update assigned visitas"
  ON public.visitas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.corretores AS c
      JOIN public.profiles AS p ON p.id = c.profile_id
      WHERE c.id = visitas.corretor_id
        AND p.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.corretores AS c
      JOIN public.profiles AS p ON p.id = c.profile_id
      WHERE c.id = visitas.corretor_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Roles and mutable profiles.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
  SELECT ur.role::text
  FROM public.user_roles AS ur
  WHERE ur.user_id = (SELECT auth.uid())
  LIMIT 1
$function$;

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (first_name, last_name, phone, avatar_url) ON TABLE public.profiles
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Financial receipts: private bucket, controlled formats and size.
-- ---------------------------------------------------------------------------

UPDATE storage.buckets
   SET public = false,
       file_size_limit = 10485760,
       allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[],
       updated_at = now()
 WHERE id = 'comprovantes';

DROP POLICY IF EXISTS "Permitir leitura para usuarios autenticados"
  ON storage.objects;
DROP POLICY IF EXISTS "Administradores podem listar comprovantes"
  ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload para administradores"
  ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualizacao para administradores"
  ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusao para administradores"
  ON storage.objects;

CREATE POLICY "Admins read financial receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'comprovantes'
    AND (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  );

CREATE POLICY "Admins upload financial receipts"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes'
    AND (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  );

CREATE POLICY "Admins update financial receipts"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'comprovantes'
    AND (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  )
  WITH CHECK (
    bucket_id = 'comprovantes'
    AND (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  );

CREATE POLICY "Admins delete financial receipts"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'comprovantes'
    AND (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  );

-- ---------------------------------------------------------------------------
-- 4. WordPress log retention: delete children before parents.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cleanup_old_sync_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
BEGIN
  DELETE FROM public.wp_sync_performance AS perf
   WHERE perf.created_at < now() - interval '30 days'
      OR perf.sync_log_id IN (
        SELECT log.id
        FROM public.wp_sync_log AS log
        WHERE log.created_at < now() - interval '30 days'
      );

  DELETE FROM public.wp_sync_log AS log
   WHERE log.created_at < now() - interval '30 days';

  DELETE FROM public.wp_categories_cache AS cache
   WHERE cache.cached_at < now() - interval '7 days';
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_old_sync_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_sync_logs() TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Reconcile abandoned visit distributions and their pending attempts.
-- ---------------------------------------------------------------------------

UPDATE public.visit_distribution_attempts AS attempt
   SET status = 'timeout',
       response_type = COALESCE(attempt.response_type, 'system_timeout'),
       response_message = COALESCE(
         attempt.response_message,
         'Encerrada automaticamente na remediação da auditoria: fila abandonada por mais de 24 horas'
       ),
       response_received_at = COALESCE(attempt.response_received_at, now())
 WHERE attempt.status = 'pending'
   AND attempt.queue_id IN (
     SELECT queue.id
     FROM public.visit_distribution_queue AS queue
     WHERE queue.status = 'in_progress'
       AND queue.started_at < now() - interval '24 hours'
   );

UPDATE public.visit_distribution_queue AS queue
   SET status = 'failed',
       completed_at = now(),
       failure_reason = COALESCE(
         NULLIF(queue.failure_reason, ''),
         'Encerrada automaticamente na remediação da auditoria: fila abandonada por mais de 24 horas'
       )
 WHERE queue.status = 'in_progress'
   AND queue.started_at < now() - interval '24 hours';

-- New functions should never become public APIs by default.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

COMMIT;
