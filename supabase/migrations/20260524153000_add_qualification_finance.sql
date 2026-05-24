-- Migration to add financial info to lead qualifications and suggested values to empreendimentos

-- Adicionando campos à tabela ai_lead_qualification
ALTER TABLE "public"."ai_lead_qualification" 
ADD COLUMN "renda_informada" numeric,
ADD COLUMN "entrada_informada" numeric;

-- Adicionando campos à tabela empreendimentos
ALTER TABLE "public"."empreendimentos" 
ADD COLUMN "renda_sugerida" numeric,
ADD COLUMN "entrada_sugerida" numeric;
