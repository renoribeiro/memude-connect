-- Corrigir função para ter search_path seguro
CREATE OR REPLACE FUNCTION cleanup_old_sync_logs()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;