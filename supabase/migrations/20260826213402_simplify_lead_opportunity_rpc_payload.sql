-- Usa um payload JSON extensivel para os campos opcionais do cadastro conjunto.
-- Isso preserva tipagem correta no cliente gerado e evita UUIDs vazios.

DROP FUNCTION public.create_lead_with_crm_opportunity(
  text, text, text, text, text, uuid, uuid, uuid, uuid, numeric, text
);

CREATE FUNCTION public.create_lead_with_crm_opportunity(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid;
  v_lead_id uuid;
  v_opportunity_id uuid;
  v_pipeline_id uuid;
  v_stage_id uuid;
  v_corretor_id uuid;
  v_empreendimento_id uuid;
  v_valor_estimado numeric;
  v_position integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR NOT private.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Somente administradores podem cadastrar leads no funil'
      USING ERRCODE = '42501';
  END IF;

  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'Payload de cadastro invalido'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(COALESCE(p_input->>'nome', '')), '') IS NULL THEN
    RAISE EXCEPTION 'O nome do lead e obrigatorio'
      USING ERRCODE = '23514';
  END IF;

  IF NULLIF(btrim(COALESCE(p_input->>'telefone', '')), '') IS NULL THEN
    RAISE EXCEPTION 'O telefone do lead e obrigatorio'
      USING ERRCODE = '23514';
  END IF;

  BEGIN
    v_pipeline_id := (p_input->>'pipeline_id')::uuid;
    v_stage_id := (p_input->>'stage_id')::uuid;
    v_corretor_id := NULLIF(p_input->>'corretor_designado_id', '')::uuid;
    v_empreendimento_id := NULLIF(p_input->>'empreendimento_id', '')::uuid;
    v_valor_estimado := NULLIF(p_input->>'valor_estimado', '')::numeric;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Identificador ou valor invalido no cadastro'
      USING ERRCODE = '22P02';
  END;

  IF v_valor_estimado IS NOT NULL AND v_valor_estimado < 0 THEN
    RAISE EXCEPTION 'O valor estimado nao pode ser negativo'
      USING ERRCODE = '23514';
  END IF;

  PERFORM 1
  FROM public.crm_stages
  WHERE id = v_stage_id AND pipeline_id = v_pipeline_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa invalida para o pipeline selecionado'
      USING ERRCODE = '23514';
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = (SELECT auth.uid())
  LIMIT 1;

  INSERT INTO public.leads (
    nome,
    telefone,
    email,
    empreendimento_id,
    corretor_designado_id,
    origem,
    observacoes,
    status,
    created_by
  ) VALUES (
    btrim(p_input->>'nome'),
    btrim(p_input->>'telefone'),
    NULLIF(btrim(COALESCE(p_input->>'email', '')), ''),
    v_empreendimento_id,
    v_corretor_id,
    COALESCE(NULLIF(btrim(COALESCE(p_input->>'origem', '')), ''), 'outro'),
    NULLIF(btrim(COALESCE(p_input->>'observacoes', '')), ''),
    'novo'::public.lead_status,
    v_profile_id
  )
  RETURNING id INTO v_lead_id;

  SELECT COALESCE(max(posicao) + 1, 0)
  INTO v_position
  FROM public.crm_leads
  WHERE pipeline_id = v_pipeline_id
    AND stage_id = v_stage_id;

  INSERT INTO public.crm_leads (
    lead_id,
    pipeline_id,
    stage_id,
    empreendimento_id,
    valor_estimado,
    notas,
    posicao
  ) VALUES (
    v_lead_id,
    v_pipeline_id,
    v_stage_id,
    v_empreendimento_id,
    v_valor_estimado,
    NULLIF(btrim(COALESCE(p_input->>'notas', '')), ''),
    v_position
  )
  RETURNING id INTO v_opportunity_id;

  RETURN jsonb_build_object(
    'lead_id', v_lead_id,
    'opportunity_id', v_opportunity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_lead_with_crm_opportunity(jsonb)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_lead_with_crm_opportunity(jsonb)
TO authenticated, service_role;

COMMENT ON FUNCTION public.create_lead_with_crm_opportunity(jsonb) IS
  'Cadastra lead e primeira oportunidade atomicamente a partir de um payload validado.';
