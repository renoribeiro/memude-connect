-- Use the caller-visible role row. The legacy public.has_role wrapper requires private schema usage.
-- Keep SECURITY INVOKER and existing RLS; no schema grants or privilege expansion.
CREATE OR REPLACE FUNCTION public.save_crm_pipeline_settings(p_pipeline_id uuid, p_nome text,
  p_descricao text, p_auto_add_visits boolean, p_stages jsonb, p_completed_stage_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE old_completed uuid; item record;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') THEN
    RAISE EXCEPTION 'Somente administradores podem configurar o funil' USING ERRCODE = '42501';
  END IF;
  SELECT completed_stage_id INTO old_completed FROM public.crm_pipelines WHERE id = p_pipeline_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funil não encontrado'; END IF;
  IF nullif(trim(p_nome), '') IS NULL OR jsonb_typeof(p_stages) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_stages) = 0 THEN RAISE EXCEPTION 'Informe o nome e pelo menos uma etapa'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_stages) AS s(id uuid,nome text)
    WHERE s.id IS NULL OR nullif(trim(s.nome),'') IS NULL)
    OR (SELECT count(*) <> count(DISTINCT s.id) FROM jsonb_to_recordset(p_stages) AS s(id uuid)) THEN
    RAISE EXCEPTION 'Etapas inválidas ou duplicadas';
  END IF;
  IF p_completed_stage_id IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM jsonb_to_recordset(p_stages) AS s(id uuid) WHERE s.id = p_completed_stage_id) THEN
    RAISE EXCEPTION 'Selecione uma etapa do próprio funil para vendas concluídas';
  END IF;
  IF p_completed_stage_id IS NULL AND EXISTS
    (SELECT 1 FROM public.crm_leads WHERE pipeline_id = p_pipeline_id AND venda_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Este funil possui vendas; selecione uma coluna de vendas concluídas';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_stages) AS s(id uuid)
    JOIN public.crm_stages existing ON existing.id = s.id WHERE existing.pipeline_id <> p_pipeline_id) THEN
    RAISE EXCEPTION 'Uma etapa pertence a outro funil';
  END IF;
  -- All edits are one transaction, including stage creation and destination change.
  FOR item IN SELECT * FROM jsonb_to_recordset(p_stages)
    AS s(id uuid,nome text,cor text,posicao integer,is_final boolean) LOOP
    INSERT INTO public.crm_stages(id,pipeline_id,nome,cor,posicao,is_final)
      VALUES(item.id,p_pipeline_id,trim(item.nome),coalesce(item.cor,'#059669'),item.posicao,coalesce(item.is_final,false))
      ON CONFLICT(id) DO UPDATE SET nome=excluded.nome,cor=excluded.cor,posicao=excluded.posicao,is_final=excluded.is_final;
  END LOOP;
  UPDATE public.crm_pipelines SET nome=trim(p_nome),descricao=p_descricao,
    auto_add_visits=p_auto_add_visits,completed_stage_id=p_completed_stage_id WHERE id=p_pipeline_id;
  IF p_completed_stage_id IS DISTINCT FROM old_completed AND p_completed_stage_id IS NOT NULL THEN
    UPDATE public.crm_leads SET stage_id=p_completed_stage_id
      WHERE pipeline_id=p_pipeline_id AND (stage_id=old_completed OR venda_id IS NOT NULL);
  END IF;
  -- Include cards already in the newly selected column, and clear stale completion on unconfigured cards.
  IF p_completed_stage_id IS DISTINCT FROM old_completed THEN
    UPDATE public.crm_leads SET stage_id=stage_id WHERE pipeline_id=p_pipeline_id
      AND (stage_id=p_completed_stage_id OR (completed_at IS NOT NULL AND venda_id IS NULL));
  END IF;
  IF EXISTS (SELECT 1 FROM public.crm_leads c WHERE c.pipeline_id=p_pipeline_id AND c.stage_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_stages) AS s(id uuid) WHERE s.id=c.stage_id)) THEN
    RAISE EXCEPTION 'Mova os cartões antes de excluir uma etapa ocupada';
  END IF;
  DELETE FROM public.crm_stages s WHERE s.pipeline_id=p_pipeline_id
    AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_stages) AS keep(id uuid) WHERE keep.id=s.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_crm_sale(p_crm_lead_id uuid,p_sale jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE c public.crm_leads; destination uuid; sale_id uuid; amount numeric; commission numeric;
  tax numeric; direct boolean; broker uuid; property uuid; sale_date date; actor uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') THEN
    RAISE EXCEPTION 'Somente administradores podem registrar vendas' USING ERRCODE='42501';
  END IF;
  -- Same lock order as settings: pipeline then opportunity. Serializes retries and reconfiguration.
  SELECT p.completed_stage_id INTO destination FROM public.crm_pipelines p
    JOIN public.crm_leads cl ON cl.pipeline_id=p.id WHERE cl.id=p_crm_lead_id FOR UPDATE OF p;
  SELECT * INTO c FROM public.crm_leads WHERE id=p_crm_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oportunidade não encontrada'; END IF;
  IF c.venda_id IS NOT NULL THEN RETURN c.venda_id; END IF;
  IF c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Oportunidade arquivada'; END IF;
  IF destination IS NULL THEN RAISE EXCEPTION 'Configure a coluna de vendas concluídas neste funil'; END IF;
  amount := (p_sale->>'valor_imovel')::numeric;
  commission := (p_sale->>'comissao_percentual')::numeric;
  tax := (p_sale->>'imposto_percentual')::numeric;
  direct := coalesce((p_sale->>'is_venda_direta')::boolean,false);
  broker := nullif(p_sale->>'corretor_id','')::uuid;
  property := nullif(p_sale->>'empreendimento_id','')::uuid;
  sale_date := (p_sale->>'data_venda')::date;
  IF amount IS NULL OR amount <= 0 OR amount >= 1e12 OR amount::text IN ('NaN','Infinity','-Infinity')
    OR commission IS NULL OR NOT (commission BETWEEN 0 AND 100)
    OR tax IS NULL OR NOT (tax BETWEEN 0 AND 100) THEN RAISE EXCEPTION 'Valor ou percentuais inválidos'; END IF;
  IF property IS NULL OR NOT EXISTS (SELECT 1 FROM public.empreendimentos WHERE id=property AND ativo=true) THEN
    RAISE EXCEPTION 'Selecione um empreendimento ativo'; END IF;
  IF NOT direct AND (broker IS NULL OR NOT EXISTS
    (SELECT 1 FROM public.corretores WHERE id=broker AND status='ativo' AND deleted_at IS NULL)) THEN
    RAISE EXCEPTION 'Selecione o corretor ou marque Venda Direta'; END IF;
  IF sale_date IS NULL OR sale_date > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'Informe uma data de venda válida, até hoje'; END IF;
  IF coalesce(p_sale->>'status','') NOT IN ('pendente','paga') THEN
    RAISE EXCEPTION 'A venda deve estar pendente ou paga'; END IF;
  SELECT id INTO actor FROM public.profiles WHERE user_id=auth.uid();
  INSERT INTO public.vendas(lead_id,empreendimento_id,corretor_id,valor_imovel,comissao_percentual,
    imposto_percentual,is_venda_direta,status,data_venda,data_pagamento,observacoes,created_by,comprovantes)
  VALUES(c.lead_id,property,CASE WHEN direct THEN NULL ELSE broker END,round(amount,2),commission,tax,direct,
    (p_sale->>'status')::public.venda_status,sale_date,nullif(p_sale->>'data_pagamento','')::date,
    nullif(p_sale->>'observacoes',''),actor,
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_sale->'comprovantes','[]'::jsonb)))) RETURNING id INTO sale_id;
  UPDATE public.crm_leads SET venda_id=sale_id,stage_id=destination,valor_estimado=round(amount,2),
    empreendimento_id=property,completed_at=now(),moved_at=now() WHERE id=c.id;
  IF NOT direct THEN UPDATE public.leads SET corretor_designado_id=broker WHERE id=c.lead_id; END IF;
  RETURN sale_id;
END;
$$;
