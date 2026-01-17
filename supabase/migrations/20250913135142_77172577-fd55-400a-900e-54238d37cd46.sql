-- Fase 1: Eliminar completamente a recursão RLS

-- Dropar as políticas problemáticas que causam recursão
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Dropar a função que causa recursão
DROP FUNCTION IF EXISTS public.get_current_user_role();

-- Criar políticas RLS simplificadas e diretas
-- Política para admins verem todos os profiles (usando email diretamente)
CREATE POLICY "Admin users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.email() = 'reno@re9.online' OR 
  auth.uid() = user_id
);

-- Política para admins atualizarem todos os profiles
CREATE POLICY "Admin users can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  auth.email() = 'reno@re9.online' OR 
  auth.uid() = user_id
);

-- Garantir que o usuário admin tem role 'admin'
UPDATE public.profiles 
SET role = 'admin' 
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'reno@re9.online'
);

-- Simplificar políticas de outras tabelas para evitar recursão
-- Corretores
DROP POLICY IF EXISTS "Admins can manage all corretores" ON public.corretores;
CREATE POLICY "Admin users can manage all corretores" 
ON public.corretores 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

-- Leads  
DROP POLICY IF EXISTS "Admins can manage all leads" ON public.leads;
CREATE POLICY "Admin users can manage all leads" 
ON public.leads 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

-- Visitas
DROP POLICY IF EXISTS "Admins can manage all visitas" ON public.visitas;
CREATE POLICY "Admin users can manage all visitas" 
ON public.visitas 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

-- System settings
DROP POLICY IF EXISTS "Only admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admin users can manage system settings" 
ON public.system_settings 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

-- Communication log
DROP POLICY IF EXISTS "Admins can manage all communication_log" ON public.communication_log;
CREATE POLICY "Admin users can manage all communication_log" 
ON public.communication_log 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

-- Lead distribution log
DROP POLICY IF EXISTS "Admins can manage lead_distribution_log" ON public.lead_distribution_log;
CREATE POLICY "Admin users can manage lead_distribution_log" 
ON public.lead_distribution_log 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

-- Corretor bairros
DROP POLICY IF EXISTS "Admins can manage corretor_bairros" ON public.corretor_bairros;
CREATE POLICY "Admin users can manage corretor_bairros" 
ON public.corretor_bairros 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

-- Corretor construtoras
DROP POLICY IF EXISTS "Admins can manage corretor_construtoras" ON public.corretor_construtoras;
CREATE POLICY "Admin users can manage corretor_construtoras" 
ON public.corretor_construtoras 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

-- Bairros
DROP POLICY IF EXISTS "Only admins can manage bairros" ON public.bairros;
CREATE POLICY "Admin users can manage bairros" 
ON public.bairros 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

-- Construtoras
DROP POLICY IF EXISTS "Only admins can manage construtoras" ON public.construtoras;
CREATE POLICY "Admin users can manage construtoras" 
ON public.construtoras 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

-- Empreendimentos
DROP POLICY IF EXISTS "Only admins can manage empreendimentos" ON public.empreendimentos;
CREATE POLICY "Admin users can manage empreendimentos" 
ON public.empreendimentos 
FOR ALL 
USING (auth.email() = 'reno@re9.online');