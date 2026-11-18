-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

-- Guarda as definições originais das funções do robô que receberão a guarda de stand-by (reversão: executar "definicao")
create table if not exists backup_20261117.function_defs as
select n.nspname || '.' || p.proname as funcao, pg_get_functiondef(p.oid) as definicao, now() as salvo_em
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'private' and p.proname in ('visit_capture','visit_match_event','visit_contact_changed','visit_project_crm'))
   or (n.nspname = 'public' and p.proname = 'process_crm_visit_automations');

-- Interruptor único: robô ativo = config ligada e a operação não veio do fluxo manual da Fase 1
create or replace function private.visit_bot_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.enabled from public.visit_automation_config c where c.id), false)
     and coalesce(current_setting('memude.fase1', true), '') <> '1';
$$;

do $$
declare
  f text;
  d text;
begin
  foreach f in array array[
    'private.visit_capture','private.visit_match_event','private.visit_contact_changed',
    'private.visit_project_crm','public.process_crm_visit_automations'
  ] loop
    d := pg_get_functiondef(f::regproc);
    continue when position('private.visit_bot_active()' in d) > 0;
    d := regexp_replace(d, '(\r?\n)BEGIN(\r?\n)', '\1BEGIN\2  IF NOT private.visit_bot_active() THEN RETURN NEW; END IF;\2');
    if position('private.visit_bot_active()' in d) = 0 then
      raise exception 'Guarda de stand-by não aplicada em %', f;
    end if;
    execute d;
  end loop;
end $$;

-- Leads: chave de telefone, listas da planilha, responsável e data de entrada
alter table public.leads
  add column if not exists telefone_chave text,
  add column if not exists telefone_exibicao text,
  add column if not exists telefone_chave_conflito boolean not null default false,
  add column if not exists status_atendimento text not null default 'NOVO',
  add column if not exists fonte text,
  add column if not exists responsavel_id uuid references auth.users(id) on delete set null,
  add column if not exists data_entrada date not null default (now() at time zone 'America/Fortaleza')::date;

alter table public.leads drop constraint if exists leads_status_atendimento_check;
alter table public.leads add constraint leads_status_atendimento_check check (status_atendimento in
  ('NOVO','EM CONVERSA','INTERESSADO','VISITA AGENDADA','INVESTIDOR','CORRETOR','SEM RENDA','NÃO INTERESSADO'));
alter table public.leads drop constraint if exists leads_fonte_check;
alter table public.leads add constraint leads_fonte_check check (fonte is null or fonte in ('Google','Meta','Cadastro','Follow','Outros'));

comment on column public.leads.telefone_chave is 'DDD-últimos 8 dígitos. Única entre leads ativos não marcados como conflito.';
comment on column public.leads.telefone_chave_conflito is 'Duplicado histórico (anterior à Fase 1) ou criado por fluxo legado; nunca mesclado automaticamente.';

create or replace function public.fonte_from_origem(p_origem text)
returns text
language sql
immutable
as $$
  select case lower(btrim(coalesce(p_origem, '')))
    when '' then null
    when 'google' then 'Google' when 'website' then 'Google' when 'whatsapp' then 'Google'
    when 'facebook' then 'Meta' when 'instagram' then 'Meta' when 'meta' then 'Meta'
    when 'indicacao' then 'Follow' when 'follow' then 'Follow'
    when 'cadastro' then 'Cadastro'
    else 'Outros' end;
$$;

-- Backfill sem disparar triggers (evita webhooks ao Financeiro e reprocessamento do robô)
set local session_replication_role = replica;

with k as (
  select l.id,
         public.normalize_phone_key(l.telefone) as chave,
         public.normalize_phone_display(l.telefone) as exib,
         row_number() over (partition by public.normalize_phone_key(l.telefone), (l.deleted_at is null)
                            order by l.created_at, l.id) as rn
  from public.leads l
)
update public.leads l set
  telefone_chave = k.chave,
  telefone_exibicao = k.exib,
  telefone_chave_conflito = (l.deleted_at is null and k.chave is not null and k.rn > 1),
  fonte = coalesce(l.fonte, public.fonte_from_origem(l.origem)),
  status_atendimento = case l.status::text
    when 'novo' then 'NOVO'
    when 'visita_agendada' then 'VISITA AGENDADA'
    when 'visita_confirmada' then 'VISITA AGENDADA'
    when 'visita_realizada' then 'INTERESSADO'
    when 'cancelado' then 'NÃO INTERESSADO'
    else 'EM CONVERSA' end,
  data_entrada = (coalesce(l.created_at, now()) at time zone 'America/Fortaleza')::date,
  responsavel_id = (
    select p.user_id from public.profiles p
    where p.id = l.created_by
      and exists (select 1 from public.user_roles r where r.user_id = p.user_id and r.role in ('admin','sdr'))
  )
from k where k.id = l.id;

set local session_replication_role = origin;

create unique index if not exists leads_telefone_chave_unico
  on public.leads (telefone_chave) where deleted_at is null and not telefone_chave_conflito;
create index if not exists leads_telefone_chave_idx on public.leads (telefone_chave);
create index if not exists leads_status_atendimento_idx on public.leads (status_atendimento) where deleted_at is null;
create index if not exists leads_responsavel_idx on public.leads (responsavel_id) where deleted_at is null;

