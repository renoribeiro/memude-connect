-- Chamados do corretor: modo automático (estilo app de corrida) e reavisos.
-- • Automático: o sistema convida o corretor de maior rating que tem acesso ao app e está livre no horário.
--   Recusou ou passou o prazo → chama o próximo. Depois de N convites sem aceite, avisa quem agendou e os responsáveis.
-- • Reaviso (vale também no manual): nova notificação ao corretor a cada X minutos (até 2 vezes) enquanto não responder.

-- 1) Configuração (padrão global) e marcação por visita/convite
alter table public.fase1_config
  add column if not exists chamado_automatico boolean not null default false,
  add column if not exists chamado_tentativas smallint not null default 3,
  add column if not exists chamado_reaviso_min smallint not null default 5;
do $$ begin
  alter table public.fase1_config add constraint fase1_config_chamado_tentativas_chk check (chamado_tentativas between 1 and 10);
  alter table public.fase1_config add constraint fase1_config_chamado_reaviso_chk check (chamado_reaviso_min between 1 and 30);
exception when duplicate_object then null; end $$;

alter table public.visit_cycles add column if not exists chamado_automatico boolean not null default false;
alter table public.visita_convites
  add column if not exists automatico boolean not null default false,
  add column if not exists reavisos smallint not null default 0;

-- 2) Melhor corretor disponível (com app) para um empreendimento/horário, sem repetir quem já foi chamado
create or replace function private.chamado_escolher(p_emp uuid, p_data date, p_hora time, p_visita uuid)
returns table (corretor_id uuid, score numeric, motivo text)
language sql stable security definer set search_path to '' as $$
  select r.corretor_id, r.score, r.motivo
  from private.f1_rating(p_emp) r
  join public.corretores c on c.id = r.corretor_id and c.deleted_at is null and c.status = 'ativo'
  join public.profiles p on p.id = c.profile_id and p.user_id is not null
  where (p_visita is null or not exists (select 1 from public.visita_convites x where x.visita_id = p_visita and x.corretor_id = r.corretor_id))
    and private.f1_corretor_ocupado(r.corretor_id, p_data, p_hora, p_visita) is null
  order by r.score desc nulls last, r.nome
  limit 1;
$$;

-- 3) Chama o próximo corretor (ou desiste e avisa a equipe)
create or replace function private.chamado_proximo(p_visita uuid, p_ator uuid)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  cfg public.fase1_config; v public.visitas; n int; lead_nome text; avisar uuid[];
  esc_id uuid; esc_score numeric; esc_motivo text;
begin
  perform set_config('memude.fase1', '1', true);
  select * into cfg from public.fase1_config where id;
  select * into v from public.visitas where id = p_visita for update;
  if not found or v.deleted_at is not null or v.status <> 'aguardando_corretor' then return null; end if;
  if exists (select 1 from public.visita_convites where visita_id = v.id and resposta is null) then return null; end if;
  select count(*) into n from public.visita_convites where visita_id = v.id;
  select nome into lead_nome from public.leads where id = v.lead_id;

  if n < cfg.chamado_tentativas then
    select e.corretor_id, e.score, e.motivo into esc_id, esc_score, esc_motivo
      from private.chamado_escolher(v.empreendimento_id, v.data_visita, v.horario_visita, v.id) e;
  end if;

  if esc_id is null then
    update public.visit_cycles set chamado_automatico = false, updated_at = now() where visita_id = v.id;
    perform private.f1_evento(v.id, 'f1_chamado_esgotado', jsonb_build_object('convites', n), p_ator);
    perform private.f1_tarefa('aceite_corretor', 'Nenhum corretor aceitou — escolha manualmente: ' || coalesce(lead_nome, 'cliente'),
      v.id, v.lead_id, v.criado_por, now(), now());
    avisar := array(select distinct u from unnest(array[v.criado_por] || coalesce(cfg.responsaveis, '{}'::uuid[])) u where u is not null);
    perform private.conv_push(avisar, 'Visita sem corretor',
      coalesce(lead_nome, 'Cliente') || ': ' || case when n = 0 then 'nenhum corretor livre nesse horário' else n || ' convite' || case when n > 1 then 's' else '' end || ' sem aceite' end
      || '. Escolha manualmente.', '/visitas', 'chamado-' || v.id);
    return null;
  end if;

  insert into public.visita_convites (visita_id, corretor_id, score, motivo_sugestao, criado_por, automatico)
  values (v.id, esc_id, esc_score, left(esc_motivo, 500), p_ator, true);
  update public.visitas set corretor_id = esc_id where id = v.id;
  perform private.f1_evento(v.id, 'f1_convite', jsonb_build_object('corretor_id', esc_id,
    'corretor', private.f1_nome_corretor(esc_id), 'automatico', true), p_ator);
  perform private.f1_tarefa('aceite_corretor', 'Aguardando aceite do corretor — ' || coalesce(lead_nome, 'cliente'), v.id, v.lead_id,
    v.criado_por, now(), now() + make_interval(mins => cfg.prazo_aceite_min));
  return esc_id;
