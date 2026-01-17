-- Fase 1: Criar enum para padronizar direção das comunicações
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'communication_direction') THEN
    CREATE TYPE communication_direction AS ENUM ('enviado', 'recebido');
  END IF;
END $$;

-- Criar coluna temporária com o novo tipo
ALTER TABLE communication_log 
ADD COLUMN IF NOT EXISTS direction_new communication_direction;

-- Migrar dados existentes
UPDATE communication_log 
SET direction_new = CASE 
  WHEN direction = 'outbound' THEN 'enviado'::communication_direction
  WHEN direction = 'inbound' THEN 'recebido'::communication_direction
  ELSE 'enviado'::communication_direction
END;

-- Dropar coluna antiga e renomear a nova
ALTER TABLE communication_log DROP COLUMN direction;
ALTER TABLE communication_log RENAME COLUMN direction_new TO direction;

-- Definir NOT NULL na nova coluna
ALTER TABLE communication_log ALTER COLUMN direction SET NOT NULL;