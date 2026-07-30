-- Replace the legacy Evolution credential that was previously committed in
-- debug scripts. The active instance credential is already managed in the
-- admin-only evolution_instances table and is not present in source control.
UPDATE public.system_settings AS setting
SET value = active.api_token,
    updated_at = now()
FROM LATERAL (
  SELECT instance.api_token
  FROM public.evolution_instances AS instance
  WHERE instance.is_active = true
    AND instance.api_token IS NOT NULL
    AND length(instance.api_token) >= 16
  ORDER BY instance.updated_at DESC NULLS LAST, instance.created_at DESC
  LIMIT 1
) AS active
WHERE setting.key = 'evolution_api_key'
  AND setting.value IS DISTINCT FROM active.api_token;
