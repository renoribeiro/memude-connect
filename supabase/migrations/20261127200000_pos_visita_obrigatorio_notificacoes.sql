-- Pós-visita:
--  1) O corretor conta no app como foi E escreve o retorno (obrigatório em todos os casos).
--  2) O que o corretor contou é a verdade: acaba a tarefa "retorno do corretor e do cliente" (sem nota nem impressão do cliente).
--  3) Notificações (tela Hoje e sininho do Connect): visita realizada/no-show (com pop-up para o closer), corretor aceitou,
--     pedido de ajuda e corretor que ainda não contou como foi.

-- Controle das cobranças de retorno fica fora da tabela de visitas (mexer em visitas dispara a sincronização da planilha)
create table if not exists public.visita_retorno_cobranca (
  visita_id uuid primary key references public.visitas(id) on delete cascade,
  corretor_em timestamptz,
  closer_em timestamptz
);
alter table public.visita_retorno_cobranca enable row level security;
revoke all on public.visita_retorno_cobranca from anon, authenticated;

-- Notifica pessoas (uma linha por pessoa) e, se pedido, manda aviso no celular
create or replace function private.notificar(p_users uuid[], p_tipo text, p_titulo text, p_msg text, p_lead uuid, p_visita uuid,
  p_meta jsonb default '{}'::jsonb, p_url text default '/hoje', p_push boolean default true)
returns void language plpgsql security definer set search_path to '' as $$
declare alvos uuid[];
begin
  select array_agg(distinct u) into alvos from unnest(p_users) u where u is not null;
  if alvos is null then return; end if;
  insert into public.notifications (user_id, type, title, message, read, metadata, related_lead_id, related_visit_id)
  select u, p_tipo::public.notification_type, left(p_titulo, 200), left(coalesce(p_msg, ''), 1000), false,
    coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('url', p_url), p_lead, p_visita
  from unnest(alvos) u;
  if p_push then
    perform private.conv_push(alvos, left(p_titulo, 80), left(coalesce(p_msg, ''), 200), p_url, 'notif-' || coalesce(p_visita::text, gen_random_uuid()::text), null);
  end if;
exception when others then
  raise warning 'notificação não registrada: %', sqlerrm;
end $$;
revoke all on function private.notificar(uuid[], text, text, text, uuid, uuid, jsonb, text, boolean) from public, anon, authenticated;

