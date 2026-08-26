-- Evolui o CRM de uma associacao unica lead/funil para oportunidades independentes
-- e torna a exclusao definitiva de leads completa, atomica e restrita a admins.

-- -----------------------------------------------------------------------------
-- 1. Exclusao integral do lead e de todos os dados pessoais/operacionais ligados
-- -----------------------------------------------------------------------------

ALTER TABLE public.agent_conversations
  DROP CONSTRAINT agent_conversations_lead_id_fkey,
  ADD CONSTRAINT agent_conversations_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

ALTER TABLE public.ai_lead_qualification
  DROP CONSTRAINT ai_lead_qualification_lead_id_fkey,
  ADD CONSTRAINT ai_lead_qualification_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

ALTER TABLE public.application_logs
  DROP CONSTRAINT application_logs_lead_id_fkey,
  ADD CONSTRAINT application_logs_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

ALTER TABLE public.distribution_queue
  DROP CONSTRAINT distribution_queue_lead_id_fkey,
  ADD CONSTRAINT distribution_queue_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

ALTER TABLE public.distribution_attempts
  DROP CONSTRAINT distribution_attempts_lead_id_fkey,
  ADD CONSTRAINT distribution_attempts_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

ALTER TABLE public.vendas
  DROP CONSTRAINT vendas_lead_id_fkey,
  ADD CONSTRAINT vendas_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.permanently_delete_lead(p_lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR NOT private.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'A exclusao permanente de leads e restrita a administradores'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.leads
  WHERE id = p_lead_id
  RETURNING true INTO v_deleted;

  IF NOT COALESCE(v_deleted, false) THEN
    RAISE EXCEPTION 'Lead nao encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.permanently_delete_lead(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.permanently_delete_lead(uuid)
TO authenticated, service_role;

COMMENT ON FUNCTION public.permanently_delete_lead(uuid) IS
  'Exclui um lead e todo o grafo de registros relacionados em uma unica transacao; somente administradores.';

-- -----------------------------------------------------------------------------
-- 2. Cada linha de crm_leads passa a representar uma oportunidade independente
-- -----------------------------------------------------------------------------

ALTER TABLE public.crm_leads
  DROP CONSTRAINT crm_leads_lead_id_pipeline_id_key;

ALTER TABLE public.crm_leads
  ADD COLUMN empreendimento_id uuid,
  ADD COLUMN visita_id uuid,
  ADD CONSTRAINT crm_leads_empreendimento_id_fkey
    FOREIGN KEY (empreendimento_id) REFERENCES public.empreendimentos(id) ON DELETE SET NULL,
  ADD CONSTRAINT crm_leads_visita_id_fkey
    FOREIGN KEY (visita_id) REFERENCES public.visitas(id) ON DELETE SET NULL,
  ADD CONSTRAINT crm_leads_valor_estimado_nonnegative
    CHECK (valor_estimado IS NULL OR valor_estimado >= 0) NOT VALID;

UPDATE public.crm_leads AS opportunity
SET empreendimento_id = lead.empreendimento_id
FROM public.leads AS lead
WHERE lead.id = opportunity.lead_id
  AND opportunity.empreendimento_id IS NULL;

WITH unique_visit AS (
  SELECT opportunity.id AS opportunity_id, (array_agg(visit.id))[1] AS visit_id
  FROM public.crm_leads AS opportunity
  JOIN public.visitas AS visit
    ON visit.lead_id = opportunity.lead_id
   AND (
     opportunity.empreendimento_id IS NULL
     OR visit.empreendimento_id = opportunity.empreendimento_id
   )
  GROUP BY opportunity.id
  HAVING count(*) = 1
)
UPDATE public.crm_leads AS opportunity
SET visita_id = unique_visit.visit_id
FROM unique_visit
WHERE opportunity.id = unique_visit.opportunity_id
  AND opportunity.visita_id IS NULL;

-- Corrige oportunidades historicas ligadas a uma etapa de outro pipeline.
WITH first_stages AS (
  SELECT DISTINCT ON (stage.pipeline_id)
    stage.pipeline_id,
    stage.id
  FROM public.crm_stages AS stage
  ORDER BY stage.pipeline_id, stage.posicao, stage.created_at, stage.id
)
UPDATE public.crm_leads AS opportunity
SET stage_id = first_stages.id,
    posicao = 0,
    moved_at = now(),
    updated_at = now()
FROM first_stages
WHERE first_stages.pipeline_id = opportunity.pipeline_id
  AND (
    opportunity.stage_id IS NULL
    OR NOT EXISTS (
     SELECT 1
     FROM public.crm_stages AS current_stage
     WHERE current_stage.id = opportunity.stage_id
       AND current_stage.pipeline_id = opportunity.pipeline_id
    )
  );

ALTER TABLE public.crm_leads
  VALIDATE CONSTRAINT crm_leads_valor_estimado_nonnegative;

CREATE INDEX idx_crm_opportunities_pipeline_lead
  ON public.crm_leads (pipeline_id, lead_id);

CREATE INDEX idx_crm_opportunities_empreendimento
  ON public.crm_leads (empreendimento_id)
  WHERE empreendimento_id IS NOT NULL;

CREATE UNIQUE INDEX idx_crm_opportunities_pipeline_visit_unique
  ON public.crm_leads (pipeline_id, visita_id)
  WHERE visita_id IS NOT NULL;

COMMENT ON TABLE public.crm_leads IS
  'Oportunidades independentes do CRM. Um lead pode possuir varias oportunidades no mesmo pipeline.';
COMMENT ON COLUMN public.crm_leads.empreendimento_id IS
  'Empreendimento negociado nesta oportunidade, independente do empreendimento principal do lead.';
COMMENT ON COLUMN public.crm_leads.visita_id IS
  'Visita que originou a oportunidade, quando criada automaticamente.';

CREATE OR REPLACE FUNCTION public.validate_crm_opportunity_stage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.stage_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.crm_stages AS stage
       WHERE stage.id = NEW.stage_id
         AND stage.pipeline_id = NEW.pipeline_id
     ) THEN
    RAISE EXCEPTION 'A etapa selecionada nao pertence ao pipeline da oportunidade'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_crm_opportunity_stage_trigger ON public.crm_leads;
