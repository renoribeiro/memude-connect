-- ============================================================
-- Ajustes de 23/11/2026
-- 1) Visita cancelada/reagendada/excluída (por qualquer tela) encerra as tarefas pendentes dela;
--    realizada/no-show encerra confirmações, aceite e "registrar resultado" que sobraram.
-- 2) Leads: excluir (vai para a lixeira, dá para restaurar) e ações em massa.
-- 3) Planilha: conflitos de importação não se repetem a cada sincronização diária;
--    lead excluído aparece como ARQUIVADO na planilha mesmo com rótulo antigo.
-- ============================================================

-- ---------- 1) Tarefas de visita que não acontece mais ----------
create or replace function private.tarefas_fechar_por_status_visita()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if NEW.deleted_at is not null or NEW.status in ('cancelada', 'reagendada') then
    update public.tarefas set status = 'cancelada', concluida_em = now(),
      observacao = coalesce(observacao, case when NEW.deleted_at is not null then 'Visita excluída'
                                             when NEW.status = 'reagendada' then 'Visita reagendada' else 'Visita cancelada' end)
    where visita_id = NEW.id and status = 'pendente' and tipo not in ('atividade', 'manual');
  elsif NEW.status in ('realizada', 'no_show') then
    update public.tarefas set status = 'cancelada', concluida_em = now(),
      observacao = coalesce(observacao, 'Visita já teve resultado')
    where visita_id = NEW.id and status = 'pendente'
      and tipo in ('aceite_corretor', 'confirmacao_d2', 'confirmacao_d1', 'confirmacao_d0', 'registrar_resultado');
  end if;
  return NEW;
end $$;

drop trigger if exists tarefas_status_visita on public.visitas;
create trigger tarefas_status_visita
  after update of status, deleted_at on public.visitas
  for each row when (old.status is distinct from new.status or old.deleted_at is distinct from new.deleted_at)
  execute function private.tarefas_fechar_por_status_visita();

-- Limpa o que já ficou para trás (ex.: visita cancelada pela tela de Visitas)
update public.tarefas t set status = 'cancelada', concluida_em = now(),
  observacao = coalesce(t.observacao, case when v.deleted_at is not null then 'Visita excluída'
                                           when v.status = 'reagendada' then 'Visita reagendada' else 'Visita cancelada' end)
from public.visitas v
where v.id = t.visita_id and t.status = 'pendente' and t.tipo not in ('atividade', 'manual')
  and (v.deleted_at is not null or v.status in ('cancelada', 'reagendada'));

update public.tarefas t set status = 'cancelada', concluida_em = now(), observacao = coalesce(t.observacao, 'Visita já teve resultado')
from public.visitas v
where v.id = t.visita_id and t.status = 'pendente' and v.status in ('realizada', 'no_show')
  and t.tipo in ('aceite_corretor', 'confirmacao_d2', 'confirmacao_d1', 'confirmacao_d0', 'registrar_resultado');

