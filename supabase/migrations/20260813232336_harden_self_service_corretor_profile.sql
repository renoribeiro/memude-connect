-- Allow the self-service broker application shown by /perfil while preventing
-- authenticated users from approving themselves or rewriting broker metrics.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION private.enforce_corretor_self_service_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  actor_is_admin boolean := false;
BEGIN
  IF actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  actor_is_admin := private.has_role(actor_id, 'admin'::public.app_role);
  IF actor_is_admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = NEW.profile_id
        AND profile.user_id = actor_id
    ) THEN
      RAISE EXCEPTION 'O perfil de corretor deve pertencer ao usuário autenticado'
        USING ERRCODE = '42501';
    END IF;

    NEW.status := 'em_avaliacao'::public.corretor_status;
    NEW.nota_media := 0;
    NEW.total_visitas := 0;
    NEW.total_accepts := 0;
    NEW.total_rejects := 0;
    NEW.avg_response_time_minutes := 0;
    NEW.data_avaliacao := NULL;
    NEW.deleted_at := NULL;
    RETURN NEW;
  END IF;

  IF ROW(
    NEW.profile_id,
    NEW.creci,
    NEW.cpf,
    NEW.email,
    NEW.status,
    NEW.nota_media,
    NEW.total_visitas,
    NEW.total_accepts,
    NEW.total_rejects,
    NEW.avg_response_time_minutes,
    NEW.data_avaliacao,
    NEW.deleted_at,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.profile_id,
    OLD.creci,
    OLD.cpf,
    OLD.email,
    OLD.status,
    OLD.nota_media,
    OLD.total_visitas,
    OLD.total_accepts,
    OLD.total_rejects,
    OLD.avg_response_time_minutes,
    OLD.data_avaliacao,
    OLD.deleted_at,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Somente administradores podem alterar credenciais, status ou métricas do corretor'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_corretor_self_service_fields
  ON public.corretores;
CREATE TRIGGER enforce_corretor_self_service_fields
BEFORE INSERT OR UPDATE ON public.corretores
FOR EACH ROW
EXECUTE FUNCTION private.enforce_corretor_self_service_fields();

DROP POLICY IF EXISTS "Users create their own broker application"
  ON public.corretores;
CREATE POLICY "Users create their own broker application"
  ON public.corretores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT profile.id
      FROM public.profiles AS profile
      WHERE profile.user_id = (SELECT auth.uid())
    )
    AND status = 'em_avaliacao'::public.corretor_status
    AND deleted_at IS NULL
  );

REVOKE ALL ON FUNCTION private.enforce_corretor_self_service_fields()
  FROM PUBLIC, anon, authenticated;

COMMIT;
