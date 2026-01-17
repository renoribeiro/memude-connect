-- Adicionar campo deleted_at para soft delete (lixeira)
ALTER TABLE corretores 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN corretores.deleted_at IS 'Data de exclusão lógica do corretor (soft delete) - permite mover para lixeira';

-- Criar índice para melhorar performance de queries que filtram corretores não deletados
CREATE INDEX idx_corretores_deleted_at ON corretores(deleted_at) WHERE deleted_at IS NULL;

-- Atualizar RLS policies para gerenciar acesso a corretores deletados
DROP POLICY IF EXISTS "Admin users can manage all corretores" ON corretores;
DROP POLICY IF EXISTS "Corretores can view their own data" ON corretores;
DROP POLICY IF EXISTS "Corretores can update their own data" ON corretores;

-- Admin pode gerenciar todos os corretores (incluindo deletados)
CREATE POLICY "Admin users can manage all corretores including deleted" 
ON corretores FOR ALL 
USING (auth.email() = 'reno@re9.online'::text);

-- Corretores só podem ver seus próprios dados se não estiverem deletados
CREATE POLICY "Corretores can view their own active data" 
ON corretores FOR SELECT 
USING (
  deleted_at IS NULL 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.id = corretores.profile_id
  )
);

-- Corretores podem atualizar seus próprios dados se não estiverem deletados
CREATE POLICY "Corretores can update their own active data" 
ON corretores FOR UPDATE 
USING (
  deleted_at IS NULL 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.id = corretores.profile_id
  )
);