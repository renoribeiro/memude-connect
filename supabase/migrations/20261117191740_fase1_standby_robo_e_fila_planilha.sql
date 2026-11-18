-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

-- ===== Fila de sincronização com a planilha (gravada na mesma transação, por trigger) =====
create table if not exists public.sheet_sync_queue (
  id bigserial primary key,
  aba text not null check (aba in ('LEADS','VISITAS')),
  registro_id uuid not null,
  status text not null default 'pendente' check (status in ('pendente','processando','enviado','erro')),
  tentativas integer not null default 0,
  proxima_tentativa timestamptz not null default now(),
  lease_ate timestamptz,
  ultimo_erro text,
  origem text not null default 'trigger',
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);
create unique index if not exists sheet_sync_queue_aberto_unico
  on public.sheet_sync_queue (aba, registro_id) where status in ('pendente','erro');
create index if not exists sheet_sync_queue_proximos_idx
  on public.sheet_sync_queue (proxima_tentativa) where status in ('pendente','erro');
alter table public.sheet_sync_queue enable row level security;

create table if not exists public.sheet_sync_execucoes (
  id bigserial primary key,
  modo text not null,
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  enviados integer not null default 0,
  erros integer not null default 0,
  mensagem text,
  detalhes jsonb
);
create index if not exists sheet_sync_execucoes_recentes_idx on public.sheet_sync_execucoes (iniciado_em desc);
alter table public.sheet_sync_execucoes enable row level security;

drop policy if exists "Equipe comercial vê fila da planilha" on public.sheet_sync_queue;
create policy "Equipe comercial vê fila da planilha" on public.sheet_sync_queue
  for select to authenticated using ((select private.is_comercial()));
drop policy if exists "Equipe comercial vê execuções da planilha" on public.sheet_sync_execucoes;
create policy "Equipe comercial vê execuções da planilha" on public.sheet_sync_execucoes
  for select to authenticated using ((select private.is_comercial()));

create or replace function private.sheet_enfileirar(p_aba text, p_id uuid, p_origem text default 'trigger')
returns void language sql security definer set search_path = '' as $$
  insert into public.sheet_sync_queue (aba, registro_id, origem)
  values (p_aba, p_id, p_origem)
  on conflict (aba, registro_id) where status in ('pendente','erro') do nothing;
$$;

create or replace function private.sheet_trigger_lead()
returns trigger language plpgsql security definer set search_path = '' as $$
declare vid uuid;
begin
  perform private.sheet_enfileirar('LEADS', new.id);
  if tg_op = 'UPDATE' and (new.nome, new.telefone, new.fonte) is distinct from (old.nome, old.telefone, old.fonte) then
    for vid in select id from public.visitas where lead_id = new.id loop
      perform private.sheet_enfileirar('VISITAS', vid);
    end loop;
  end if;
  return new;
end $$;

create or replace function private.sheet_trigger_visita()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.sheet_enfileirar('VISITAS', new.id);
  return new;
end $$;

drop trigger if exists sheet_sync_lead on public.leads;
create trigger sheet_sync_lead after insert or update on public.leads
  for each row execute function private.sheet_trigger_lead();
drop trigger if exists sheet_sync_visita on public.visitas;
create trigger sheet_sync_visita after insert or update on public.visitas
  for each row execute function private.sheet_trigger_visita();

-- ===== Formatação das linhas (fonte única de verdade para o espelho) =====
create or replace function public.sheet_status_visita(p_status text)
returns text language sql immutable as $$
  select case p_status
    when 'aguardando_corretor' then 'Aguardando corretor'
    when 'agendada' then 'Agendada'
    when 'confirmada' then 'Confirmada'
    when 'realizada' then 'Realizada'
    when 'no_show' then 'No-show'
    when 'reagendada' then 'Reagendada'
    when 'cancelada' then 'Cancelada'
    else initcap(replace(coalesce(p_status, ''), '_', ' ')) end;
$$;

create or replace function private.sheet_linha_visita(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'nome', l.nome,
    'telefone', coalesce(l.telefone_exibicao, l.telefone),
    'data visita', to_char(v.data_visita, 'DD/MM/YYYY'),
    'fonte', coalesce(l.fonte, ''),
    'horario', to_char(v.horario_visita, 'HH24:MI:SS'),
    'imovel', coalesce(e.nome, ''),
    'local', coalesce(v.meeting_address, ''),
    'bairro', coalesce(v.meeting_neighborhood, ''),
    'corretor', coalesce(nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), ''),
    'status', case when v.deleted_at is not null then 'Cancelada' else public.sheet_status_visita(v.status) end,
    'data venda', coalesce(to_char(v.data_venda, 'DD/MM/YYYY'), ''),
    'follow up lucas', coalesce(nullif(concat_ws(' · ',
        case when v.avaliacao_lead is not null then 'Nota ' || v.avaliacao_lead || '/5' end,
        nullif(v.comentarios_lead, ''),
        case when nullif(v.feedback_corretor, '') is not null then 'Corretor: ' || v.feedback_corretor end,
        case when nullif(v.proximo_passo, '') is not null then 'Próximo passo: ' || v.proximo_passo end), ''), ''),
    'follow up no show', case when v.tentativas_remarcar > 0 then v.tentativas_remarcar::text else '' end,
    'ultima tentativa', coalesce(to_char(v.ultima_tentativa_remarcar at time zone 'America/Fortaleza', 'DD/MM/YYYY HH24:MI'), ''),
    'id_visita', v.id::text
  )
  from public.visitas v
  join public.leads l on l.id = v.lead_id
  left join public.empreendimentos e on e.id = v.empreendimento_id
  left join public.corretores c on c.id = v.corretor_id
  left join public.profiles p on p.id = c.profile_id
  where v.id = p_id;
