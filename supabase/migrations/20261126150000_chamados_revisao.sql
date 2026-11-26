-- Chamados do corretor — correções da revisão
-- 1) Excluir/restaurar visita: o corretor só pode mexer na visita que ELE aceitou (convidado ainda não);
--    excluir fecha convite pendente, tarefas e o modo automático.
-- 2) Convite manual da SDR assume a visita: o modo automático desliga.
-- 3) Reagendar mantém o modo automático; sem corretor, chama o próximo (automático) ou cria a tarefa para a SDR.
-- 4) chamado_proximo valida o horário do corretor (trava e confere conflito) e desiste perto do início da visita.
-- 5) chamados_tick trava a visita antes do convite (mesma ordem das outras funções) e isola erro por visita.

-- 1) Excluir e restaurar
create or replace function public.soft_delete_visita(visita_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  _actor uuid := auth.uid();
begin
  if _actor is null then
    raise exception using errcode = '42501', message = 'Autenticação obrigatória';
  end if;
  if not (private.is_comercial() or exists (
    select 1 from public.visitas v
      join public.corretores c on c.id = v.corretor_id
      join public.profiles p on p.id = c.profile_id
     where v.id = soft_delete_visita.visita_id and p.user_id = _actor
       and exists (select 1 from public.visita_convites x where x.visita_id = v.id and x.corretor_id = v.corretor_id and x.resposta = 'aceitou'))) then
    raise exception using errcode = '42501', message = 'Sem permissão para excluir esta visita';
  end if;

  update public.visitas v set deleted_at = now(), updated_at = now()
   where v.id = soft_delete_visita.visita_id and v.deleted_at is null;
  update public.visita_convites x set resposta = 'sem_resposta', respondido_em = now()
   where x.visita_id = soft_delete_visita.visita_id and x.resposta is null;
  update public.visit_cycles c set chamado_automatico = false, updated_at = now()
   where c.visita_id = soft_delete_visita.visita_id and c.chamado_automatico;
  perform private.f1_fechar_tarefas(soft_delete_visita.visita_id, null, 'cancelada', _actor, 'Visita excluída');

  update public.leads l set status = 'cancelado', updated_at = now()
   where l.id = (select v.lead_id from public.visitas v where v.id = soft_delete_visita.visita_id)
     and l.status = 'visita_agendada';
end $$;

create or replace function public.restore_visita(visita_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  _actor uuid := auth.uid();
begin
  if _actor is null then
    raise exception using errcode = '42501', message = 'Autenticação obrigatória';
  end if;
  if not (private.is_comercial() or exists (
    select 1 from public.visitas v
      join public.corretores c on c.id = v.corretor_id
      join public.profiles p on p.id = c.profile_id
     where v.id = restore_visita.visita_id and p.user_id = _actor
       and exists (select 1 from public.visita_convites x where x.visita_id = v.id and x.corretor_id = v.corretor_id and x.resposta = 'aceitou'))) then
    raise exception using errcode = '42501', message = 'Sem permissão para restaurar esta visita';
  end if;

  update public.visitas v set deleted_at = null, updated_at = now()
   where v.id = restore_visita.visita_id and v.deleted_at is not null;

  update public.leads l set status = 'visita_agendada', updated_at = now()
   where l.id = (select v.lead_id from public.visitas v where v.id = restore_visita.visita_id)
     and l.status = 'cancelado';
end $$;

revoke all on function public.soft_delete_visita(uuid), public.restore_visita(uuid) from public, anon;
grant execute on function public.soft_delete_visita(uuid), public.restore_visita(uuid) to authenticated;

-- 2) Convite manual desliga o automático
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.visita_convidar_corretor(uuid,uuid,numeric,text)'::regprocedure);
  if position('chamado_manual_assume' in src) = 0 then
    src := replace(src, E'  update public.visitas set corretor_id = p_corretor_id where id = v.id;',
      E'  update public.visitas set corretor_id = p_corretor_id where id = v.id;\n  update public.visit_cycles set chamado_automatico = false, updated_at = now() where visita_id = v.id and chamado_automatico; /* chamado_manual_assume */');
    if position('chamado_manual_assume' in src) = 0 then raise exception 'Ajuste de visita_convidar_corretor não aplicado'; end if;
    execute src;
  end if;
end $do$;

-- 4) Escolha com exclusões (a versão de 4 argumentos sai: o padrão do 5º mantém as chamadas antigas)
drop function if exists private.chamado_escolher(uuid, date, time, uuid);
create or replace function private.chamado_escolher(p_emp uuid, p_data date, p_hora time, p_visita uuid, p_excluir uuid[] default '{}')
returns table (corretor_id uuid, score numeric, motivo text)
language sql stable security definer set search_path to '' as $$
  select r.corretor_id, r.score, r.motivo
  from private.f1_rating(p_emp) r
  join public.corretores c on c.id = r.corretor_id and c.deleted_at is null and c.status = 'ativo'
  join public.profiles p on p.id = c.profile_id and p.user_id is not null
  where not (r.corretor_id = any (coalesce(p_excluir, '{}')))
    and (p_visita is null or not exists (select 1 from public.visita_convites x where x.visita_id = p_visita and x.corretor_id = r.corretor_id))
    and private.f1_corretor_ocupado(r.corretor_id, p_data, p_hora, p_visita) is null
  order by r.score desc nulls last, r.nome
  limit 1;
