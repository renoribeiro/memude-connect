-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

alter table public.visitas
  add column if not exists local_nome text,
  add column if not exists criado_por uuid references auth.users(id) on delete set null,
  add column if not exists motivo_cancelamento text,
  add column if not exists proximo_passo text,
  add column if not exists data_venda date,
  add column if not exists tentativas_remarcar integer not null default 0,
  add column if not exists ultima_tentativa_remarcar timestamptz,
  add column if not exists no_show_em timestamptz,
  add column if not exists escalada_em timestamptz,
  add column if not exists fase1 boolean not null default false;

comment on column public.visitas.status is 'Fase 1: aguardando_corretor, agendada, confirmada, realizada, no_show, reagendada, cancelada.';
comment on column public.visitas.avaliacao_lead is 'Nota do cliente (1 a 5) registrada no retorno pós-visita.';
comment on column public.visitas.comentarios_lead is 'Impressão do cliente registrada no retorno pós-visita.';
comment on column public.visitas.feedback_corretor is 'Retorno do corretor registrado no pós-visita.';

create index if not exists visitas_data_idx on public.visitas (data_visita, horario_visita) where deleted_at is null;
create index if not exists visitas_lead_idx on public.visitas (lead_id) where deleted_at is null;

alter table public.visit_events add column if not exists ator_id uuid references auth.users(id) on delete set null;
create index if not exists visit_events_visita_idx on public.visit_events (visita_id, created_at desc);

alter table public.corretores
  add column if not exists rating_score numeric(5,2),
  add column if not exists rating_detalhe jsonb,
  add column if not exists rating_calculado_em timestamptz,
  add column if not exists sugerir_em_visitas boolean not null default true;

set local session_replication_role = replica;
update public.corretores c set sugerir_em_visitas = false
from public.profiles p
where p.id = c.profile_id and p.first_name = 'Closer' and p.last_name = 'MeMude';
set local session_replication_role = origin;

create table if not exists public.visita_convites (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid not null references public.visitas(id) on delete cascade,
  corretor_id uuid not null references public.corretores(id),
  enviado_em timestamptz not null default now(),
  respondido_em timestamptz,
  resposta text check (resposta in ('aceitou','recusou','sem_resposta')),
  score numeric(5,2),
  motivo_sugestao text,
  criado_por uuid references auth.users(id) on delete set null
);
create index if not exists visita_convites_visita_idx on public.visita_convites (visita_id, enviado_em desc);
create index if not exists visita_convites_corretor_idx on public.visita_convites (corretor_id);
create unique index if not exists visita_convites_um_pendente on public.visita_convites (visita_id) where resposta is null;
alter table public.visita_convites enable row level security;

create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('aceite_corretor','confirmacao_d2','confirmacao_d1','confirmacao_d0',
    'registrar_resultado','retorno','proximo_passo','remarcar_no_show','escalada','manual')),
  titulo text not null,
  visita_id uuid references public.visitas(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  dono_id uuid references auth.users(id) on delete set null,
  disponivel_em timestamptz not null default now(),
  vence_em timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente','concluida','cancelada')),
  concluida_em timestamptz,
  concluida_por uuid references auth.users(id) on delete set null,
  observacao text,
  criado_em timestamptz not null default now()
);
create index if not exists tarefas_dono_pendentes_idx on public.tarefas (dono_id, vence_em) where status = 'pendente';
create index if not exists tarefas_pendentes_idx on public.tarefas (vence_em) where status = 'pendente';
create index if not exists tarefas_visita_idx on public.tarefas (visita_id);
create unique index if not exists tarefas_unica_pendente on public.tarefas (visita_id, tipo) where status = 'pendente' and visita_id is not null;
alter table public.tarefas enable row level security;

create table if not exists public.fase1_config (
  id boolean primary key default true check (id),
  pesos jsonb not null default '{"conversao":40,"aderencia":30,"aceite":15,"nota":15}'::jsonb,
  prazo_aceite_min integer not null default 15 check (prazo_aceite_min between 1 and 1440),
  prazo_d0_horas_antes integer not null default 3 check (prazo_d0_horas_antes between 0 and 24),
  prazo_resultado_horas integer not null default 2 check (prazo_resultado_horas between 1 and 72),
  prazo_retorno_horas integer not null default 24 check (prazo_retorno_horas between 1 and 240),
  prazo_proximo_passo_horas integer not null default 48 check (prazo_proximo_passo_horas between 1 and 480),
  prazo_remarcar_horas integer not null default 24 check (prazo_remarcar_horas between 1 and 240),
  escalar_tentativas integer not null default 2 check (escalar_tentativas between 1 and 10),
  escalar_horas integer not null default 72 check (escalar_horas between 1 and 720),
  min_visitas_historico integer not null default 5 check (min_visitas_historico between 0 and 100),
  closer_user_id uuid references auth.users(id) on delete set null,
  manual_corretor_url text not null default 'https://canva.link/memudeguias-corretorparceiro',
  site_url text not null default 'https://memude.com.br',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint fase1_config_pesos_100 check (
    coalesce((pesos->>'conversao')::numeric,0) + coalesce((pesos->>'aderencia')::numeric,0)
    + coalesce((pesos->>'aceite')::numeric,0) + coalesce((pesos->>'nota')::numeric,0) = 100
    and coalesce((pesos->>'conversao')::numeric,0) >= 0 and coalesce((pesos->>'aderencia')::numeric,0) >= 0
    and coalesce((pesos->>'aceite')::numeric,0) >= 0 and coalesce((pesos->>'nota')::numeric,0) >= 0)
);
alter table public.fase1_config enable row level security;

