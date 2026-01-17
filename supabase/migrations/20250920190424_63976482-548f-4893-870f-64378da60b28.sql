-- FASE 1: CORREÇÕES CRÍTICAS DE SEGURANÇA

-- 1. Corrigir RLS policies para leads (restringir acesso)
DROP POLICY IF EXISTS "Corretores can view assigned leads" ON public.leads;
CREATE POLICY "Corretores can view assigned leads" ON public.leads
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN corretores c ON c.profile_id = p.id
    WHERE p.user_id = auth.uid() 
    AND c.id = leads.corretor_designado_id
  )
);

-- 2. Restringir communication_log apenas aos envolvidos
DROP POLICY IF EXISTS "Corretores can view their communication logs" ON public.communication_log;
CREATE POLICY "Corretores can view their communication logs" ON public.communication_log
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN corretores c ON c.profile_id = p.id
    WHERE p.user_id = auth.uid() 
    AND c.id = communication_log.corretor_id
  )
);

-- 3. Criar função security definer para verificar papel do usuário
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- 4. Melhorar política de audit_logs
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
FOR SELECT USING (
  public.get_current_user_role() = 'admin' OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.id = audit_logs.user_id
  )
);

-- 5. Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_corretor_designado ON public.leads(corretor_designado_id);
CREATE INDEX IF NOT EXISTS idx_communication_log_corretor ON public.communication_log(corretor_id);
CREATE INDEX IF NOT EXISTS idx_visitas_corretor ON public.visitas(corretor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_corretores_profile_id ON public.corretores(profile_id);

-- 6. Criar função para validar CPF brasileiro
CREATE OR REPLACE FUNCTION public.validate_cpf(cpf_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  cpf TEXT;
  sum1 INTEGER := 0;
  sum2 INTEGER := 0;
  i INTEGER;
BEGIN
  -- Remove formatação
  cpf := regexp_replace(cpf_input, '[^0-9]', '', 'g');
  
  -- Verifica se tem 11 dígitos
  IF length(cpf) != 11 THEN
    RETURN FALSE;
  END IF;
  
  -- Verifica sequências inválidas
  IF cpf IN ('00000000000', '11111111111', '22222222222', '33333333333', 
             '44444444444', '55555555555', '66666666666', '77777777777',
             '88888888888', '99999999999') THEN
    RETURN FALSE;
  END IF;
  
  -- Calcula primeiro dígito verificador
  FOR i IN 1..9 LOOP
    sum1 := sum1 + (substring(cpf FROM i FOR 1)::INTEGER * (11 - i));
  END LOOP;
  
  sum1 := 11 - (sum1 % 11);
  IF sum1 >= 10 THEN sum1 := 0; END IF;
  
  -- Verifica primeiro dígito
  IF sum1 != substring(cpf FROM 10 FOR 1)::INTEGER THEN
    RETURN FALSE;
  END IF;
  
  -- Calcula segundo dígito verificador
  FOR i IN 1..10 LOOP
    sum2 := sum2 + (substring(cpf FROM i FOR 1)::INTEGER * (12 - i));
  END LOOP;
  
  sum2 := 11 - (sum2 % 11);
  IF sum2 >= 10 THEN sum2 := 0; END IF;
  
  -- Verifica segundo dígito
  RETURN sum2 = substring(cpf FROM 11 FOR 1)::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;