$$;
revoke all on function private.chamado_escolher(uuid, date, time, uuid, uuid[]) from public, anon, authenticated;

create or replace function private.chamado_proximo(p_visita uuid, p_ator uuid)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  cfg public.fase1_config; v public.visitas; n int; lead_nome text; avisar uuid[];
  esc_id uuid; esc_score numeric; esc_motivo text; tentados uuid[] := '{}'; motivo_fim text;
begin
  perform set_config('memude.fase1', '1', true);
  select * into cfg from public.fase1_config where id;
  select * into v from public.visitas where id = p_visita for update;
  if not found or v.deleted_at is not null or v.status <> 'aguardando_corretor' then return null; end if;
  if exists (select 1 from public.visita_convites where visita_id = v.id and resposta is null) then return null; end if;
  select count(*) into n from public.visita_convites where visita_id = v.id;
  select nome into lead_nome from public.leads where id = v.lead_id;

  if n >= cfg.chamado_tentativas then
    motivo_fim := n || ' convite' || case when n > 1 then 's' else '' end || ' sem aceite';
  elsif private.f1_inicio(v.data_visita, v.horario_visita) - now() < make_interval(mins => cfg.prazo_aceite_min) then
    motivo_fim := 'a visita começa em menos de ' || cfg.prazo_aceite_min || ' min';
  else
    -- Melhor livre pelo rating; confere o horário com trava (como no agendamento) e tenta o seguinte se conflitar
    for i in 1..10 loop
      esc_id := null;
      select e.corretor_id, e.score, e.motivo into esc_id, esc_score, esc_motivo
        from private.chamado_escolher(v.empreendimento_id, v.data_visita, v.horario_visita, v.id, tentados) e;
      exit when esc_id is null;
      begin
        perform private.f1_validar_corretor(esc_id, v.data_visita, v.horario_visita, v.id);
        exit;
      exception when others then
        tentados := tentados || esc_id;
        esc_id := null;
      end;
    end loop;
    if esc_id is null then
      motivo_fim := case when n = 0 then 'nenhum corretor livre nesse horário' else 'nenhum outro corretor livre' end;
    end if;
  end if;

  if motivo_fim is not null then
    update public.visit_cycles set chamado_automatico = false, updated_at = now() where visita_id = v.id;
    perform private.f1_evento(v.id, 'f1_chamado_esgotado', jsonb_build_object('convites', n, 'motivo', motivo_fim), p_ator);
    perform private.f1_tarefa('aceite_corretor', 'Nenhum corretor aceitou — escolha manualmente: ' || coalesce(lead_nome, 'cliente'),
      v.id, v.lead_id, v.criado_por, now(), now());
    avisar := array(select distinct u from unnest(array[v.criado_por] || coalesce(cfg.responsaveis, '{}'::uuid[])) u where u is not null);
    perform private.conv_push(avisar, 'Visita sem corretor',
      coalesce(lead_nome, 'Cliente') || ': ' || motivo_fim || '. Escolha manualmente.', '/visitas', 'chamado-' || v.id);
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
revoke all on function private.chamado_proximo(uuid, uuid) from public, anon, authenticated;

