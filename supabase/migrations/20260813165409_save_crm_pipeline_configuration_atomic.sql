-- Salva metadados e etapas do pipeline na mesma transação. Isso impede que a
-- interface apague as etapas existentes antes de confirmar a persistência das
-- novas etapas.
CREATE OR REPLACE FUNCTION public.save_crm_pipeline_configuration(
  p_pipeline_id uuid,
  p_nome text,
  p_descricao text,
  p_auto_add_visits boolean,
  p_stages jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stage jsonb;
  v_stage_id uuid;
  v_stage_ids uuid[] := ARRAY[]::uuid[];
  v_first_stage_id uuid;
  v_position integer := 0;
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR NOT private.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Somente administradores podem configurar pipelines'
      USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(p_nome), '') IS NULL THEN
    RAISE EXCEPTION 'O nome do pipeline é obrigatório'
      USING ERRCODE = '23514';
  END IF;

  IF p_stages IS NULL
     OR jsonb_typeof(p_stages) <> 'array'
     OR jsonb_array_length(p_stages) = 0 THEN
    RAISE EXCEPTION 'O pipeline deve ter pelo menos uma etapa'
      USING ERRCODE = '23514';
  END IF;

  -- Serializa edições concorrentes do mesmo pipeline durante toda a operação.
  PERFORM 1
  FROM public.crm_pipelines
  WHERE id = p_pipeline_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pipeline nao encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.crm_pipelines
  SET nome = btrim(p_nome),
      descricao = NULLIF(btrim(COALESCE(p_descricao, '')), ''),
      auto_add_visits = COALESCE(p_auto_add_visits, false),
      updated_at = now()
  WHERE id = p_pipeline_id;

  FOR v_stage IN
    SELECT value
    FROM jsonb_array_elements(p_stages)
  LOOP
    IF NULLIF(btrim(v_stage->>'nome'), '') IS NULL THEN
      RAISE EXCEPTION 'Todas as etapas devem ter um nome'
        USING ERRCODE = '23514';
    END IF;

    BEGIN
      v_stage_id := COALESCE(NULLIF(v_stage->>'id', '')::uuid, gen_random_uuid());
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Identificador de etapa inválido'
        USING ERRCODE = '22P02';
    END;

    IF EXISTS (
      SELECT 1
      FROM public.crm_stages
      WHERE id = v_stage_id
        AND pipeline_id <> p_pipeline_id
    ) THEN
      RAISE EXCEPTION 'A etapa informada pertence a outro pipeline'
        USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.crm_stages (
      id,
      pipeline_id,
      nome,
      cor,
      posicao,
      is_final
    ) VALUES (
      v_stage_id,
      p_pipeline_id,
      btrim(v_stage->>'nome'),
      COALESCE(NULLIF(btrim(v_stage->>'cor'), ''), '#6366f1'),
      v_position,
      COALESCE((v_stage->>'is_final')::boolean, false)
    )
    ON CONFLICT (id) DO UPDATE
    SET nome = EXCLUDED.nome,
        cor = EXCLUDED.cor,
        posicao = EXCLUDED.posicao,
        is_final = EXCLUDED.is_final,
        updated_at = now()
    WHERE public.crm_stages.pipeline_id = p_pipeline_id;

    v_stage_ids := array_append(v_stage_ids, v_stage_id);
    v_position := v_position + 1;
  END LOOP;

  v_first_stage_id := v_stage_ids[1];

  -- Preserva as oportunidades: leads sem etapa (inclusive os afetados pelo bug
  -- anterior) ou vinculados a uma etapa removida voltam para a primeira etapa.
  UPDATE public.crm_leads
  SET stage_id = v_first_stage_id,
      posicao = 0,
      moved_at = now(),
      updated_at = now()
  WHERE pipeline_id = p_pipeline_id
    AND (stage_id IS NULL OR NOT (stage_id = ANY(v_stage_ids)));

  DELETE FROM public.crm_stages
  WHERE pipeline_id = p_pipeline_id
    AND NOT (id = ANY(v_stage_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.save_crm_pipeline_configuration(
  uuid, text, text, boolean, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_crm_pipeline_configuration(
  uuid, text, text, boolean, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.save_crm_pipeline_configuration(
  uuid, text, text, boolean, jsonb
) IS 'Salva pipeline e etapas atomicamente, preservando leads de etapas removidas.';

-- Reparo idempotente e restrito ao estado produzido pelo defeito: somente
-- pipelines sem nenhuma etapa que ainda tenham oportunidades vinculadas.
DO $$
DECLARE
  v_pipeline record;
  v_first_stage_id uuid;
BEGIN
  FOR v_pipeline IN
    SELECT p.id
    FROM public.crm_pipelines p
    WHERE EXISTS (
      SELECT 1 FROM public.crm_leads cl WHERE cl.pipeline_id = p.id
    )
      AND NOT EXISTS (
        SELECT 1 FROM public.crm_stages cs WHERE cs.pipeline_id = p.id
      )
  LOOP
    INSERT INTO public.crm_stages (pipeline_id, nome, cor, posicao, is_final)
    VALUES (v_pipeline.id, 'Novo Lead', '#6366f1', 0, false)
    RETURNING id INTO v_first_stage_id;

    INSERT INTO public.crm_stages (pipeline_id, nome, cor, posicao, is_final) VALUES
      (v_pipeline.id, 'Em Contato', '#f59e0b', 1, false),
      (v_pipeline.id, 'Visita Agendada', '#3b82f6', 2, false),
      (v_pipeline.id, 'Visita Realizada', '#8b5cf6', 3, false),
      (v_pipeline.id, 'Proposta Enviada', '#ec4899', 4, false),
      (v_pipeline.id, 'Negociação', '#f97316', 5, false),
      (v_pipeline.id, 'Fechado (Ganho)', '#22c55e', 6, true),
      (v_pipeline.id, 'Perdido', '#ef4444', 7, true);

    UPDATE public.crm_leads
    SET stage_id = v_first_stage_id,
        posicao = 0,
        moved_at = now(),
        updated_at = now()
    WHERE pipeline_id = v_pipeline.id
      AND stage_id IS NULL;
  END LOOP;
END;
$$;