$$;

create or replace function private.sheet_linha_lead(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
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
  )
  from public.leads l
  left join public.empreendimentos e on e.id = l.empreendimento_id
  left join public.profiles p on p.user_id = l.responsavel_id
  where l.id = p_id;
$$;

-- ===== Operações do enviador (somente service_role, chamadas pela edge function) =====
create or replace function public.sheet_sync_claim(p_limite integer default 200)
returns table (id bigint, aba text, registro_id uuid, tentativas integer, linha jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  update public.sheet_sync_queue q set status = 'erro', ultimo_erro = 'Execução interrompida; reenviando', lease_ate = null
  where q.status = 'processando' and q.lease_ate < now();

  return query
  with lote as (
    select q.id from public.sheet_sync_queue q
    where q.status in ('pendente','erro') and q.proxima_tentativa <= now()
    order by q.proxima_tentativa, q.id
    limit greatest(least(coalesce(p_limite, 200), 500), 1)
    for update skip locked
  ), marcado as (
    update public.sheet_sync_queue q set status = 'processando', tentativas = q.tentativas + 1,
      lease_ate = now() + interval '5 minutes'
    from lote where q.id = lote.id
    returning q.id, q.aba, q.registro_id, q.tentativas
  )
  select m.id, m.aba, m.registro_id, m.tentativas,
    case when m.aba = 'LEADS' then private.sheet_linha_lead(m.registro_id) else private.sheet_linha_visita(m.registro_id) end
  from marcado m;
end $$;

create or replace function public.sheet_sync_concluir(p_ok bigint[], p_falhas jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare f jsonb;
begin
  update public.sheet_sync_queue set status = 'enviado', enviado_em = now(), lease_ate = null, ultimo_erro = null
  where id = any(coalesce(p_ok, '{}'));
  for f in select * from jsonb_array_elements(coalesce(p_falhas, '[]'::jsonb)) loop
    update public.sheet_sync_queue q set status = 'erro', lease_ate = null,
      ultimo_erro = left(f->>'erro', 500),
      proxima_tentativa = now() + least(power(2, q.tentativas)::int, 60) * interval '1 minute'
    where q.id = (f->>'id')::bigint;
  end loop;
end $$;

create or replace function public.sheet_sync_ids(p_aba text)
returns table (registro_id uuid, linha jsonb)
language sql stable security definer set search_path = '' as $$
  select l.id, private.sheet_linha_lead(l.id) from public.leads l where p_aba = 'LEADS'
  union all
  select v.id, private.sheet_linha_visita(v.id) from public.visitas v where p_aba = 'VISITAS';
$$;

do $$
declare f text;
begin
  foreach f in array array['public.sheet_sync_claim(integer)', 'public.sheet_sync_concluir(bigint[],jsonb)', 'public.sheet_sync_ids(text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ===== Tela de sincronização (admin) =====
create or replace function public.sheet_sync_painel()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.f1_exigir_comercial();
  return jsonb_build_object(
    'fila', (select count(*) from public.sheet_sync_queue where status in ('pendente','processando')),
    'erros', (select count(*) from public.sheet_sync_queue where status = 'erro'),
    'ultimo_envio', (select max(enviado_em) from public.sheet_sync_queue),
    'execucoes', coalesce((select jsonb_agg(to_jsonb(e) order by e.iniciado_em desc)
      from (select * from public.sheet_sync_execucoes order by iniciado_em desc limit 15) e), '[]'::jsonb),
    'itens_com_erro', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'aba', q.aba, 'registro_id', q.registro_id,
        'tentativas', q.tentativas, 'erro', q.ultimo_erro, 'proxima_tentativa', q.proxima_tentativa) order by q.id)
      from (select * from public.sheet_sync_queue where status = 'erro' order by id limit 50) q), '[]'::jsonb),
    'robo_ativo', (select enabled from public.visit_automation_config where id),
    'intake_ativo', (select intake_enabled from public.visit_automation_config where id)
  );
end $$;

create or replace function public.sheet_sync_reenviar()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not private.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  update public.sheet_sync_queue set proxima_tentativa = now(), tentativas = 0 where status = 'erro';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.sheet_sync_painel() from public, anon;
revoke all on function public.sheet_sync_reenviar() from public, anon;
grant execute on function public.sheet_sync_painel() to authenticated;
grant execute on function public.sheet_sync_reenviar() to authenticated;
revoke all on function public.sheet_status_visita(text) from anon;

-- ===== STAND-BY da automação de visitas (robô de WhatsApp) =====
-- Verificado antes: 0 visitas futuras do robô e 0 mensagens pendentes na fila do robô.
-- Religar: update public.visit_automation_config set enabled = true, intake_enabled = true where id;
update public.visit_automation_config set enabled = false, intake_enabled = false, updated_at = now() where id;

-- Espelho inicial: todo lead e visita existentes entram na fila
insert into public.sheet_sync_queue (aba, registro_id, origem)
select 'LEADS', id, 'carga_inicial' from public.leads
on conflict (aba, registro_id) where status in ('pendente','erro') do nothing;
insert into public.sheet_sync_queue (aba, registro_id, origem)
select 'VISITAS', id, 'carga_inicial' from public.visitas
on conflict (aba, registro_id) where status in ('pendente','erro') do nothing;
;
