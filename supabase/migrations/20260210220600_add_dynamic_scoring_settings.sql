-- Add dynamic scoring columns to distribution_settings
ALTER TABLE distribution_settings 
ADD COLUMN IF NOT EXISTS score_match_bairro integer DEFAULT 10000,
ADD COLUMN IF NOT EXISTS score_match_construtora integer DEFAULT 10000,
ADD COLUMN IF NOT EXISTS score_nota_multiplier integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS score_visitas_multiplier integer DEFAULT 10;
