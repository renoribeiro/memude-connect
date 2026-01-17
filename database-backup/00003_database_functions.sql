-- Database Functions Migration
-- This migration creates all custom database functions

-- Function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$function$;

-- Function to validate CPF
CREATE OR REPLACE FUNCTION public.validate_cpf(cpf_input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Function to get corretor visit statistics
CREATE OR REPLACE FUNCTION public.get_corretor_visitas_stats(corretor_uuid uuid)
RETURNS TABLE(visitas_realizadas bigint, visitas_agendadas bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'realizada') as visitas_realizadas,
    COUNT(*) FILTER (WHERE status = 'agendada' OR status = 'confirmada') as visitas_agendadas
  FROM visitas 
  WHERE corretor_id = corretor_uuid;
END;
$function$;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Sistema')
  );
  RETURN NEW;
END;
$function$;

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function to cleanup old sync logs
CREATE OR REPLACE FUNCTION public.cleanup_old_sync_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Remove logs de sincronização mais antigos que 30 dias
  DELETE FROM wp_sync_log 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Remove dados de performance mais antigos que 30 dias
  DELETE FROM wp_sync_performance 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Remove cache de categorias mais antigo que 7 dias
  DELETE FROM wp_categories_cache 
  WHERE cached_at < NOW() - INTERVAL '7 days';
END;
$function$;