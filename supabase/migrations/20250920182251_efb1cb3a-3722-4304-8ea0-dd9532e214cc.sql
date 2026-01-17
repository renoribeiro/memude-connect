-- Adicionar novos campos à tabela corretores
ALTER TABLE public.corretores 
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS estado TEXT,
ADD COLUMN IF NOT EXISTS tipo_imovel TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT;

-- Criar enum para tipo de imóvel
DO $$ BEGIN
  CREATE TYPE tipo_imovel_enum AS ENUM (
    'residencial',
    'comercial', 
    'terreno',
    'rural',
    'todos'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar enum para estados brasileiros
DO $$ BEGIN
  CREATE TYPE estado_brasil_enum AS ENUM (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Definir valores padrão para registros existentes
UPDATE public.corretores 
SET estado = 'CE' 
WHERE estado IS NULL;

UPDATE public.corretores 
SET tipo_imovel = 'todos' 
WHERE tipo_imovel IS NULL;

-- Atualizar campos para usar enums
ALTER TABLE public.corretores 
ALTER COLUMN estado TYPE estado_brasil_enum USING estado::estado_brasil_enum,
ALTER COLUMN estado SET DEFAULT 'CE'::estado_brasil_enum;

ALTER TABLE public.corretores 
ALTER COLUMN tipo_imovel TYPE tipo_imovel_enum USING tipo_imovel::tipo_imovel_enum,
ALTER COLUMN tipo_imovel SET DEFAULT 'todos'::tipo_imovel_enum;

-- Migrar telefone de profiles para corretores (onde possível)
UPDATE public.corretores 
SET telefone = profiles.phone
FROM profiles 
WHERE corretores.profile_id = profiles.id 
AND profiles.phone IS NOT NULL
AND corretores.telefone IS NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_corretores_cidade ON public.corretores(cidade);
CREATE INDEX IF NOT EXISTS idx_corretores_estado ON public.corretores(estado);
CREATE INDEX IF NOT EXISTS idx_corretores_tipo_imovel ON public.corretores(tipo_imovel);

-- Criar função para calcular visitas realizadas vs agendadas
CREATE OR REPLACE FUNCTION get_corretor_visitas_stats(corretor_uuid UUID)
RETURNS TABLE(visitas_realizadas BIGINT, visitas_agendadas BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'realizada') as visitas_realizadas,
    COUNT(*) FILTER (WHERE status = 'agendada' OR status = 'confirmada') as visitas_agendadas
  FROM visitas 
  WHERE corretor_id = corretor_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;