-- Extensão do WhatsApp (Fase B): qualificação do lead e lembrete de retomada.

alter table public.leads add column if not exists qualificacao jsonb;
comment on column public.leads.qualificacao is 'Checklist do SDR: renda, entrada_fgts, regiao, prazo, finalidade, atualizado_em';

-- Ficha do lead devolvida à extensão e ao Connect: inclui a qualificação
create or replace function private.f1_lead_json(p_lead uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', l.id, 'nome', l.nome, 'telefone', l.telefone, 'telefone_exibicao', l.telefone_exibicao,
    'telefone_chave', l.telefone_chave, 'status_atendimento', l.status_atendimento, 'fonte', l.fonte,
    'empreendimento_id', l.empreendimento_id, 'empreendimento', e.nome, 'responsavel_id', l.responsavel_id,
    'responsavel', nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''),
    'data_entrada', l.data_entrada, 'observacoes', l.observacoes, 'qualificacao', l.qualificacao,
    'url', '/leads/' || l.id)
  from public.leads l
  left join public.empreendimentos e on e.id = l.empreendimento_id
  left join public.profiles p on p.user_id = l.responsavel_id
  where l.id = p_lead;
$$;

-- lead_atualizar passa a aceitar "qualificacao" (mesclada à existente)
create or replace function public.lead_atualizar(p_lead_id uuid, p_campos jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ator uuid := private.f1_exigir_comercial(); k text; v_tel text;
begin
  for k in select jsonb_object_keys(p_campos) loop
    if k not in ('nome','telefone','email','empreendimento_id','fonte','status_atendimento','responsavel_id','observacoes','qualificacao') then
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
  if p_campos ? 'qualificacao' and (jsonb_typeof(p_campos->'qualificacao') <> 'object' or length((p_campos->'qualificacao')::text) > 4000) then
    raise exception 'Qualificação inválida' using errcode = '22023';
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
    observacoes = case when p_campos ? 'observacoes' then nullif(left(p_campos->>'observacoes', 4000), '') else l.observacoes end,
    qualificacao = case when p_campos ? 'qualificacao'
      then jsonb_strip_nulls(coalesce(l.qualificacao, '{}'::jsonb) || (p_campos->'qualificacao') || jsonb_build_object('atualizado_em', now()))
      else l.qualificacao end
  where l.id = p_lead_id and l.deleted_at is null;
  if not found then raise exception 'Lead não encontrado' using errcode = 'P0002'; end if;
  return private.f1_lead_json(p_lead_id);
end $$;

-- Lembrete de retomada: vira tarefa na tela Hoje de quem pediu, no dia escolhido (9h de Fortaleza)
create or replace function public.lead_lembrete(p_lead_id uuid, p_dias int, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ator uuid := private.f1_exigir_comercial(); l public.leads; v_quando timestamptz; v_id uuid;
begin
  if p_dias is null or p_dias < 0 or p_dias > 60 then raise exception 'Escolha de 0 a 60 dias' using errcode = '22023'; end if;
  select * into l from public.leads where id = p_lead_id and deleted_at is null;
  if not found then raise exception 'Lead não encontrado' using errcode = 'P0002'; end if;
  v_quando := ((now() at time zone 'America/Fortaleza')::date + p_dias + time '09:00') at time zone 'America/Fortaleza';
  if v_quando < now() then v_quando := now(); end if;
  insert into public.tarefas (tipo, titulo, lead_id, dono_id, disponivel_em, vence_em, status, observacao)
  values ('manual', 'Retomar contato com ' || coalesce(nullif(btrim(l.nome), ''), 'lead'), l.id, ator, v_quando,
    ((v_quando at time zone 'America/Fortaleza')::date + time '18:00') at time zone 'America/Fortaleza', 'pendente',
    nullif(left(btrim(coalesce(p_observacao, '')), 1000), ''))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'disponivel_em', v_quando);
end $$;
revoke all on function public.lead_lembrete(uuid, int, text) from public, anon;
grant execute on function public.lead_lembrete(uuid, int, text) to authenticated;