do $do$
declare src text; antes text;
begin
  -- ===== Corretor no app: retorno obrigatório, sem tarefa de "retorno do cliente", notifica o closer =====
  src := pg_get_functiondef('public.corretor_registrar_visita(uuid,text,text)'::regprocedure);
  if position('private.notificar' in src) = 0 then
    antes := src;
    src := replace(src,
      E'  if p_resultado in (''nao_gostou'', ''quer_outros'') and obs is null then\n    raise exception ''Conte em poucas palavras o motivo: ajuda a SDR a oferecer o imóvel certo'' using errcode = ''22023'';\n  end if;\n',
      E'  if obs is null or length(obs) < 10 then\n    raise exception ''Conte para o closer como foi a visita (pelo menos uma frase)'' using errcode = ''22023'';\n  end if;\n');
    src := replace(src,
      E'      perform private.f1_tarefa(''retorno'', ''Registrar retorno do corretor e do cliente — '' || lead_nome, v.id, v.lead_id, closer,\n        now(), greatest(inicio + make_interval(hours => cfg.prazo_retorno_horas), now() + interval ''1 hour''));\n',
      '');
    src := replace(src,
      E'  return jsonb_build_object(''visita_id'', v.id, ''resultado'', p_resultado,',
      E'  -- O que o corretor contou é a verdade: não há retorno do cliente a registrar\n'
      || E'  perform private.f1_fechar_tarefas(v.id, array[''retorno''], ''concluida'', u, ''Retorno do corretor no app'');\n'
      || E'  perform private.notificar(array[closer, v.criado_por],\n'
      || E'    case when p_resultado = ''no_show'' then ''visit_cancelled'' else ''visit_completed'' end,\n'
      || E'    case when p_resultado = ''no_show'' then ''Cliente não compareceu · '' || coalesce(lead_nome, ''Cliente'') else ''Visita realizada · '' || coalesce(lead_nome, ''Cliente'') end,\n'
      || E'    rotulo || '' · '' || coalesce(nome_corretor, ''Corretor'') || '': '' || obs,\n'
      || E'    v.lead_id, v.id,\n'
      || E'    jsonb_build_object(''popup'', true, ''resultado'', p_resultado, ''rotulo'', rotulo, ''feedback'', obs, ''corretor'', nome_corretor,\n'
      || E'      ''cliente'', lead_nome, ''empreendimento'', (select e.nome from public.empreendimentos e where e.id = v.empreendimento_id),\n'
      || E'      ''data'', to_char(v.data_visita, ''DD/MM'') || '' '' || to_char(v.horario_visita, ''HH24:MI'')),\n'
      || E'    ''/hoje?visita='' || v.id);\n'
      || E'  return jsonb_build_object(''visita_id'', v.id, ''resultado'', p_resultado,');
    if src = antes or position('length(obs) < 10' in src) = 0 or position('Registrar retorno do corretor e do cliente' in src) > 0
       or position('private.notificar' in src) = 0 then
      raise exception 'corretor_registrar_visita não ajustada';
    end if;
    execute src;
  end if;

  -- ===== Retorno no Connect: completo com o retorno do corretor (sem nota/impressão do cliente) =====
  src := pg_get_functiondef('public.visita_registrar_retorno(uuid,jsonb)'::regprocedure);
  if position('if v.feedback_corretor is not null then' in src) = 0 then
    antes := src;
    src := replace(src, E'  if (v.avaliacao_lead is not null or v.comentarios_lead is not null) and v.feedback_corretor is not null then',
      E'  if v.feedback_corretor is not null then');
    src := replace(src, E'''retorno_completo'', (v.avaliacao_lead is not null or v.comentarios_lead is not null) and v.feedback_corretor is not null,',
      E'''retorno_completo'', v.feedback_corretor is not null,');
    if src = antes then raise exception 'visita_registrar_retorno não ajustada'; end if;
    execute src;
  end if;

  -- Visita marcada como realizada pela equipe: a tarefa passa a ser só o retorno do corretor
  src := pg_get_functiondef('public.visita_registrar_resultado(uuid,text,text)'::regprocedure);
  if position('Registrar retorno do corretor e do cliente' in src) > 0 then
    execute replace(src, 'Registrar retorno do corretor e do cliente', 'Registrar o retorno do corretor');
  end if;

  -- ===== Pedido de ajuda também entra nas notificações do closer =====
  src := pg_get_functiondef('public.corretor_pedir_ajuda(text,text,uuid,boolean)'::regprocedure);
  if position('private.notificar' in src) = 0 then
    antes := src;
    src := replace(src, E'  return novo;\nend',
      E'  perform private.notificar(array[cfg.closer_user_id], ''system_alert'',\n'
      || E'    case when p_urgente then ''Ajuda AGORA · '' else ''Pedido de ajuda · '' end || coalesce(nome, ''Corretor''),\n'
      || E'    initcap(assunto) || coalesce('' · Cliente: '' || cliente, '''') || coalesce('' · '' || nullif(t, ''''), ''''),\n'
      || E'    v_lead, null, jsonb_build_object(''popup'', true, ''tipo'', ''pedido_ajuda'', ''conversa_id'', p_conversa, ''contato'', fone),\n'
      || E'    ''/hoje'', false);\n'
      || E'  return novo;\nend');
    if src = antes then raise exception 'corretor_pedir_ajuda não ajustada'; end if;
    execute src;
  end if;
end $do$;

-- Tarefas de retorno que já têm o relato do corretor: concluídas (o relato dele basta)
update public.tarefas t set status = 'concluida', concluida_em = now(), observacao = coalesce(t.observacao, 'Retorno do corretor já registrado')
where t.tipo = 'retorno' and t.status = 'pendente'
  and exists (select 1 from public.visitas v where v.id = t.visita_id and v.feedback_corretor is not null);
update public.tarefas set titulo = replace(titulo, 'Registrar retorno do corretor e do cliente', 'Registrar o retorno do corretor')
where tipo = 'retorno' and status = 'pendente' and titulo like 'Registrar retorno do corretor e do cliente%';

-- ===== Corretor aceitou a visita: avisa quem agendou =====
create or replace function private.visita_aceita_notificar()
returns trigger language plpgsql security definer set search_path to '' as $$
declare cliente text; corretor text; cfg public.fase1_config;
begin
  if OLD.status = 'aguardando_corretor' and NEW.status = 'agendada' and NEW.corretor_id is not null then
    select * into cfg from public.fase1_config where id;
    select nome into cliente from public.leads where id = NEW.lead_id;
    corretor := private.f1_nome_corretor(NEW.corretor_id);
    perform private.notificar(array[NEW.criado_por, cfg.closer_user_id], 'visit_confirmed',
      coalesce(corretor, 'Corretor') || ' aceitou a visita',
      coalesce(cliente, 'Cliente') || ' · ' || to_char(NEW.data_visita, 'DD/MM') || ' às ' || to_char(NEW.horario_visita, 'HH24:MI'),
      NEW.lead_id, NEW.id, jsonb_build_object('corretor', corretor, 'cliente', cliente), '/hoje?visita=' || NEW.id, false);
  end if;
  return NEW;
exception when others then
  raise warning 'aviso de aceite não registrado: %', sqlerrm;
  return NEW;
end $$;
drop trigger if exists visita_aceita_notificar on public.visitas;
create trigger visita_aceita_notificar after update of status on public.visitas
  for each row when (OLD.status is distinct from NEW.status) execute function private.visita_aceita_notificar();

-- ===== Corretor que ainda não contou como foi: lembra ele (1h depois) e avisa o closer (3h depois) =====
create or replace function private.visitas_retorno_tick()
returns integer language plpgsql security definer set search_path to '' as $$
declare r record; n int := 0; cfg public.fase1_config;
begin
  select * into cfg from public.fase1_config where id;
  for r in
    select v.id, v.lead_id, v.corretor_id, l.nome cliente, p.user_id uid_corretor, private.f1_inicio(v.data_visita, v.horario_visita) inicio,
      c.corretor_em retorno_cobrado_em, c.closer_em retorno_cobrado_closer_em
    from public.visitas v
    join public.leads l on l.id = v.lead_id
    left join public.corretores co on co.id = v.corretor_id
    left join public.profiles p on p.id = co.profile_id
    left join public.visita_retorno_cobranca c on c.visita_id = v.id
    where v.deleted_at is null and v.corretor_id is not null and v.resultado_cliente is null
      and v.status in ('agendada', 'confirmada', 'realizada')
      and v.data_visita between current_date - 3 and current_date
      -- Só visitas a partir de hoje (as antigas sem retorno não disparam cobrança agora)
      and v.data_visita >= date '2026-11-27'
      and (c.corretor_em is null or c.closer_em is null)
  loop
    if r.inicio + interval '1 hour' <= now() and r.retorno_cobrado_em is null then
      perform private.conv_push(array_remove(array[r.uid_corretor], null), 'Como foi a visita?',
        'Conte para o closer como foi a visita com ' || coalesce(split_part(r.cliente, ' ', 1), 'o cliente') || '.', '/app', 'retorno-' || r.id, null);
      insert into public.visita_retorno_cobranca (visita_id, corretor_em) values (r.id, now())
        on conflict (visita_id) do update set corretor_em = now();
      n := n + 1;
    end if;
    if r.inicio + interval '3 hours' <= now() and r.retorno_cobrado_closer_em is null then
      perform private.notificar(array[cfg.closer_user_id], 'system_alert',
        'Corretor ainda não contou como foi',
        coalesce(private.f1_nome_corretor(r.corretor_id), 'O corretor') || ' · visita com ' || coalesce(r.cliente, 'cliente'),
        r.lead_id, r.id, jsonb_build_object('tipo', 'retorno_atrasado'), '/hoje?visita=' || r.id, true);
      insert into public.visita_retorno_cobranca (visita_id, closer_em) values (r.id, now())
        on conflict (visita_id) do update set closer_em = now();
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;


do $do$
begin
  perform cron.unschedule('visitas-retorno') where exists (select 1 from cron.job where jobname = 'visitas-retorno');
  perform cron.schedule('visitas-retorno', '*/15 * * * *', $cron$select private.visitas_retorno_tick()$cron$);
end $do$;