end $$;

-- 4) Agendar: "automatico" no p_dados liga o modo (e escolhe o corretor se a SDR não escolheu)
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.visita_agendar(jsonb)'::regprocedure);
  if position('chamado_auto_agendar' in src) = 0 then
    src := replace(src, E'  v_codigo text;\nbegin', E'  v_codigo text;\n  v_auto boolean := coalesce((p_dados->>''automatico'')::boolean, false); /* chamado_auto_agendar */\n  v_esc record;\nbegin');
    src := replace(src, 'if v_corretor is null then raise exception',
      E'if v_corretor is null and v_auto then\n    select * into v_esc from private.chamado_escolher(v_emp, v_data, v_hora, null);\n    if v_esc.corretor_id is null then\n      raise exception ''Nenhum corretor com o app está livre nesse horário. Escolha manualmente ou mude o horário.'' using errcode = ''22023'';\n    end if;\n    v_corretor := v_esc.corretor_id;\n    p_dados := p_dados || jsonb_build_object(''score'', v_esc.score, ''motivo_sugestao'', v_esc.motivo);\n  end if;\n  if v_corretor is null then raise exception');
    src := replace(src, E'insert into public.visit_cycles (visita_id, scheduled_at, match_status)\n  values (v_id, private.f1_inicio(v_data, v_hora), ''searching'');',
      E'insert into public.visit_cycles (visita_id, scheduled_at, match_status, chamado_automatico)\n  values (v_id, private.f1_inicio(v_data, v_hora), ''searching'', v_auto);');
    src := replace(src, 'insert into public.visita_convites (visita_id, corretor_id, score, motivo_sugestao, criado_por)
  values (v_id, v_corretor, nullif(p_dados->>''score'', '''')::numeric, left(nullif(p_dados->>''motivo_sugestao'', ''''), 500), ator);',
      'insert into public.visita_convites (visita_id, corretor_id, score, motivo_sugestao, criado_por, automatico)
  values (v_id, v_corretor, nullif(p_dados->>''score'', '''')::numeric, left(nullif(p_dados->>''motivo_sugestao'', ''''), 500), ator, v_auto);');
    if position('chamado_escolher(v_emp' in src) = 0 or position('''searching'', v_auto' in src) = 0 or position('ator, v_auto);' in src) = 0 then
      raise exception 'Ajuste de visita_agendar não aplicado';
    end if;
    execute src;
  end if;
end $do$;

-- 5) Recusa (no app ou registrada pela SDR) no modo automático chama o próximo
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.corretor_responder_convite(uuid,boolean,text)'::regprocedure);
  if position('chamado_auto_recusa' in src) = 0 then
    src := replace(src, E'  return jsonb_build_object(''visita_id'', v.id, ''status'', ''aguardando_corretor'', ''recusou'', true);',
      E'  if exists (select 1 from public.visit_cycles where visita_id = v.id and chamado_automatico) then /* chamado_auto_recusa */\n    perform private.chamado_proximo(v.id, v.criado_por);\n  end if;\n  return jsonb_build_object(''visita_id'', v.id, ''status'', ''aguardando_corretor'', ''recusou'', true);');
    if position('chamado_auto_recusa' in src) = 0 then raise exception 'Ajuste de corretor_responder_convite não aplicado'; end if;
    execute src;
  end if;

  src := pg_get_functiondef('public.visita_resposta_corretor(uuid,boolean,text)'::regprocedure);
  if position('chamado_auto_recusa' in src) = 0 then
    src := replace(src, E'  return jsonb_build_object(''visita_id'', v.id, ''status'', ''aguardando_corretor'', ''recusou'', pend.corretor_id);',
      E'  if exists (select 1 from public.visit_cycles where visita_id = v.id and chamado_automatico) then /* chamado_auto_recusa */\n    perform private.chamado_proximo(v.id, ator);\n  end if;\n  return jsonb_build_object(''visita_id'', v.id, ''status'', ''aguardando_corretor'', ''recusou'', pend.corretor_id);');
    if position('chamado_auto_recusa' in src) = 0 then raise exception 'Ajuste de visita_resposta_corretor não aplicado'; end if;
    execute src;
  end if;
end $do$;

-- 6) A cada minuto: reaviso ao corretor e, no automático, prazo esgotado passa para o próximo
create or replace function private.chamados_tick()
returns integer language plpgsql security definer set search_path to '' as $$
declare cfg public.fase1_config; r record; n int := 0; faltam int;
begin
  perform set_config('memude.fase1', '1', true);
  select * into cfg from public.fase1_config where id;
  for r in
    select vc.id, vc.visita_id, vc.corretor_id, vc.enviado_em, vc.reavisos, v.criado_por, cy.chamado_automatico auto,
           l.nome lead_nome, e.nome emp, p.user_id uid
    from public.visita_convites vc
    join public.visitas v on v.id = vc.visita_id and v.deleted_at is null and v.status = 'aguardando_corretor'
    join public.visit_cycles cy on cy.visita_id = v.id
    join public.leads l on l.id = v.lead_id
    left join public.empreendimentos e on e.id = v.empreendimento_id
    left join public.corretores c on c.id = vc.corretor_id
    left join public.profiles p on p.id = c.profile_id
    where vc.resposta is null and vc.enviado_em > now() - interval '3 days'
    order by vc.enviado_em
    for update of vc skip locked
  loop
    if now() >= r.enviado_em + make_interval(mins => cfg.prazo_aceite_min) then
      if r.auto then
        update public.visita_convites set resposta = 'sem_resposta', respondido_em = now() where id = r.id;
        update public.visitas set corretor_id = null where id = r.visita_id;
        perform private.f1_evento(r.visita_id, 'f1_resposta_corretor', jsonb_build_object('corretor_id', r.corretor_id,
          'corretor', private.f1_nome_corretor(r.corretor_id), 'resposta', 'sem_resposta', 'via', 'prazo'), null);
        perform private.f1_fechar_tarefas(r.visita_id, array['aceite_corretor'], 'concluida', null, 'Prazo de aceite esgotado');
        perform private.chamado_proximo(r.visita_id, r.criado_por);
        n := n + 1;
      end if;
    elsif r.reavisos < 2 and r.uid is not null
          and now() >= r.enviado_em + make_interval(mins => cfg.chamado_reaviso_min * (r.reavisos + 1)) then
      update public.visita_convites set reavisos = reavisos + 1 where id = r.id;
      faltam := greatest(1, ceil(extract(epoch from (r.enviado_em + make_interval(mins => cfg.prazo_aceite_min) - now())) / 60)::int);
      perform private.conv_push(array[r.uid], 'Cliente esperando você',
        coalesce(r.lead_nome, 'Cliente') || coalesce(' · ' || r.emp, '') || ' — ' || faltam || ' min para aceitar',
        '/app?convite=' || r.id, 'convite-' || r.id);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

revoke all on function private.chamado_escolher(uuid, date, time, uuid), private.chamado_proximo(uuid, uuid), private.chamados_tick() from public, anon, authenticated;

select cron.unschedule('chamados-corretor') where exists (select 1 from cron.job where jobname = 'chamados-corretor');
select cron.schedule('chamados-corretor', '* * * * *', $cron$select private.chamados_tick()$cron$);
