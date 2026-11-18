-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

-- Reagendamento não cria card duplicado no funil (reaproveita o card da visita original)
insert into backup_20261117.function_defs (funcao, definicao, salvo_em)
select 'public.auto_add_lead_to_crm', pg_get_functiondef('public.auto_add_lead_to_crm'::regproc), now()
where not exists (select 1 from backup_20261117.function_defs where funcao = 'public.auto_add_lead_to_crm');

do $$
declare d text;
begin
  d := pg_get_functiondef('public.auto_add_lead_to_crm'::regproc);
  if position('memude.reagendamento' in d) = 0 then
    d := regexp_replace(d, '(\r?\n)BEGIN(\r?\n)',
      '\1BEGIN\2  IF coalesce(current_setting(''memude.reagendamento'', true), '''') = ''1'' THEN RETURN NEW; END IF;\2');
    if position('memude.reagendamento' in d) = 0 then raise exception 'Guarda não aplicada'; end if;
    execute d;
  end if;
end $$;

create or replace function private.f1_inicio(p_data date, p_hora time)
returns timestamptz language sql stable as $$
  select (p_data + p_hora) at time zone 'America/Fortaleza';
$$;

create or replace function private.f1_nome_usuario(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select nullif(btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), '') from public.profiles where user_id = p_user;
$$;

create or replace function private.f1_nome_corretor(p_corretor uuid)
returns text language sql stable security definer set search_path = '' as $$
  select nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), '')
  from public.corretores c join public.profiles p on p.id = c.profile_id where c.id = p_corretor;
$$;

create or replace function private.f1_evento(p_visita uuid, p_kind text, p_payload jsonb, p_ator uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.visit_events (visita_id, revision, kind, payload, ator_id)
  select p_visita, c.revision, p_kind, coalesce(p_payload, '{}'::jsonb), p_ator
  from public.visit_cycles c where c.visita_id = p_visita;
$$;

create or replace function private.f1_status(p_visita uuid, p_para text, p_ator uuid, p_obs text default null, p_extra jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_de text;
begin
  select status into v_de from public.visitas where id = p_visita;
  if v_de is distinct from p_para then
    update public.visitas set status = p_para where id = p_visita;
  end if;
  perform private.f1_evento(p_visita, 'f1_status',
    jsonb_build_object('de', v_de, 'para', p_para, 'observacao', p_obs) || coalesce(p_extra, '{}'::jsonb), p_ator);
end $$;

create or replace function private.f1_tarefa(p_tipo text, p_titulo text, p_visita uuid, p_lead uuid, p_dono uuid,
  p_disponivel timestamptz, p_vence timestamptz)
returns void language sql security definer set search_path = '' as $$
  insert into public.tarefas (tipo, titulo, visita_id, lead_id, dono_id, disponivel_em, vence_em)
  values (p_tipo, p_titulo, p_visita, p_lead, p_dono, least(p_disponivel, p_vence), p_vence)
  on conflict (visita_id, tipo) where status = 'pendente' and visita_id is not null
  do update set titulo = excluded.titulo, dono_id = excluded.dono_id,
    disponivel_em = excluded.disponivel_em, vence_em = excluded.vence_em;
$$;

create or replace function private.f1_fechar_tarefas(p_visita uuid, p_tipos text[], p_status text, p_ator uuid, p_obs text default null)
returns void language sql security definer set search_path = '' as $$
  update public.tarefas set status = p_status, concluida_em = now(), concluida_por = p_ator,
    observacao = coalesce(p_obs, observacao)
  where visita_id = p_visita and status = 'pendente' and (p_tipos is null or tipo = any(p_tipos));
$$;

create or replace function private.f1_visita(p_visita uuid)
returns public.visitas language plpgsql security definer set search_path = '' as $$
declare v public.visitas;
begin
  select * into v from public.visitas where id = p_visita and deleted_at is null for update;
  if not found then raise exception 'Visita não encontrada' using errcode = 'P0002'; end if;
  return v;
end $$;

create or replace function private.f1_validar_corretor(p_corretor uuid, p_data date, p_hora time, p_ignorar uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_conflito uuid; v_codigo text;
begin
  if not exists (select 1 from public.corretores where id = p_corretor and deleted_at is null and status = 'ativo') then
    raise exception 'Corretor inativo ou não encontrado' using errcode = '22023';
  end if;
  perform 1 from public.corretores where id = p_corretor for update;
  v_conflito := private.f1_corretor_ocupado(p_corretor, p_data, p_hora, p_ignorar);
  if v_conflito is not null then
    select visit_code into v_codigo from public.visitas where id = v_conflito;
    raise exception 'Este corretor já tem a visita % nesse horário (reserva de 60 min + 30 de intervalo). Escolha outro corretor ou horário.', coalesce(v_codigo, '')
      using errcode = '23P01';
  end if;
end $$;

create or replace function private.f1_tarefas_confirmacao(p_visita uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.visitas;
  cfg public.fase1_config;
  tz constant text := 'America/Fortaleza';
  hoje date := (now() at time zone 'America/Fortaleza')::date;
  inicio timestamptz;
  agenda uuid;
  closer uuid;
  lead_nome text;
begin
  select * into v from public.visitas where id = p_visita;
  select * into cfg from public.fase1_config where id;
  select nome into lead_nome from public.leads where id = v.lead_id;
  inicio := private.f1_inicio(v.data_visita, v.horario_visita);
  agenda := coalesce(v.criado_por, (select auth.uid()));
  closer := coalesce(cfg.closer_user_id, agenda);

  if v.data_visita - 2 >= hoje then
    perform private.f1_tarefa('confirmacao_d2', 'Confirmar visita (D-2) — ' || lead_nome, v.id, v.lead_id, agenda,
      ((v.data_visita - 2)::timestamp at time zone tz),
      greatest((((v.data_visita - 2) + time '20:00') at time zone tz), now() + interval '1 hour'));
  end if;
  if v.data_visita - 1 >= hoje then
    perform private.f1_tarefa('confirmacao_d1', 'Confirmar visita (D-1) — ' || lead_nome, v.id, v.lead_id, agenda,
      ((v.data_visita - 1)::timestamp at time zone tz),
      greatest((((v.data_visita - 1) + time '20:00') at time zone tz), now() + interval '1 hour'));
  end if;
  perform private.f1_tarefa('confirmacao_d0', 'Confirmar visita de hoje (D0) — ' || lead_nome, v.id, v.lead_id, closer,
    (v.data_visita::timestamp at time zone tz),
    greatest(inicio - make_interval(hours => cfg.prazo_d0_horas_antes), least(now() + interval '30 minutes', inicio)));
  perform private.f1_tarefa('registrar_resultado', 'Registrar se a visita aconteceu — ' || lead_nome, v.id, v.lead_id, closer,
    inicio, inicio + make_interval(hours => cfg.prazo_resultado_horas));
end $$;

-- ===== Agendar =====
create or replace function public.visita_agendar(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ator uuid := private.f1_exigir_comercial();
  cfg public.fase1_config;
  l public.leads;
  v_data date := nullif(p_dados->>'data', '')::date;
  v_hora time := nullif(p_dados->>'hora', '')::time;
  v_emp uuid := nullif(p_dados->>'empreendimento_id', '')::uuid;
  v_corretor uuid := nullif(p_dados->>'corretor_id', '')::uuid;
  v_local text := btrim(coalesce(p_dados->>'local_nome', ''));
  v_end text := btrim(coalesce(p_dados->>'endereco', ''));
  v_bairro text := btrim(coalesce(p_dados->>'bairro', ''));
  v_perfil text := nullif(btrim(coalesce(p_dados->>'perfil', '')), '');
  v_id uuid;
  v_codigo text;
begin
  perform set_config('memude.fase1', '1', true);
  select * into cfg from public.fase1_config where id;
  select * into l from public.leads where id = nullif(p_dados->>'lead_id', '')::uuid and deleted_at is null;
  if not found then raise exception 'Lead não encontrado' using errcode = 'P0002'; end if;
  if v_data is null or v_hora is null then raise exception 'Informe data e horário da visita' using errcode = '22023'; end if;
  if private.f1_inicio(v_data, v_hora) < now() - interval '5 minutes' then
    raise exception 'A data e o horário precisam estar no futuro' using errcode = '22023';
  end if;
  if v_emp is null or not exists (select 1 from public.empreendimentos where id = v_emp) then
    raise exception 'Selecione o empreendimento' using errcode = '22023';
  end if;
  if length(v_local) < 2 then raise exception 'Informe o local (decorado ou stand)' using errcode = '22023'; end if;
  if length(v_end) < 5 then raise exception 'Informe o endereço do local' using errcode = '22023'; end if;
  if length(v_bairro) < 2 then raise exception 'Informe o bairro' using errcode = '22023'; end if;
  if v_corretor is null then raise exception 'Selecione o corretor' using errcode = '22023'; end if;
  if length(v_local) > 120 or length(v_end) > 300 or length(v_bairro) > 120 or length(coalesce(v_perfil, '')) > 2000 then
    raise exception 'Algum campo excede o tamanho permitido' using errcode = '22023';
  end if;
  perform private.f1_validar_corretor(v_corretor, v_data, v_hora, null);

  insert into public.visitas (lead_id, corretor_id, empreendimento_id, data_visita, horario_visita, status,
    local_nome, meeting_address, meeting_neighborhood, customer_profile, criado_por, fase1, intake_source)
  values (l.id, v_corretor, v_emp, v_data, v_hora, 'aguardando_corretor',
    v_local, v_end, v_bairro, v_perfil, ator, true, 'fase1_manual')
  returning id, visit_code into v_id, v_codigo;

  insert into public.visit_cycles (visita_id, scheduled_at, match_status)
  values (v_id, private.f1_inicio(v_data, v_hora), 'searching');

  perform private.f1_evento(v_id, 'f1_criada', jsonb_build_object('para', 'aguardando_corretor',
    'data', v_data, 'hora', v_hora, 'local', v_local), ator);

  insert into public.visita_convites (visita_id, corretor_id, score, motivo_sugestao, criado_por)
  values (v_id, v_corretor, nullif(p_dados->>'score', '')::numeric, left(nullif(p_dados->>'motivo_sugestao', ''), 500), ator);
  perform private.f1_evento(v_id, 'f1_convite', jsonb_build_object('corretor_id', v_corretor,
    'corretor', private.f1_nome_corretor(v_corretor)), ator);

  perform private.f1_tarefa('aceite_corretor', 'Aguardando aceite do corretor — ' || l.nome, v_id, l.id, ator,
    now(), now() + make_interval(mins => cfg.prazo_aceite_min));

  update public.leads set
    status_atendimento = case when status_atendimento in ('NOVO','EM CONVERSA','INTERESSADO') then 'VISITA AGENDADA' else status_atendimento end,
    empreendimento_id = coalesce(empreendimento_id, v_emp),
    status = case when status::text in ('novo','follow_up','cancelado') then 'buscando_corretor'::public.lead_status else status end
  where id = l.id;

  return jsonb_build_object('visita_id', v_id, 'visit_code', v_codigo, 'status', 'aguardando_corretor');
end $$;

-- ===== Convidar (outro) corretor =====
create or replace function public.visita_convidar_corretor(p_visita_id uuid, p_corretor_id uuid,
  p_score numeric default null, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ator uuid := private.f1_exigir_comercial();
  cfg public.fase1_config;
  v public.visitas;
  pend public.visita_convites;
  lead_nome text;
begin
  perform set_config('memude.fase1', '1', true);
  select * into cfg from public.fase1_config where id;
  v := private.f1_visita(p_visita_id);
  if v.status <> 'aguardando_corretor' then
    raise exception 'Só é possível convidar corretor enquanto a visita aguarda corretor' using errcode = '22023';
  end if;
  perform private.f1_validar_corretor(p_corretor_id, v.data_visita, v.horario_visita, v.id);

  select * into pend from public.visita_convites where visita_id = v.id and resposta is null for update;
  if found then
    if pend.corretor_id = p_corretor_id then
      raise exception 'Este corretor já foi convidado e ainda não respondeu' using errcode = '22023';
    end if;
    update public.visita_convites set resposta = 'sem_resposta', respondido_em = now() where id = pend.id;
    perform private.f1_evento(v.id, 'f1_resposta_corretor', jsonb_build_object('corretor_id', pend.corretor_id,
      'corretor', private.f1_nome_corretor(pend.corretor_id), 'resposta', 'sem_resposta'), ator);
  end if;

  insert into public.visita_convites (visita_id, corretor_id, score, motivo_sugestao, criado_por)
  values (v.id, p_corretor_id, p_score, left(p_motivo, 500), ator);
  update public.visitas set corretor_id = p_corretor_id where id = v.id;
  perform private.f1_evento(v.id, 'f1_convite', jsonb_build_object('corretor_id', p_corretor_id,
    'corretor', private.f1_nome_corretor(p_corretor_id)), ator);

  select nome into lead_nome from public.leads where id = v.lead_id;
  perform private.f1_tarefa('aceite_corretor', 'Aguardando aceite do corretor — ' || lead_nome, v.id, v.lead_id, ator,
    now(), now() + make_interval(mins => cfg.prazo_aceite_min));
  return jsonb_build_object('visita_id', v.id, 'status', 'aguardando_corretor', 'corretor_id', p_corretor_id);
end $$;

-- ===== Corretor aceitou? =====
create or replace function public.visita_resposta_corretor(p_visita_id uuid, p_aceitou boolean, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ator uuid := private.f1_exigir_comercial();
  v public.visitas;
  pend public.visita_convites;
begin
  perform set_config('memude.fase1', '1', true);
  v := private.f1_visita(p_visita_id);
  if v.status <> 'aguardando_corretor' then
    raise exception 'Esta visita não está aguardando resposta de corretor' using errcode = '22023';
  end if;
  select * into pend from public.visita_convites where visita_id = v.id and resposta is null for update;
  if not found then raise exception 'Não há convite pendente para esta visita' using errcode = '22023'; end if;

  if p_aceitou then
    perform private.f1_validar_corretor(pend.corretor_id, v.data_visita, v.horario_visita, v.id);
    update public.visita_convites set resposta = 'aceitou', respondido_em = now() where id = pend.id;
    update public.visit_cycles set match_status = 'accepted', broker_confirmed = true, updated_at = now() where visita_id = v.id;
    update public.visitas set corretor_id = pend.corretor_id where id = v.id and corretor_id is distinct from pend.corretor_id;
    perform private.f1_status(v.id, 'agendada', ator, p_observacao,
      jsonb_build_object('corretor_id', pend.corretor_id, 'corretor', private.f1_nome_corretor(pend.corretor_id), 'resposta', 'aceitou'));
    perform private.f1_fechar_tarefas(v.id, array['aceite_corretor'], 'concluida', ator, 'Corretor aceitou');
    perform private.f1_tarefas_confirmacao(v.id);
    update public.leads set status = 'visita_agendada'::public.lead_status
    where id = v.lead_id and status::text in ('novo','buscando_corretor','corretor_designado','follow_up','cancelado');
    return jsonb_build_object('visita_id', v.id, 'status', 'agendada');
  end if;

  update public.visita_convites set resposta = 'recusou', respondido_em = now() where id = pend.id;
  update public.visitas set corretor_id = null where id = v.id;
  perform private.f1_evento(v.id, 'f1_resposta_corretor', jsonb_build_object('corretor_id', pend.corretor_id,
    'corretor', private.f1_nome_corretor(pend.corretor_id), 'resposta', 'recusou', 'observacao', p_observacao), ator);
  perform private.f1_fechar_tarefas(v.id, array['aceite_corretor'], 'concluida', ator, 'Corretor recusou');
  return jsonb_build_object('visita_id', v.id, 'status', 'aguardando_corretor', 'recusou', pend.corretor_id);
end $$;

-- ===== Confirmações D-2 / D-1 / D0 =====
create or replace function public.visita_confirmar(p_visita_id uuid, p_etapa text, p_confirmou boolean default true, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ator uuid := private.f1_exigir_comercial();
  v public.visitas;
begin
  perform set_config('memude.fase1', '1', true);
  if p_etapa not in ('d2','d1','d0') then raise exception 'Etapa de confirmação inválida' using errcode = '22023'; end if;
  v := private.f1_visita(p_visita_id);
  if v.status not in ('agendada','confirmada') then
    raise exception 'Só é possível confirmar visitas agendadas' using errcode = '22023';
  end if;
  if p_confirmou then
    update public.visit_cycles set client_confirmed = true, broker_confirmed = true, confirmation_overdue = false, updated_at = now()
    where visita_id = v.id;
    if v.status = 'agendada' then
      perform private.f1_status(v.id, 'confirmada', ator, p_observacao, jsonb_build_object('etapa', upper(p_etapa)));
    end if;
  end if;
  perform private.f1_evento(v.id, 'f1_confirmacao', jsonb_build_object('etapa', upper(p_etapa),
    'confirmou', p_confirmou, 'observacao', p_observacao), ator);
  perform private.f1_fechar_tarefas(v.id, array['confirmacao_' || p_etapa], 'concluida', ator,
    case when p_confirmou then 'Cliente confirmou' else coalesce('Sem confirmação: ' || p_observacao, 'Cliente não confirmou') end);
  return jsonb_build_object('visita_id', v.id, 'status', case when p_confirmou then 'confirmada' else v.status end);
end $$;

-- ===== Resultado: realizada ou no-show =====
create or replace function public.visita_registrar_resultado(p_visita_id uuid, p_resultado text, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ator uuid := private.f1_exigir_comercial();
  cfg public.fase1_config;
  v public.visitas;
  inicio timestamptz;
  closer uuid;
  lead_nome text;
begin
  perform set_config('memude.fase1', '1', true);
  if p_resultado not in ('realizada','no_show') then raise exception 'Resultado inválido' using errcode = '22023'; end if;
  select * into cfg from public.fase1_config where id;
  v := private.f1_visita(p_visita_id);
  if v.status not in ('agendada','confirmada') then
    raise exception 'Registre o resultado de uma visita agendada ou confirmada' using errcode = '22023';
  end if;
  inicio := private.f1_inicio(v.data_visita, v.horario_visita);
  if now() < inicio - interval '30 minutes' then
    raise exception 'A visita ainda não aconteceu (início em %)',
      to_char(inicio at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI') using errcode = '22023';
  end if;
  closer := coalesce(cfg.closer_user_id, ator);
  select nome into lead_nome from public.leads where id = v.lead_id;

  if p_resultado = 'realizada' then
    update public.visit_cycles set outcome = 'held', match_status = 'closed', attendance_overdue = false,
      confirmation_overdue = false, recovery_open = false, updated_at = now() where visita_id = v.id;
    perform private.f1_status(v.id, 'realizada', ator, p_observacao);
    perform private.f1_fechar_tarefas(v.id, array['registrar_resultado','confirmacao_d0'], 'concluida', ator, 'Visita realizada');
    perform private.f1_fechar_tarefas(v.id, null, 'cancelada', ator, 'Visita realizada');
    perform private.f1_tarefa('retorno', 'Registrar retorno do corretor e do cliente — ' || lead_nome, v.id, v.lead_id, closer,
      now(), greatest(inicio + make_interval(hours => cfg.prazo_retorno_horas), now() + interval '1 hour'));
    perform private.f1_tarefa('proximo_passo', 'Definir próximo passo — ' || lead_nome, v.id, v.lead_id, closer,
      now(), greatest(inicio + make_interval(hours => cfg.prazo_proximo_passo_horas), now() + interval '1 hour'));
    update public.leads set status = 'visita_realizada'::public.lead_status where id = v.lead_id;
  else
    update public.visit_cycles set outcome = 'not_held', match_status = 'closed', attendance_overdue = false,
      confirmation_overdue = false, recovery_open = false, updated_at = now() where visita_id = v.id;
    update public.visitas set no_show_em = now() where id = v.id;
    perform private.f1_status(v.id, 'no_show', ator, p_observacao);
    perform private.f1_fechar_tarefas(v.id, array['registrar_resultado','confirmacao_d0'], 'concluida', ator, 'No-show');
    perform private.f1_fechar_tarefas(v.id, null, 'cancelada', ator, 'No-show');
    perform private.f1_tarefa('remarcar_no_show', 'Remarcar no-show com o corretor — ' || lead_nome, v.id, v.lead_id, closer,
      now(), now() + make_interval(hours => cfg.prazo_remarcar_horas));
  end if;
  return jsonb_build_object('visita_id', v.id, 'status', p_resultado);
end $$;

-- ===== Retorno pós-visita =====
create or replace function public.visita_registrar_retorno(p_visita_id uuid, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ator uuid := private.f1_exigir_comercial();
  v public.visitas;
  v_nota int := nullif(p_dados->>'nota', '')::int;
  v_impressao text := nullif(btrim(coalesce(p_dados->>'impressao', '')), '');
  v_feedback text := nullif(btrim(coalesce(p_dados->>'feedback_corretor', '')), '');
  v_proximo text := nullif(btrim(coalesce(p_dados->>'proximo_passo', '')), '');
  v_venda date := nullif(p_dados->>'data_venda', '')::date;
begin
  perform set_config('memude.fase1', '1', true);
  v := private.f1_visita(p_visita_id);
  if v.status <> 'realizada' then
    raise exception 'O retorno só pode ser registrado em visita realizada' using errcode = '22023';
  end if;
  if v_nota is not null and v_nota not between 1 and 5 then
    raise exception 'A nota do cliente vai de 1 a 5' using errcode = '22023';
  end if;
  if length(coalesce(v_impressao,'')) > 4000 or length(coalesce(v_feedback,'')) > 4000 or length(coalesce(v_proximo,'')) > 2000 then
    raise exception 'Texto muito longo' using errcode = '22023';
  end if;

  update public.visitas set
    avaliacao_lead = coalesce(v_nota, avaliacao_lead),
    comentarios_lead = coalesce(v_impressao, comentarios_lead),
    feedback_corretor = coalesce(v_feedback, feedback_corretor),
    proximo_passo = coalesce(v_proximo, proximo_passo),
    data_venda = coalesce(v_venda, data_venda)
  where id = v.id
  returning * into v;

  update public.visit_cycles set
    feedback = coalesce(feedback, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'nota_cliente_1a5', v.avaliacao_lead, 'impressao', v.comentarios_lead, 'next_step', v.proximo_passo)),
    feedback_at = now(),
    broker_feedback_at = case when v.feedback_corretor is not null then coalesce(broker_feedback_at, now()) else broker_feedback_at end,
    updated_at = now()
  where visita_id = v.id;

  perform private.f1_evento(v.id, 'f1_retorno', jsonb_strip_nulls(jsonb_build_object('nota', v_nota,
    'impressao', v_impressao, 'feedback_corretor', v_feedback, 'proximo_passo', v_proximo, 'data_venda', v_venda)), ator);

  if (v.avaliacao_lead is not null or v.comentarios_lead is not null) and v.feedback_corretor is not null then
    perform private.f1_fechar_tarefas(v.id, array['retorno'], 'concluida', ator, 'Retorno registrado');
  end if;
  if v.proximo_passo is not null then
    perform private.f1_fechar_tarefas(v.id, array['proximo_passo'], 'concluida', ator, 'Próximo passo definido');
  end if;
  return jsonb_build_object('visita_id', v.id, 'status', v.status,
    'retorno_completo', (v.avaliacao_lead is not null or v.comentarios_lead is not null) and v.feedback_corretor is not null,
    'proximo_passo_definido', v.proximo_passo is not null);
end $$;

-- ===== No-show: tentativas e escalada =====
create or replace function private.f1_pode_escalar(v public.visitas)
returns boolean language sql stable security definer set search_path = '' as $$
  select v.status = 'no_show' and v.escalada_em is null and (
    v.tentativas_remarcar >= (select escalar_tentativas from public.fase1_config where id)
    or now() >= coalesce(v.no_show_em, v.updated_at) + make_interval(hours => (select escalar_horas from public.fase1_config where id)));
$$;

create or replace function public.visita_tentativa_remarcar(p_visita_id uuid, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ator uuid := private.f1_exigir_comercial();
  v public.visitas;
begin
  perform set_config('memude.fase1', '1', true);
  v := private.f1_visita(p_visita_id);
  if v.status <> 'no_show' then raise exception 'Tentativas de remarcar valem só para no-show' using errcode = '22023'; end if;
  update public.visitas set tentativas_remarcar = tentativas_remarcar + 1, ultima_tentativa_remarcar = now()
  where id = v.id returning * into v;
  perform private.f1_evento(v.id, 'f1_tentativa_remarcar', jsonb_build_object('tentativa', v.tentativas_remarcar,
    'observacao', left(p_observacao, 1000)), ator);
  return jsonb_build_object('visita_id', v.id, 'tentativas', v.tentativas_remarcar, 'pode_escalar', private.f1_pode_escalar(v));
end $$;

create or replace function public.visita_escalar(p_visita_id uuid, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ator uuid := private.f1_exigir_comercial();
  cfg public.fase1_config;
  v public.visitas;
  dono uuid;
  lead_nome text;
begin
  perform set_config('memude.fase1', '1', true);
  select * into cfg from public.fase1_config where id;
  v := private.f1_visita(p_visita_id);
  if v.status <> 'no_show' then raise exception 'Só é possível escalar no-show' using errcode = '22023'; end if;
  if v.escalada_em is not null then raise exception 'Esta visita já foi escalada' using errcode = '22023'; end if;
  if not private.f1_pode_escalar(v) then
    raise exception 'Faça % tentativas de remarcar ou aguarde % horas do no-show antes de escalar',
      cfg.escalar_tentativas, cfg.escalar_horas using errcode = '22023';
  end if;
  dono := coalesce(v.criado_por, cfg.responsaveis[1], ator);
  select nome into lead_nome from public.leads where id = v.lead_id;
  update public.visitas set escalada_em = now() where id = v.id;
  perform private.f1_tarefa('escalada', 'No-show escalado pelo closer — ' || lead_nome, v.id, v.lead_id, dono,
    now(), now() + interval '4 hours');
  perform private.f1_fechar_tarefas(v.id, array['remarcar_no_show'], 'concluida', ator,
    'Escalada para ' || coalesce(private.f1_nome_usuario(dono), 'o agendador'));
  perform private.f1_evento(v.id, 'f1_escalada', jsonb_build_object('para', dono, 'para_nome', private.f1_nome_usuario(dono),
    'observacao', left(p_observacao, 1000)), ator);
  return jsonb_build_object('visita_id', v.id, 'escalada_para', dono);
end $$;

-- ===== Reagendar (nova visita ligada à original) =====
create or replace function public.visita_reagendar(p_visita_id uuid, p_data date, p_hora time,
  p_corretor_id uuid default null, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ator uuid := private.f1_exigir_comercial();
  cfg public.fase1_config;
  o public.visitas;
  pend public.visita_convites;
  v_corretor uuid;
  v_novo uuid;
  v_codigo text;
begin
  perform set_config('memude.fase1', '1', true);
  select * into cfg from public.fase1_config where id;
  o := private.f1_visita(p_visita_id);
  if o.status not in ('aguardando_corretor','agendada','confirmada','no_show') then
    raise exception 'Esta visita não pode ser reagendada (status atual: %)', o.status using errcode = '22023';
  end if;
  if p_data is null or p_hora is null then raise exception 'Informe a nova data e horário' using errcode = '22023'; end if;
  if private.f1_inicio(p_data, p_hora) < now() - interval '5 minutes' then
    raise exception 'A nova data e horário precisam estar no futuro' using errcode = '22023';
  end if;
  if p_data = o.data_visita and p_hora = o.horario_visita and p_corretor_id is not distinct from o.corretor_id then
    raise exception 'Escolha uma data, horário ou corretor diferente' using errcode = '22023';
  end if;
  v_corretor := coalesce(p_corretor_id, o.corretor_id);
  if v_corretor is not null then
    perform private.f1_validar_corretor(v_corretor, p_data, p_hora, o.id);
  end if;

  select * into pend from public.visita_convites where visita_id = o.id and resposta is null for update;
  if found then
    update public.visita_convites set resposta = 'sem_resposta', respondido_em = now() where id = pend.id;
  end if;
  update public.visit_cycles set outcome = 'rescheduled', match_status = 'closed', recovery_open = false, updated_at = now()
  where visita_id = o.id;
  perform private.f1_fechar_tarefas(o.id, array['remarcar_no_show','escalada'], 'concluida', ator, 'Reagendada');
  perform private.f1_fechar_tarefas(o.id, null, 'cancelada', ator, 'Reagendada');

  perform set_config('memude.reagendamento', '1', true);
  insert into public.visitas (lead_id, corretor_id, empreendimento_id, data_visita, horario_visita, status,
    local_nome, meeting_address, meeting_neighborhood, customer_profile, criado_por, fase1, intake_source,
    duration_minutes, buffer_minutes)
  values (o.lead_id, v_corretor, o.empreendimento_id, p_data, p_hora, 'aguardando_corretor',
    o.local_nome, o.meeting_address, o.meeting_neighborhood, o.customer_profile, ator, true, 'fase1_reagendamento',
    o.duration_minutes, o.buffer_minutes)
  returning id, visit_code into v_novo, v_codigo;
  perform set_config('memude.reagendamento', '', true);

  insert into public.visit_cycles (visita_id, scheduled_at, match_status, previous_visita_id)
  values (v_novo, private.f1_inicio(p_data, p_hora), 'searching', o.id);

  -- O card do funil acompanha a visita mais recente, na mesma etapa
  update public.crm_leads set visita_id = v_novo, updated_at = now() where visita_id = o.id;

  perform private.f1_status(o.id, 'reagendada', ator, p_observacao,
    jsonb_build_object('nova_visita_id', v_novo, 'nova_data', p_data, 'novo_horario', p_hora));
  perform private.f1_evento(v_novo, 'f1_criada', jsonb_build_object('para', 'aguardando_corretor',
    'data', p_data, 'hora', p_hora, 'reagendamento_de', o.id, 'observacao', p_observacao), ator);

  if v_corretor is not null then
    insert into public.visita_convites (visita_id, corretor_id, criado_por, motivo_sugestao)
    values (v_novo, v_corretor, ator, 'Reagendamento');
    perform private.f1_evento(v_novo, 'f1_convite', jsonb_build_object('corretor_id', v_corretor,
      'corretor', private.f1_nome_corretor(v_corretor)), ator);
    perform private.f1_tarefa('aceite_corretor', 'Aguardando aceite do corretor (reagendamento) — ' ||
      (select nome from public.leads where id = o.lead_id), v_novo, o.lead_id, ator,
      now(), now() + make_interval(mins => cfg.prazo_aceite_min));
  end if;
  return jsonb_build_object('visita_id', v_novo, 'visit_code', v_codigo, 'visita_original_id', o.id, 'status', 'aguardando_corretor');
end $$;

-- ===== Cancelar (motivo obrigatório) =====
create or replace function public.visita_cancelar(p_visita_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ator uuid := private.f1_exigir_comercial();
  v public.visitas;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  perform set_config('memude.fase1', '1', true);
  if length(v_motivo) < 3 then raise exception 'Informe o motivo do cancelamento' using errcode = '22023'; end if;
  v := private.f1_visita(p_visita_id);
  if v.status not in ('aguardando_corretor','agendada','confirmada','no_show') then
    raise exception 'Esta visita não pode ser cancelada (status atual: %)', v.status using errcode = '22023';
  end if;
  update public.visita_convites set resposta = 'sem_resposta', respondido_em = now() where visita_id = v.id and resposta is null;
  update public.visit_cycles set outcome = 'cancelled', match_status = 'closed', recovery_open = false,
    reason = left(v_motivo, 1000), updated_at = now() where visita_id = v.id;
  update public.visitas set motivo_cancelamento = left(v_motivo, 1000) where id = v.id;
  perform private.f1_status(v.id, 'cancelada', ator, left(v_motivo, 1000));
  perform private.f1_fechar_tarefas(v.id, null, 'cancelada', ator, 'Visita cancelada');
  return jsonb_build_object('visita_id', v.id, 'status', 'cancelada');
end $$;

-- ===== Corrigir local/endereço/bairro/perfil =====
create or replace function public.visita_atualizar_local(p_visita_id uuid, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ator uuid := private.f1_exigir_comercial();
  v public.visitas;
  n public.visitas;
begin
  perform set_config('memude.fase1', '1', true);
  v := private.f1_visita(p_visita_id);
  if v.status not in ('aguardando_corretor','agendada','confirmada') then
    raise exception 'Só é possível alterar o local antes da visita acontecer' using errcode = '22023';
  end if;
  if (p_dados ? 'local_nome' and length(btrim(coalesce(p_dados->>'local_nome',''))) < 2)
    or (p_dados ? 'endereco' and length(btrim(coalesce(p_dados->>'endereco',''))) < 5)
    or (p_dados ? 'bairro' and length(btrim(coalesce(p_dados->>'bairro',''))) < 2) then
    raise exception 'Local, endereço e bairro são obrigatórios' using errcode = '22023';
  end if;
  update public.visitas set
    local_nome = case when p_dados ? 'local_nome' then left(btrim(p_dados->>'local_nome'), 120) else local_nome end,
    meeting_address = case when p_dados ? 'endereco' then left(btrim(p_dados->>'endereco'), 300) else meeting_address end,
    meeting_neighborhood = case when p_dados ? 'bairro' then left(btrim(p_dados->>'bairro'), 120) else meeting_neighborhood end,
    customer_profile = case when p_dados ? 'perfil' then nullif(left(btrim(p_dados->>'perfil'), 2000), '') else customer_profile end
  where id = v.id returning * into n;
  if v.status = 'confirmada' and n.status = 'agendada' then
    update public.visit_cycles set client_confirmed = null, updated_at = now() where visita_id = v.id;
  end if;
  perform private.f1_evento(v.id, 'f1_local_alterado', jsonb_strip_nulls(jsonb_build_object(
    'local', n.local_nome, 'endereco', n.meeting_address, 'bairro', n.meeting_neighborhood,
    'confirmacao_desfeita', case when v.status = 'confirmada' and n.status = 'agendada' then true end)), ator);
  return jsonb_build_object('visita_id', v.id, 'status', n.status);
end $$;

-- ===== Tarefas e registro de mensagens =====
create or replace function public.tarefa_concluir(p_tarefa_id uuid, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ator uuid := private.f1_exigir_comercial();
  t public.tarefas;
begin
  select * into t from public.tarefas where id = p_tarefa_id for update;
  if not found then raise exception 'Tarefa não encontrada' using errcode = 'P0002'; end if;
  if t.status <> 'pendente' then raise exception 'Esta tarefa já foi encerrada' using errcode = '22023'; end if;
  if t.dono_id is distinct from ator and not private.has_role(ator, 'admin'::public.app_role) then
    raise exception 'Só o dono da tarefa ou um administrador pode concluí-la' using errcode = '42501';
  end if;
  update public.tarefas set status = 'concluida', concluida_em = now(), concluida_por = ator,
    observacao = coalesce(nullif(btrim(p_observacao), ''), observacao) where id = t.id;
  if t.visita_id is not null then
    perform set_config('memude.fase1', '1', true);
    perform private.f1_evento(t.visita_id, 'f1_tarefa_concluida', jsonb_build_object('tipo', t.tipo, 'observacao', p_observacao), ator);
  end if;
  return jsonb_build_object('tarefa_id', t.id, 'status', 'concluida');
end $$;

create or replace function public.mensagem_registrar_uso(p_visita_id uuid, p_template text, p_destino text, p_acao text)
returns void language plpgsql security definer set search_path = '' as $$
declare ator uuid := private.f1_exigir_comercial();
begin
  if p_acao not in ('copiar','whatsapp') or p_destino not in ('cliente','corretor','grupo') then
    raise exception 'Ação inválida' using errcode = '22023';
  end if;
  perform set_config('memude.fase1', '1', true);
  perform private.f1_evento(p_visita_id, 'f1_mensagem', jsonb_build_object('template', left(p_template, 60),
    'destino', p_destino, 'acao', p_acao), ator);
end $$;

-- ===== Rotina de prazos: espelha atrasos nos sinalizadores de visit_cycles =====
create or replace function private.fase1_tick()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with x as (
    select v.id,
      exists (select 1 from public.tarefas t where t.visita_id = v.id and t.status = 'pendente'
              and t.tipo in ('confirmacao_d2','confirmacao_d1','confirmacao_d0') and t.vence_em < now()) as conf,
      exists (select 1 from public.tarefas t where t.visita_id = v.id and t.status = 'pendente'
              and t.tipo = 'registrar_resultado' and t.vence_em < now()) as att
    from public.visitas v
    where v.fase1 and v.deleted_at is null
      and v.status in ('aguardando_corretor','agendada','confirmada','realizada','no_show')
  )
  update public.visit_cycles cy set confirmation_overdue = x.conf, attendance_overdue = x.att, updated_at = now()
  from x
  where cy.visita_id = x.id and (cy.confirmation_overdue, cy.attendance_overdue) is distinct from (x.conf, x.att);
  get diagnostics n = row_count;
  return n;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.visita_agendar(jsonb)', 'public.visita_convidar_corretor(uuid,uuid,numeric,text)',
    'public.visita_resposta_corretor(uuid,boolean,text)', 'public.visita_confirmar(uuid,text,boolean,text)',
    'public.visita_registrar_resultado(uuid,text,text)', 'public.visita_registrar_retorno(uuid,jsonb)',
    'public.visita_tentativa_remarcar(uuid,text)', 'public.visita_escalar(uuid,text)',
    'public.visita_reagendar(uuid,date,time,uuid,text)', 'public.visita_cancelar(uuid,text)',
    'public.visita_atualizar_local(uuid,jsonb)', 'public.tarefa_concluir(uuid,text)',
    'public.mensagem_registrar_uso(uuid,text,text,text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

revoke all on function private.fase1_tick() from public, anon, authenticated;

select cron.schedule('fase1-prazos', '* * * * *', 'select private.fase1_tick();');
select cron.schedule('fase1-corretor-metricas', '*/10 * * * *', 'select private.corretor_metricas_recalcular();');
;
