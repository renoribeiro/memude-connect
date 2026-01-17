-- Corrigir warnings de segurança

-- 1. Corrigir search_path para funções existentes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Sistema')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_corretor_visitas_stats(corretor_uuid uuid)
RETURNS TABLE(visitas_realizadas bigint, visitas_agendadas bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'realizada') as visitas_realizadas,
    COUNT(*) FILTER (WHERE status = 'agendada' OR status = 'confirmada') as visitas_agendadas
  FROM visitas 
  WHERE corretor_id = corretor_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_sync_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;