-- ---------- 2) Leads: excluir, restaurar e ações em massa ----------
create or replace function public.leads_excluir(p_ids uuid[])
returns jsonb language plpgsql security definer set search_path to '' as $$
declare ator uuid := private.f1_exigir_comercial(); v_ids uuid[];
begin
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'Escolha ao menos um lead' using errcode = '22023'; end if;
  if cardinality(p_ids) > 500 then raise exception 'Exclua no máximo 500 leads por vez' using errcode = '22023'; end if;
  perform set_config('memude.fase1', '1', true);
  with x as (
    update public.leads set deleted_at = now() where id = any (p_ids) and deleted_at is null returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from x;
  -- Card aberto no CRM vai para arquivados; tarefas soltas do lead são encerradas
  update public.crm_leads set archived_at = now() where lead_id = any (v_ids) and archived_at is null and completed_at is null;
  update public.tarefas set status = 'cancelada', concluida_em = now(), observacao = coalesce(observacao, 'Lead excluído')
    where lead_id = any (v_ids) and status = 'pendente' and visita_id is null;
  insert into public.lead_eventos (lead_id, tipo, campo, de, para, ator_id)
    select id, 'alteracao', 'Situação', 'Ativo', 'Excluído (lixeira)', ator from unnest(v_ids) id;
  return jsonb_build_object('excluidos', cardinality(v_ids), 'ids', to_jsonb(v_ids));
end $$;

create or replace function public.leads_restaurar(p_ids uuid[])
returns jsonb language plpgsql security definer set search_path to '' as $$
declare ator uuid := private.f1_exigir_comercial(); v_ids uuid[];
begin
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'Escolha ao menos um lead' using errcode = '22023'; end if;
  perform set_config('memude.fase1', '1', true);
  -- Só voltam os cards arquivados pela própria exclusão (mesmo momento), não os arquivados antes
  update public.crm_leads c set archived_at = null
    from public.leads l
    where c.lead_id = l.id and l.id = any (p_ids) and l.deleted_at is not null
      and c.archived_at is not null and c.completed_at is null and c.archived_at >= l.deleted_at - interval '1 minute';
  with x as (
    update public.leads set deleted_at = null where id = any (p_ids) and deleted_at is not null returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from x;
  insert into public.lead_eventos (lead_id, tipo, campo, de, para, ator_id)
    select id, 'alteracao', 'Situação', 'Excluído (lixeira)', 'Ativo', ator from unnest(v_ids) id;
  return jsonb_build_object('restaurados', cardinality(v_ids));
end $$;

-- Status, responsável ou fonte para vários leads de uma vez (mesmas regras da edição de um lead)
create or replace function public.leads_em_massa(p_ids uuid[], p_campos jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare ator uuid := private.f1_exigir_comercial(); k text; i uuid; n int := 0;
begin
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'Escolha ao menos um lead' using errcode = '22023'; end if;
  if cardinality(p_ids) > 500 then raise exception 'Altere no máximo 500 leads por vez' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(p_campos) loop
    if k not in ('status_atendimento', 'responsavel_id', 'fonte', 'empreendimento_id') then
      raise exception 'Campo % não pode ser alterado em massa', k using errcode = '22023';
    end if;
  end loop;
  foreach i in array p_ids loop
    if exists (select 1 from public.leads where id = i and deleted_at is null) then
      perform public.lead_atualizar(i, p_campos);
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('alterados', n);
end $$;

revoke all on function public.leads_excluir(uuid[]) from public, anon;
revoke all on function public.leads_restaurar(uuid[]) from public, anon;
revoke all on function public.leads_em_massa(uuid[], jsonb) from public, anon;
grant execute on function public.leads_excluir(uuid[]) to authenticated;
grant execute on function public.leads_restaurar(uuid[]) to authenticated;
grant execute on function public.leads_em_massa(uuid[], jsonb) to authenticated;

-- ---------- 3) Planilha ----------
-- A importação diária relê linhas duplicadas da planilha; o mesmo conflito em aberto não é gravado de novo.
create or replace function private.import_conflito_sem_repetir()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if exists (
    select 1 from public.import_conflitos c
    where c.aba = NEW.aba and c.campo = NEW.campo and not coalesce(c.resolvido, false)
      and c.lead_id is not distinct from NEW.lead_id and c.visita_id is not distinct from NEW.visita_id
      and coalesce(c.valor_planilha, '') = coalesce(NEW.valor_planilha, '')
  ) then
    return null;
  end if;
  return NEW;
end $$;

drop trigger if exists import_conflito_sem_repetir on public.import_conflitos;
create trigger import_conflito_sem_repetir before insert on public.import_conflitos
  for each row execute function private.import_conflito_sem_repetir();

-- Lead excluído: "ARQUIVADO" na planilha (o rótulo antigo da planilha não sobrepõe mais)
create or replace function private.sheet_linha_lead(p_id uuid)
returns jsonb language sql stable security definer set search_path to '' as $function$
  with b as (
    select l.planilha_extra as x, l.deleted_at, jsonb_build_object(
      'nome', l.nome,
      'telefone', coalesce(l.telefone_exibicao, l.telefone),
      'empreendimento', coalesce(e.nome, ''),
      'fonte', coalesce(l.fonte, ''),
      'status', case when l.deleted_at is not null then 'ARQUIVADO' else l.status_atendimento end,
      'responsavel', coalesce(nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), ''),
      'entrada', to_char(l.data_entrada, 'DD/MM/YYYY'),
      'proxima visita', coalesce((
        select to_char(v.data_visita, 'DD/MM/YYYY') || ' ' || to_char(v.horario_visita, 'HH24:MI')
        from public.visitas v
        where v.lead_id = l.id and v.deleted_at is null and v.status in ('aguardando_corretor','agendada','confirmada')
        order by v.data_visita, v.horario_visita limit 1), ''),
      'observacao', coalesce(l.observacoes, ''),
      'email', coalesce(l.email, ''),
      'id_lead', l.id::text
    ) as j
    from public.leads l
    left join public.empreendimentos e on e.id = l.empreendimento_id
    left join public.profiles p on p.user_id = l.responsavel_id
    where l.id = p_id
  )
  select b.j
    || coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(b.x, '{}'::jsonb)) e
                 where b.j ? e.key and coalesce(b.j->>e.key, '') = ''), '{}'::jsonb)
    || case when b.x ? 'status_label' and b.deleted_at is null then jsonb_build_object('status', b.x->>'status_label') else '{}'::jsonb end
  from b;
$function$;

-- Sincronização diária às 17:30 (Fortaleza): planilha → CRM (linhas novas) e CRM → planilha.
-- Segunda passada às 17:45 termina o que não coube na primeira.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'fase1-planilha-espelho'),
  command := $cmd$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/sheets-espelho',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')),
    body := '{"modo":"diario"}'::jsonb,
    timeout_milliseconds := 150000
  );
  $cmd$
);
