-- Etapa 1: Adicionar novos valores ao enum template_category
ALTER TYPE template_category ADD VALUE IF NOT EXISTS 'visit_distribution';
ALTER TYPE template_category ADD VALUE IF NOT EXISTS 'admin_notification';