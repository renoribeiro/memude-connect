-- Fix save_evolution_instance function: column names were mismatched
-- Old function used: instance_url, apikey (wrong)
-- Correct columns are: instance_name, api_url, api_token

CREATE OR REPLACE FUNCTION public.save_evolution_instance(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_role user_role;
  v_instance_id UUID;
  v_result JSONB;
BEGIN
  -- Check if the user is an admin
  SELECT role INTO v_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem salvar instâncias. Seu perfil é: %%', v_role;
  END IF;

  -- Extract ID if present (for update)
  IF payload->>'id' IS NOT NULL THEN
    v_instance_id := (payload->>'id')::UUID;
    
    UPDATE evolution_instances
    SET
      name = payload->>'name',
      instance_name = payload->>'instance_name',
      api_url = payload->>'api_url',
      api_token = payload->>'api_token',
      is_active = (payload->>'is_active')::BOOLEAN,
      updated_at = NOW()
    WHERE id = v_instance_id;
    
    -- Return the updated record as JSON
    SELECT row_to_json(r) INTO v_result FROM evolution_instances r WHERE id = v_instance_id;
    
  ELSE
    -- Insert new record
    INSERT INTO evolution_instances (name, instance_name, api_url, api_token, is_active, created_by)
    VALUES (
      payload->>'name',
      payload->>'instance_name',
      payload->>'api_url',
      payload->>'api_token',
      COALESCE((payload->>'is_active')::BOOLEAN, true),
      auth.uid()
    )
    RETURNING row_to_json(evolution_instances.*) INTO v_result;
  END IF;

  RETURN v_result;
END;
$function$;
