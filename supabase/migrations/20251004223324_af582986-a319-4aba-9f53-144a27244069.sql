-- FASE 1: Corrigir Política RLS da tabela system_settings

-- Remover política antiga restritiva
DROP POLICY IF EXISTS "Admin users can manage system settings" ON public.system_settings;

-- Criar política de leitura para usuários autenticados e service role
-- Isso permite que edge functions leiam as configurações
CREATE POLICY "Allow authenticated and service role to read system settings"
  ON public.system_settings
  FOR SELECT
  USING (true);

-- Criar política de escrita apenas para admin específico
CREATE POLICY "Admin users can update system settings"
  ON public.system_settings
  FOR ALL
  USING (auth.email() = 'reno@re9.online'::text)
  WITH CHECK (auth.email() = 'reno@re9.online'::text);