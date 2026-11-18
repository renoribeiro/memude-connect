-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

create or replace function private.f1_exigir_comercial()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare u uuid := (select auth.uid());
begin
  if u is null or not exists (select 1 from public.user_roles r where r.user_id = u and r.role in ('admin','sdr','closer')) then
    raise exception 'Acesso restrito à equipe comercial' using errcode = '42501';
  end if;
  return u;
end $$;

create or replace function private.f1_lead_json(p_lead uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', l.id, 'nome', l.nome, 'telefone', l.telefone, 'telefone_exibicao', l.telefone_exibicao,
    'telefone_chave', l.telefone_chave, 'status_atendimento', l.status_atendimento, 'fonte', l.fonte,
    'empreendimento_id', l.empreendimento_id, 'empreendimento', e.nome,
    'responsavel_id', l.responsavel_id, 'responsavel', nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''),
    'data_entrada', l.data_entrada, 'observacoes', l.observacoes, 'url', '/admin/leads/' || l.id
  )
  from public.leads l
  left join public.empreendimentos e on e.id = l.empreendimento_id
  left join public.profiles p on p.user_id = l.responsavel_id
  where l.id = p_lead;
$$;

-- Equipe para os campos Responsável / dono de tarefa
create or replace function public.equipe_comercial()
returns table (user_id uuid, nome text, papel text, responsavel boolean, closer boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare cfg public.fase1_config;
begin
  perform private.f1_exigir_comercial();
  select * into cfg from public.fase1_config where id;
  return query
  select r.user_id, btrim(p.first_name || ' ' || p.last_name), r.role::text,
         r.user_id = any(cfg.responsaveis), r.user_id = cfg.closer_user_id
  from public.user_roles r
  join public.profiles p on p.user_id = r.user_id
  where r.role in ('admin','sdr','closer') and coalesce(p.is_active, true)
  order by (r.user_id = any(cfg.responsaveis)) desc, p.first_name;
end $$;

create or replace function public.lead_buscar_por_telefone(p_telefone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_chave text := public.normalize_phone_key(p_telefone);
  v_id uuid;
begin
  perform private.f1_exigir_comercial();
  if v_chave is null then
    return jsonb_build_object('existe', false, 'chave', null, 'valido', false);
  end if;
  select l.id into v_id from public.leads l
  where l.telefone_chave = v_chave and l.deleted_at is null
  order by l.telefone_chave_conflito, l.created_at
  limit 1;
  return jsonb_build_object(
    'existe', v_id is not null, 'valido', true, 'chave', v_chave,
    'telefone_exibicao', public.normalize_phone_display(p_telefone),
    'lead', case when v_id is null then null else private.f1_lead_json(v_id) end
  );
end $$;

create or replace function public.lead_criar(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ator uuid := private.f1_exigir_comercial();
  cfg public.fase1_config;
  v_nome text := btrim(coalesce(p_dados->>'nome', ''));
  v_tel text := btrim(coalesce(p_dados->>'telefone', ''));
  v_chave text := public.normalize_phone_key(v_tel);
  v_fonte text := nullif(btrim(coalesce(p_dados->>'fonte', '')), '');
  v_status text := coalesce(nullif(btrim(coalesce(p_dados->>'status_atendimento', '')), ''), 'NOVO');
  v_resp uuid := nullif(p_dados->>'responsavel_id', '')::uuid;
  v_emp uuid := nullif(p_dados->>'empreendimento_id', '')::uuid;
  v_obs text := nullif(btrim(coalesce(p_dados->>'observacoes', '')), '');
  v_origem text := coalesce(nullif(btrim(coalesce(p_dados->>'origem', '')), ''), 'core');
  v_existente uuid;
  v_novo uuid;
  v_profile uuid;
begin
  if length(v_nome) < 2 or length(v_nome) > 120 then
    raise exception 'Informe o nome do lead (2 a 120 caracteres)' using errcode = '22023';
  end if;
  if v_chave is null or length(regexp_replace(v_tel, '\D', '', 'g')) < 10 then
    raise exception 'Telefone inválido: informe DDD e número' using errcode = '22023';
  end if;
  if v_fonte is not null and v_fonte not in ('Google','Meta','Cadastro','Follow','Outros') then
    raise exception 'Fonte inválida' using errcode = '22023';
  end if;
  if v_status not in ('NOVO','EM CONVERSA','INTERESSADO','VISITA AGENDADA','INVESTIDOR','CORRETOR','SEM RENDA','NÃO INTERESSADO') then
    raise exception 'Status inválido' using errcode = '22023';
  end if;
  if v_obs is not null and length(v_obs) > 4000 then
    raise exception 'Observação muito longa (máximo 4.000 caracteres)' using errcode = '22023';
  end if;

  -- Serializa cadastros do mesmo telefone (extensão + tela ao mesmo tempo)
  perform pg_advisory_xact_lock(hashtext('lead:' || v_chave));

  select l.id into v_existente from public.leads l
  where l.telefone_chave = v_chave and l.deleted_at is null
  order by l.telefone_chave_conflito, l.created_at limit 1;
  if v_existente is not null then
    return jsonb_build_object('criado', false, 'duplicado', true, 'lead_id', v_existente, 'lead', private.f1_lead_json(v_existente));
  end if;

  select * into cfg from public.fase1_config where id;
  if v_resp is null and ator = any(cfg.responsaveis) then v_resp := ator; end if;
  select p.id into v_profile from public.profiles p where p.user_id = ator;

  insert into public.leads (nome, telefone, empreendimento_id, fonte, status_atendimento, responsavel_id,
                            observacoes, origem, created_by)
  values (v_nome, public.normalize_phone_canonical(v_tel), v_emp, v_fonte, v_status, v_resp,
          v_obs, v_origem, v_profile)
  returning id into v_novo;

  return jsonb_build_object('criado', true, 'duplicado', false, 'lead_id', v_novo, 'lead', private.f1_lead_json(v_novo));
end $$;

-- Edição na célula (lista branca de campos)
create or replace function public.lead_atualizar(p_lead_id uuid, p_campos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ator uuid := private.f1_exigir_comercial();
  k text;
  v_tel text;
begin
  for k in select jsonb_object_keys(p_campos) loop
    if k not in ('nome','telefone','email','empreendimento_id','fonte','status_atendimento','responsavel_id','observacoes') then
      raise exception 'Campo % não pode ser editado por aqui', k using errcode = '22023';
    end if;
  end loop;

  if p_campos ? 'nome' and length(btrim(coalesce(p_campos->>'nome',''))) not between 2 and 120 then
    raise exception 'Informe o nome do lead (2 a 120 caracteres)' using errcode = '22023';
  end if;
  if p_campos ? 'telefone' then
    v_tel := btrim(coalesce(p_campos->>'telefone',''));
    if public.normalize_phone_key(v_tel) is null or length(regexp_replace(v_tel, '\D', '', 'g')) < 10 then
      raise exception 'Telefone inválido: informe DDD e número' using errcode = '22023';
    end if;
  end if;

  perform set_config('memude.fase1', '1', true);
  update public.leads l set
    nome = case when p_campos ? 'nome' then btrim(p_campos->>'nome') else l.nome end,
    telefone = case when p_campos ? 'telefone' then public.normalize_phone_canonical(v_tel) else l.telefone end,
    email = case when p_campos ? 'email' then nullif(btrim(p_campos->>'email'), '') else l.email end,
    empreendimento_id = case when p_campos ? 'empreendimento_id' then nullif(p_campos->>'empreendimento_id','')::uuid else l.empreendimento_id end,
    fonte = case when p_campos ? 'fonte' then nullif(p_campos->>'fonte','') else l.fonte end,
    status_atendimento = case when p_campos ? 'status_atendimento' then p_campos->>'status_atendimento' else l.status_atendimento end,
    responsavel_id = case when p_campos ? 'responsavel_id' then nullif(p_campos->>'responsavel_id','')::uuid else l.responsavel_id end,
    observacoes = case when p_campos ? 'observacoes' then nullif(left(p_campos->>'observacoes', 4000), '') else l.observacoes end
  where l.id = p_lead_id and l.deleted_at is null;
  if not found then
    raise exception 'Lead não encontrado' using errcode = 'P0002';
  end if;
  return private.f1_lead_json(p_lead_id);
end $$;

revoke all on function public.equipe_comercial() from public, anon;
revoke all on function public.lead_buscar_por_telefone(text) from public, anon;
revoke all on function public.lead_criar(jsonb) from public, anon;
revoke all on function public.lead_atualizar(uuid, jsonb) from public, anon;
grant execute on function public.equipe_comercial() to authenticated;
grant execute on function public.lead_buscar_por_telefone(text) to authenticated;
grant execute on function public.lead_criar(jsonb) to authenticated;
grant execute on function public.lead_atualizar(uuid, jsonb) to authenticated;
revoke all on function private.f1_exigir_comercial() from public, anon;
grant execute on function private.f1_exigir_comercial() to authenticated;
;
