-- Adicionar coluna wp_post_id na tabela empreendimentos
ALTER TABLE empreendimentos 
ADD COLUMN wp_post_id integer UNIQUE;

-- Criar índice para performance
CREATE INDEX idx_empreendimentos_wp_post_id ON empreendimentos(wp_post_id);

-- Criar tabela wp_sync_log para monitoramento das sincronizações
CREATE TABLE wp_sync_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_date timestamp with time zone DEFAULT now(),
  total_posts_fetched integer NOT NULL DEFAULT 0,
  new_empreendimentos integer NOT NULL DEFAULT 0,
  updated_empreendimentos integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  sync_duration_ms integer,
  last_wp_post_id integer,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'error')),
  error_details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS na tabela wp_sync_log
ALTER TABLE wp_sync_log ENABLE ROW LEVEL SECURITY;

-- Política para admin gerenciar logs de sincronização
CREATE POLICY "Admin users can manage wp_sync_log" ON wp_sync_log
FOR ALL USING (auth.email() = 'reno@re9.online');