-- Mantém chave/exibição/fonte sempre coerentes, por qualquer caminho de escrita
create or replace function private.leads_fase1_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.telefone is distinct from old.telefone then
    new.telefone_chave := public.normalize_phone_key(new.telefone);
    new.telefone_exibicao := public.normalize_phone_display(new.telefone);
    new.telefone_chave_conflito := false;
    if new.telefone_chave is not null and new.deleted_at is null and exists (
      select 1 from public.leads l
      where l.telefone_chave = new.telefone_chave and l.deleted_at is null
        and not l.telefone_chave_conflito and l.id <> new.id
    ) then
      if tg_op = 'UPDATE' then
        raise exception 'Já existe um lead ativo com este telefone' using errcode = '23505';
      end if;
      -- Fluxos legados (agentes de IA, webhooks) não podem quebrar: o duplicado é sinalizado, nunca mesclado
      new.telefone_chave_conflito := true;
    end if;
  end if;
  if new.fonte is null then
    new.fonte := public.fonte_from_origem(new.origem);
  end if;
  return new;
end $$;

drop trigger if exists leads_fase1_before on public.leads;
create trigger leads_fase1_before
  before insert or update on public.leads
  for each row execute function private.leads_fase1_before();

-- Grupos de duplicados para decisão manual
create or replace view public.leads_duplicados with (security_invoker = true) as
select l.telefone_chave,
       count(*) as quantidade,
       array_agg(l.id order by l.created_at, l.id) as lead_ids,
       array_agg(l.nome order by l.created_at, l.id) as nomes,
       min(l.created_at) as primeiro_cadastro,
       max(l.created_at) as ultimo_cadastro
from public.leads l
where l.deleted_at is null and l.telefone_chave is not null
group by l.telefone_chave
having count(*) > 1;

-- Histórico datado do lead
create table if not exists public.lead_eventos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  tipo text not null,
  campo text,
  de text,
  para text,
  observacao text,
  ator_id uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists lead_eventos_lead_idx on public.lead_eventos (lead_id, criado_em desc);
alter table public.lead_eventos enable row level security;

create or replace function private.leads_fase1_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ator uuid := (select auth.uid());
  emp_old text;
  emp_new text;
  resp_old text;
  resp_new text;
begin
  if tg_op = 'INSERT' then
    insert into public.lead_eventos (lead_id, tipo, observacao, ator_id)
    values (new.id, 'criado', 'Lead cadastrado' || coalesce(' via ' || nullif(new.origem, ''), ''), ator);
    return new;
  end if;

  if new.nome is distinct from old.nome then
    insert into public.lead_eventos (lead_id, tipo, campo, de, para, ator_id) values (new.id, 'alteracao', 'Nome', old.nome, new.nome, ator);
  end if;
  if new.telefone is distinct from old.telefone then
    insert into public.lead_eventos (lead_id, tipo, campo, de, para, ator_id) values (new.id, 'alteracao', 'Telefone', old.telefone_exibicao, new.telefone_exibicao, ator);
  end if;
  if new.status_atendimento is distinct from old.status_atendimento then
    insert into public.lead_eventos (lead_id, tipo, campo, de, para, ator_id) values (new.id, 'status', 'Status', old.status_atendimento, new.status_atendimento, ator);
  end if;
  if new.fonte is distinct from old.fonte then
    insert into public.lead_eventos (lead_id, tipo, campo, de, para, ator_id) values (new.id, 'alteracao', 'Fonte', old.fonte, new.fonte, ator);
  end if;
  if new.empreendimento_id is distinct from old.empreendimento_id then
    select nome into emp_old from public.empreendimentos where id = old.empreendimento_id;
    select nome into emp_new from public.empreendimentos where id = new.empreendimento_id;
    insert into public.lead_eventos (lead_id, tipo, campo, de, para, ator_id) values (new.id, 'alteracao', 'Empreendimento', emp_old, emp_new, ator);
  end if;
  if new.responsavel_id is distinct from old.responsavel_id then
    select first_name || ' ' || last_name into resp_old from public.profiles where user_id = old.responsavel_id;
    select first_name || ' ' || last_name into resp_new from public.profiles where user_id = new.responsavel_id;
    insert into public.lead_eventos (lead_id, tipo, campo, de, para, ator_id) values (new.id, 'alteracao', 'Responsável', resp_old, resp_new, ator);
  end if;
  if new.observacoes is distinct from old.observacoes then
    insert into public.lead_eventos (lead_id, tipo, campo, de, para, ator_id) values (new.id, 'alteracao', 'Observações', left(old.observacoes, 500), left(new.observacoes, 500), ator);
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    insert into public.lead_eventos (lead_id, tipo, observacao, ator_id)
    values (new.id, 'arquivamento', case when new.deleted_at is null then 'Lead restaurado' else 'Lead arquivado' end, ator);
  end if;
  return new;
end $$;

drop trigger if exists leads_fase1_historico on public.leads;
create trigger leads_fase1_historico
  after insert or update on public.leads
  for each row execute function private.leads_fase1_historico();
;