-- 3) Reagendar mantém o automático e não deixa visita sem ninguém cuidando
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.visita_reagendar(uuid,date,time without time zone,uuid,text)'::regprocedure);
  if position('chamado_auto_reagendar' in src) = 0 then
    src := replace(src, E'  insert into public.visit_cycles (visita_id, scheduled_at, match_status, previous_visita_id)\n  values (v_novo, private.f1_inicio(p_data, p_hora), ''searching'', o.id);',
      E'  insert into public.visit_cycles (visita_id, scheduled_at, match_status, previous_visita_id, chamado_automatico)\n  values (v_novo, private.f1_inicio(p_data, p_hora), ''searching'', o.id,\n    coalesce((select c.chamado_automatico from public.visit_cycles c where c.visita_id = o.id), false)); /* chamado_auto_reagendar */');
    src := replace(src, E'  return jsonb_build_object(''visita_id'', v_novo, ''visit_code'', v_codigo, ''visita_original_id'', o.id, ''status'', ''aguardando_corretor'');',
      E'  if v_corretor is null then\n    if exists (select 1 from public.visit_cycles c where c.visita_id = v_novo and c.chamado_automatico) then\n      perform private.chamado_proximo(v_novo, ator);\n    else\n      perform private.f1_tarefa(''aceite_corretor'', ''Escolha o corretor (reagendamento) — '' ||\n        (select nome from public.leads where id = o.lead_id), v_novo, o.lead_id, ator, now(), now());\n    end if;\n  end if;\n  return jsonb_build_object(''visita_id'', v_novo, ''visit_code'', v_codigo, ''visita_original_id'', o.id, ''status'', ''aguardando_corretor'');');
    if position('chamado_auto_reagendar' in src) = 0 or position('perform private.chamado_proximo(v_novo, ator)' in src) = 0 then
      raise exception 'Ajuste de visita_reagendar não aplicado';
    end if;
    execute src;
  end if;
end $do$;

-- 5) Tick: trava a visita primeiro e um erro numa visita não derruba as outras
create or replace function private.chamados_tick()
returns integer language plpgsql security definer set search_path to '' as $$
declare cfg public.fase1_config; r record; n int := 0; faltam int;
begin
  perform set_config('memude.fase1', '1', true);
  select * into cfg from public.fase1_config where id;
  for r in
    select vc.id, vc.visita_id, vc.corretor_id, vc.enviado_em, vc.reavisos, v.criado_por, cy.chamado_automatico auto,
           l.nome lead_nome, e.nome emp, p.user_id uid
    from public.visitas v
    join public.visita_convites vc on vc.visita_id = v.id and vc.resposta is null and vc.enviado_em > now() - interval '3 days'
    join public.visit_cycles cy on cy.visita_id = v.id
    join public.leads l on l.id = v.lead_id
    left join public.empreendimentos e on e.id = v.empreendimento_id
    left join public.corretores c on c.id = vc.corretor_id
    left join public.profiles p on p.id = c.profile_id
    where v.deleted_at is null and v.status = 'aguardando_corretor'
    order by vc.enviado_em
    for update of v, vc skip locked
  loop
    begin
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
    exception when others then
      raise warning 'chamados_tick: visita % não processada: %', r.visita_id, sqlerrm;
    end;
  end loop;
  return n;
end $$;
revoke all on function private.chamados_tick() from public, anon, authenticated;
