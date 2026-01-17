-- Sprint 1: Normalização de Números e Configuração de Webhook
-- Cria função SQL para normalizar números brasileiros e atualiza dados existentes

-- 1. Criar função de normalização de números brasileiros
CREATE OR REPLACE FUNCTION normalize_brazilian_phone(phone_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text;
BEGIN
  IF phone_input IS NULL OR phone_input = '' THEN
    RETURN NULL;
  END IF;
  
  -- Remove tudo que não é dígito
  digits := regexp_replace(phone_input, '\D', '', 'g');
  
  -- Se já tem 13 dígitos e começa com 55, retorna
  IF length(digits) = 13 AND digits LIKE '55%' THEN
    RETURN digits;
  END IF;
  
  -- Se tem 12 dígitos, adiciona DDI 55
  IF length(digits) = 12 THEN
    RETURN '55' || digits;
  END IF;
  
  -- Se tem 11 dígitos (DDXXXXXXXXX), adiciona DDI 55
  IF length(digits) = 11 THEN
    RETURN '55' || digits;
  END IF;
  
  -- Se tem 10 dígitos (XXXXXXXXXX), assume DDD 85 e adiciona DDI 55
  IF length(digits) = 10 THEN
    RETURN '5585' || digits;
  END IF;
  
  -- Se tem 9 dígitos (XXXXXXXXX), assume DDD 85 e adiciona DDI 55
  IF length(digits) = 9 THEN
    RETURN '5585' || digits;
  END IF;
  
  -- Para números menores, assume DDD 85 e adiciona DDI 55
  RETURN '5585' || digits;
END;
$$;

-- 2. Normalizar números existentes em corretores
UPDATE corretores 
SET 
  whatsapp = normalize_brazilian_phone(whatsapp),
  telefone = normalize_brazilian_phone(telefone)
WHERE whatsapp IS NOT NULL OR telefone IS NOT NULL;

-- 3. Normalizar números existentes em leads
UPDATE leads 
SET telefone = normalize_brazilian_phone(telefone)
WHERE telefone IS NOT NULL;

-- 4. Inserir configurações de webhook
INSERT INTO system_settings (key, value, description)
VALUES 
  ('evolution_webhook_url', '', 'URL do webhook configurado na Evolution API para receber eventos (preenchida automaticamente)'),
  ('evolution_webhook_enabled', 'false', 'Indica se o webhook está ativo e configurado na Evolution API')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- 5. Verificar resultados
DO $$
DECLARE
  corretor_count integer;
  lead_count integer;
BEGIN
  SELECT COUNT(*) INTO corretor_count FROM corretores WHERE whatsapp IS NOT NULL;
  SELECT COUNT(*) INTO lead_count FROM leads WHERE telefone IS NOT NULL;
  
  RAISE NOTICE '✓ Sprint 1 executado com sucesso!';
  RAISE NOTICE '✓ Função normalize_brazilian_phone() criada';
  RAISE NOTICE '✓ % números de corretores normalizados', corretor_count;
  RAISE NOTICE '✓ % números de leads normalizados', lead_count;
  RAISE NOTICE '✓ Configurações de webhook inseridas';
  RAISE NOTICE '';
  RAISE NOTICE '⚠ PRÓXIMO PASSO: Configurar webhook em Admin > Configurações > Comunicação';
END $$;
