-- Sprint 1: Correções Críticas de Segurança
-- Tarefa 1.3: Restringir RLS em corretores
-- Tarefa 1.4: Ocultar Templates de Relatórios

-- ============================================
-- TAREFA 1.3: RESTRINGIR RLS EM CORRETORES
-- ============================================

-- Remover policies antigas e criar novas mais restritivas
DROP POLICY IF EXISTS "Corretores can view their own data" ON corretores;
DROP POLICY IF EXISTS "Corretores can update their own data" ON corretores;
DROP POLICY IF EXISTS "Corretores can view their own active data" ON corretores;
DROP POLICY IF EXISTS "Corretores can update their own active data" ON corretores;

-- Policy para corretores visualizarem APENAS seus próprios dados completos
CREATE POLICY "Corretores can view only their own sensitive data" 
ON corretores FOR SELECT 
USING (
  (deleted_at IS NULL) AND (
    auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id)
    OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Policy para corretores atualizarem APENAS seus próprios dados
CREATE POLICY "Corretores can update only their own data" 
ON corretores FOR UPDATE 
USING (
  (deleted_at IS NULL) AND (
    auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id)
    OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Criar VIEW pública para listagens (sem dados sensíveis)
CREATE OR REPLACE VIEW corretores_public AS
SELECT 
  c.id,
  c.profile_id,
  c.creci,
  c.tipo_imovel,
  c.estado,
  c.cidade,
  c.status,
  c.nota_media,
  c.total_visitas,
  c.created_at,
  c.last_activity_at,
  p.first_name,
  p.last_name,
  p.avatar_url
FROM corretores c
JOIN profiles p ON p.id = c.profile_id
WHERE c.deleted_at IS NULL;

-- Permitir leitura da view para usuários autenticados
GRANT SELECT ON corretores_public TO authenticated;

-- Comentário de segurança
COMMENT ON VIEW corretores_public IS 'View pública de corretores sem dados sensíveis (CPF, telefone, email, WhatsApp)';

-- ============================================
-- TAREFA 1.4: OCULTAR TEMPLATES DE RELATÓRIOS
-- ============================================

-- Tornar todos os templates privados por padrão
UPDATE report_templates 
SET is_public = false 
WHERE is_public = true;

-- Log da alteração
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated_count 
  FROM report_templates 
  WHERE is_public = false;
  
  RAISE NOTICE 'Templates de relatórios atualizados: % templates agora são privados', v_updated_count;
END $$;