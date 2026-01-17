-- Migration: Add Foreign Keys to Distribution Tables
-- Sprint 5 - Fase 1: Corrigir Schema do Banco de Dados

-- =====================================================
-- DISTRIBUTION_ATTEMPTS: Adicionar relação com queue
-- =====================================================

-- Adicionar coluna queue_id em distribution_attempts
ALTER TABLE distribution_attempts 
ADD COLUMN queue_id UUID REFERENCES distribution_queue(id) ON DELETE CASCADE;

-- Criar índice para performance
CREATE INDEX idx_distribution_attempts_queue_id 
ON distribution_attempts(queue_id);

-- Popular queue_id baseado em lead_id existente
UPDATE distribution_attempts da
SET queue_id = dq.id
FROM distribution_queue dq
WHERE da.lead_id = dq.lead_id
  AND da.queue_id IS NULL;

-- =====================================================
-- VISIT_DISTRIBUTION_ATTEMPTS: Adicionar relação com queue
-- =====================================================

-- Adicionar coluna queue_id em visit_distribution_attempts
ALTER TABLE visit_distribution_attempts 
ADD COLUMN queue_id UUID REFERENCES visit_distribution_queue(id) ON DELETE CASCADE;

-- Criar índice para performance
CREATE INDEX idx_visit_distribution_attempts_queue_id 
ON visit_distribution_attempts(queue_id);

-- Popular queue_id baseado em visita_id existente
UPDATE visit_distribution_attempts vda
SET queue_id = vdq.id
FROM visit_distribution_queue vdq
WHERE vda.visita_id = vdq.visita_id
  AND vda.queue_id IS NULL;

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON COLUMN distribution_attempts.queue_id IS 'Foreign key para distribution_queue. Permite JOINs eficientes e garante integridade referencial.';
COMMENT ON COLUMN visit_distribution_attempts.queue_id IS 'Foreign key para visit_distribution_queue. Permite JOINs eficientes e garante integridade referencial.';