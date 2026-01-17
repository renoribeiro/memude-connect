-- Fase 2: Habilitar extensões necessárias para automação
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurar job para executar sincronização diariamente às 00:00
SELECT cron.schedule(
  'sync-wordpress-properties-daily',
  '0 0 * * *', -- Executa todo dia às 00:00
  $$
  SELECT
    net.http_post(
        url:='https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/sync-wordpress-properties',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94eWJhc3Z0cGhvc2RtbG1yZm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NTU4MTUsImV4cCI6MjA3MzMzMTgxNX0.Je-WNYEO9LEpBNjT1hNs1Qw_uoo8ErNh53Ipm5XSOFk"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Fase 3: Criar tabela para cache de categorias WordPress
CREATE TABLE wp_categories_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wp_category_id integer NOT NULL UNIQUE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  parent integer DEFAULT 0,
  cached_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- RLS para wp_categories_cache
ALTER TABLE wp_categories_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can manage wp_categories_cache" ON wp_categories_cache
FOR ALL USING (auth.email() = 'reno@re9.online');

-- Criar tabela para monitoramento de performance
CREATE TABLE wp_sync_performance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_log_id uuid REFERENCES wp_sync_log(id),
  operation_type text NOT NULL, -- 'fetch_posts', 'process_post', 'create_emp', 'update_emp'
  operation_start timestamp with time zone NOT NULL,
  operation_end timestamp with time zone,
  duration_ms integer,
  post_id integer,
  empreendimento_id uuid,
  success boolean DEFAULT true,
  error_message text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS para wp_sync_performance
ALTER TABLE wp_sync_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can manage wp_sync_performance" ON wp_sync_performance
FOR ALL USING (auth.email() = 'reno@re9.online');

-- Criar índices para performance
CREATE INDEX idx_wp_sync_performance_sync_log ON wp_sync_performance(sync_log_id);
CREATE INDEX idx_wp_sync_performance_operation ON wp_sync_performance(operation_type);
CREATE INDEX idx_wp_sync_performance_success ON wp_sync_performance(success);

-- Criar função para limpeza automática de logs antigos (manter últimos 30 dias)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agendar limpeza semanal dos logs
SELECT cron.schedule(
  'cleanup-sync-logs-weekly',
  '0 2 * * 0', -- Todo domingo às 02:00
  'SELECT cleanup_old_sync_logs();'
);