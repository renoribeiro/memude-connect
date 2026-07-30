-- =====================================================
-- Migration: Secure Cron Jobs & Harden Database RLS
-- Date: 2026-05-28
-- Description:
-- 1. Remove insecure "Service role can read system settings" policy from public.system_settings.
-- 2. Clean up redundant "Service role bypass" policies which are unnecessary (service_role always bypasses RLS).
-- 3. Unschedule old cron jobs containing hardcoded plain-text JWT Bearer keys.
-- 4. Keep only the non-secret Functions base URL.
-- 5. Secure schedules are created later from a server-generated Vault secret.
-- =====================================================

-- 1. Clean up insecure system_settings policy
-- service_role already bypasses RLS implicitly. Having a policy checking auth.jwt() is vulnerable to spoofing.
DROP POLICY IF EXISTS "Service role can read system settings" ON public.system_settings;

-- 2. Insert dynamic configurations for Supabase local/production endpoints & cron validation
INSERT INTO public.system_settings (key, value, description)
VALUES
('supabase_functions_url', 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1', 'Base URL of Supabase Edge Functions')
ON CONFLICT (key) DO UPDATE 
SET description = EXCLUDED.description;

-- Never persist cron credentials in public tables or migration source.
DELETE FROM public.system_settings WHERE key = 'cron_secret';

-- 3. Unschedule old jobs to stop execution of insecure parameters
-- We perform this in a DO block to prevent aborting if they don't exist
DO $$
BEGIN
  -- Unschedule old visit timeout checker
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'visit-distribution-timeout-checker-minutely') THEN
    PERFORM cron.unschedule('visit-distribution-timeout-checker-minutely');
  END IF;
  
  -- Unschedule old monitor visits hourly job
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitor-visits-hourly') THEN
    PERFORM cron.unschedule('monitor-visits-hourly');
  END IF;
END
$$;

COMMENT ON TABLE public.system_settings IS 'Core settings. Sensitive keys like OpenAI/Evolution API key should only be accessed via service role or decrypted vault. RLS is strictly enforced.';