CREATE TRIGGER validate_crm_opportunity_stage_trigger
BEFORE INSERT OR UPDATE OF pipeline_id, stage_id ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.validate_crm_opportunity_stage();

-- -----------------------------------------------------------------------------
-- 3. RPCs transacionais para criar oportunidades e leads pelo proprio funil
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_crm_opportunity(
  p_lead_id uuid,
  p_pipeline_id uuid,
  p_stage_id uuid,
  p_empreendimento_id uuid DEFAULT NULL,
  p_valor_estimado numeric DEFAULT NULL,
  p_notas text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_opportunity_id uuid;
  v_position integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR NOT private.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Somente administradores podem criar oportunidades'
      USING ERRCODE = '42501';
  END IF;

  IF p_valor_estimado IS NOT NULL AND p_valor_estimado < 0 THEN
    RAISE EXCEPTION 'O valor estimado nao pode ser negativo'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.leads
    WHERE id = p_lead_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Lead ativo nao encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1
  FROM public.crm_stages
  WHERE id = p_stage_id AND pipeline_id = p_pipeline_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa invalida para o pipeline selecionado'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(max(posicao) + 1, 0)
  INTO v_position
  FROM public.crm_leads
  WHERE pipeline_id = p_pipeline_id
    AND stage_id = p_stage_id;

  INSERT INTO public.crm_leads (
    lead_id,
    pipeline_id,
    stage_id,
    empreendimento_id,
    valor_estimado,
    notas,
    posicao
  ) VALUES (
    p_lead_id,
    p_pipeline_id,
    p_stage_id,
    p_empreendimento_id,
    p_valor_estimado,
    NULLIF(btrim(COALESCE(p_notas, '')), ''),
    v_position
  )
  RETURNING id INTO v_opportunity_id;

  RETURN v_opportunity_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_lead_with_crm_opportunity(
  p_nome text,
  p_telefone text,
  p_email text,
  p_origem text,
  p_observacoes text,
  p_corretor_designado_id uuid,
  p_pipeline_id uuid,
  p_stage_id uuid,
  p_empreendimento_id uuid,
  p_valor_estimado numeric,
  p_notas text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid;
  v_lead_id uuid;
  v_opportunity_id uuid;
  v_position integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR NOT private.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Somente administradores podem cadastrar leads no funil'
      USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(COALESCE(p_nome, '')), '') IS NULL THEN
    RAISE EXCEPTION 'O nome do lead e obrigatorio'
      USING ERRCODE = '23514';
  END IF;

  IF NULLIF(btrim(COALESCE(p_telefone, '')), '') IS NULL THEN
    RAISE EXCEPTION 'O telefone do lead e obrigatorio'
      USING ERRCODE = '23514';
  END IF;

  IF p_valor_estimado IS NOT NULL AND p_valor_estimado < 0 THEN
    RAISE EXCEPTION 'O valor estimado nao pode ser negativo'
      USING ERRCODE = '23514';
  END IF;

  PERFORM 1
  FROM public.crm_stages
  WHERE id = p_stage_id AND pipeline_id = p_pipeline_id
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
    btrim(p_nome),
    btrim(p_telefone),
    NULLIF(btrim(COALESCE(p_email, '')), ''),
    p_empreendimento_id,
    p_corretor_designado_id,
    COALESCE(NULLIF(btrim(COALESCE(p_origem, '')), ''), 'outro'),
    NULLIF(btrim(COALESCE(p_observacoes, '')), ''),
    'novo'::public.lead_status,
    v_profile_id
  )
  RETURNING id INTO v_lead_id;

  SELECT COALESCE(max(posicao) + 1, 0)
  INTO v_position
  FROM public.crm_leads
  WHERE pipeline_id = p_pipeline_id
    AND stage_id = p_stage_id;

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
    p_pipeline_id,
    p_stage_id,
    p_empreendimento_id,
    p_valor_estimado,
    NULLIF(btrim(COALESCE(p_notas, '')), ''),
    v_position
  )
  RETURNING id INTO v_opportunity_id;

  RETURN jsonb_build_object(
    'lead_id', v_lead_id,
    'opportunity_id', v_opportunity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_crm_opportunity(
  uuid, uuid, uuid, uuid, numeric, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_crm_opportunity(
  uuid, uuid, uuid, uuid, numeric, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_lead_with_crm_opportunity(
  text, text, text, text, text, uuid, uuid, uuid, uuid, numeric, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_lead_with_crm_opportunity(
  text, text, text, text, text, uuid, uuid, uuid, uuid, numeric, text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.create_crm_opportunity(uuid, uuid, uuid, uuid, numeric, text) IS
  'Cria uma oportunidade independente para um lead ativo; permite varias oportunidades por lead e pipeline.';
COMMENT ON FUNCTION public.create_lead_with_crm_opportunity(text, text, text, text, text, uuid, uuid, uuid, uuid, numeric, text) IS
  'Cadastra lead e primeira oportunidade atomicamente a partir do funil.';

-- -----------------------------------------------------------------------------
-- 4. Automacoes passam a operar por oportunidade/visita, nunca por lead inteiro
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_add_lead_to_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pipeline_id uuid;
  v_first_stage_id uuid;
  v_position integer;
BEGIN
  SELECT id INTO v_pipeline_id
  FROM public.crm_pipelines
  WHERE is_default = true AND auto_add_visits = true
  ORDER BY created_at, id
  LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_first_stage_id
  FROM public.crm_stages
  WHERE pipeline_id = v_pipeline_id
  ORDER BY posicao, created_at, id
  LIMIT 1;

  IF v_first_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(max(posicao) + 1, 0)
  INTO v_position
  FROM public.crm_leads
  WHERE pipeline_id = v_pipeline_id
    AND stage_id = v_first_stage_id;

  INSERT INTO public.crm_leads (
    lead_id,
    pipeline_id,
    stage_id,
    empreendimento_id,
    visita_id,
    posicao
  ) VALUES (
    NEW.lead_id,
    v_pipeline_id,
    v_first_stage_id,
    NEW.empreendimento_id,
    NEW.id,
    v_position
  )
  ON CONFLICT (pipeline_id, visita_id) WHERE visita_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_crm_visit_automations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.crm_leads AS opportunity
    SET stage_id = automation.target_stage_id,
        moved_at = now(),
        updated_at = now()
    FROM public.crm_automations AS automation
    WHERE automation.pipeline_id = opportunity.pipeline_id
      AND automation.trigger_type = 'visit_status_change'
      AND automation.trigger_value = NEW.status
      AND automation.is_active = true
      AND opportunity.visita_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_add_lead_to_crm()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_add_lead_to_crm() TO service_role;

REVOKE ALL ON FUNCTION public.process_crm_visit_automations()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_crm_visit_automations() TO service_role;