insert into public.fase1_config (id, closer_user_id)
values (true, '4c070d6d-4d74-45a7-8bb4-8e873695b349')
on conflict (id) do nothing;

create table if not exists public.import_conflitos (
  id uuid primary key default gen_random_uuid(),
  aba text not null,
  linha integer,
  telefone_chave text,
  lead_id uuid references public.leads(id) on delete set null,
  visita_id uuid references public.visitas(id) on delete set null,
  campo text,
  valor_core text,
  valor_planilha text,
  dados_planilha jsonb,
  resolvido boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists import_conflitos_pendentes_idx on public.import_conflitos (criado_em desc) where not resolvido;
alter table public.import_conflitos enable row level security;

create or replace function private.is_comercial()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role in ('admin','sdr','closer')
  );
$$;
grant execute on function private.is_comercial() to authenticated;
grant execute on function private.visit_bot_active() to authenticated;

drop policy if exists "Equipe comercial gerencia leads" on public.leads;
create policy "Equipe comercial gerencia leads" on public.leads
  for all to authenticated using ((select private.is_comercial())) with check ((select private.is_comercial()));

drop policy if exists "Equipe comercial vê visitas" on public.visitas;
create policy "Equipe comercial vê visitas" on public.visitas
  for select to authenticated using ((select private.is_comercial()));

drop policy if exists "Equipe comercial vê ciclos" on public.visit_cycles;
create policy "Equipe comercial vê ciclos" on public.visit_cycles
  for select to authenticated using ((select private.is_comercial()));

drop policy if exists "Equipe comercial vê eventos de visita" on public.visit_events;
create policy "Equipe comercial vê eventos de visita" on public.visit_events
  for select to authenticated using ((select private.is_comercial()));

drop policy if exists "Equipe comercial vê corretores" on public.corretores;
create policy "Equipe comercial vê corretores" on public.corretores
  for select to authenticated using ((select private.is_comercial()) and deleted_at is null);

drop policy if exists "Equipe comercial vê perfis" on public.profiles;
create policy "Equipe comercial vê perfis" on public.profiles
  for select to authenticated using ((select private.is_comercial()));

drop policy if exists "Equipe comercial vê histórico de leads" on public.lead_eventos;
create policy "Equipe comercial vê histórico de leads" on public.lead_eventos
  for select to authenticated using ((select private.is_comercial()));

drop policy if exists "Equipe comercial vê convites" on public.visita_convites;
create policy "Equipe comercial vê convites" on public.visita_convites
  for select to authenticated using ((select private.is_comercial()));

drop policy if exists "Equipe comercial vê tarefas" on public.tarefas;
create policy "Equipe comercial vê tarefas" on public.tarefas
  for select to authenticated using ((select private.is_comercial()));

drop policy if exists "Equipe comercial lê configuração" on public.fase1_config;
create policy "Equipe comercial lê configuração" on public.fase1_config
  for select to authenticated using ((select private.is_comercial()));
drop policy if exists "Admin altera configuração" on public.fase1_config;
create policy "Admin altera configuração" on public.fase1_config
  for update to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Admin vê conflitos de importação" on public.import_conflitos;
create policy "Admin vê conflitos de importação" on public.import_conflitos
  for select to authenticated using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));
drop policy if exists "Admin resolve conflitos de importação" on public.import_conflitos;
create policy "Admin resolve conflitos de importação" on public.import_conflitos
  for update to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

do $$
declare t text;
begin
  foreach t in array array['bairros','construtoras','corretor_bairros','corretor_construtoras'] loop
    execute format('drop policy if exists "Equipe comercial lê %1$s" on public.%1$I', t);
    execute format('create policy "Equipe comercial lê %1$s" on public.%1$I for select to authenticated using ((select private.is_comercial()))', t);
  end loop;
end $$;
;
