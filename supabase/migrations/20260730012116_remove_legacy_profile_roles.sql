-- user_roles is the single authority for authorization. Every existing
-- profile has a corresponding user_roles row; the legacy values are known to
-- diverge and must not remain available to future code.
BEGIN;

DROP FUNCTION IF EXISTS public.save_evolution_instance(jsonb);
DROP FUNCTION IF EXISTS public.delete_evolution_instance(uuid);

DROP TRIGGER IF EXISTS prevent_profile_role_escalation_trigger
  ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_profile_role_escalation();
DROP INDEX IF EXISTS public.idx_profiles_role;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS role;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_role_per_user_uidx
  ON public.user_roles (user_id);

COMMENT ON TABLE public.user_roles IS
  'Single source of truth for application roles. Exactly one role per auth user.';

COMMIT;
