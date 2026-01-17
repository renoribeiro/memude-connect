-- Corrigir warning de segurança: Function Search Path Mutable
-- Adicionar SET search_path na função normalize_brazilian_phone

DROP FUNCTION IF EXISTS normalize_brazilian_phone(text);

CREATE OR REPLACE FUNCTION normalize_brazilian_phone(phone_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
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
