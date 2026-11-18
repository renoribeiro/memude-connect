-- Fase 2: relatórios automáticos (substituem os fluxos do n8n "Daily Report" e "Report Semanal").

create table if not exists public.relatorios_automaticos (
  id text primary key check (id in ('diario','semanal')),
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  dias_semana smallint[] not null check (array_length(dias_semana, 1) between 1 and 7),
  hora time not null,
  destinatarios text[] not null default '{}',
  enviar_email boolean not null default true,
  enviar_whatsapp boolean not null default false,
  whatsapp_destino text,
  evolution_instance_id uuid references public.evolution_instances(id) on delete set null,
  meta_visitas_dia integer not null default 2 check (meta_visitas_dia between 0 and 100),
  fonte_dados text not null default 'planilha' check (fonte_dados in ('planilha','core')),
  remetente text not null default 'Portal MeMude <relatorios@memude.com.br>',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);
alter table public.relatorios_automaticos enable row level security;

create table if not exists public.relatorios_envios (
  id bigserial primary key,
  relatorio text not null references public.relatorios_automaticos(id),
  referencia date not null,
  canal text not null check (canal in ('email','whatsapp')),
  status text not null check (status in ('enviado','erro','ignorado')),
  teste boolean not null default false,
  destinatarios text[],
  assunto text,
  erro text,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);
-- Trava contra envio repetido: um envio real por relatório, dia e canal
create unique index if not exists relatorios_envios_unico
  on public.relatorios_envios (relatorio, referencia, canal) where status = 'enviado' and not teste;
create index if not exists relatorios_envios_recentes on public.relatorios_envios (relatorio, criado_em desc);
alter table public.relatorios_envios enable row level security;

drop policy if exists "Admin lê relatórios automáticos" on public.relatorios_automaticos;
create policy "Admin lê relatórios automáticos" on public.relatorios_automaticos for select to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));
drop policy if exists "Admin lê envios de relatórios" on public.relatorios_envios;
create policy "Admin lê envios de relatórios" on public.relatorios_envios for select to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));
revoke all on public.relatorios_automaticos, public.relatorios_envios from anon;
revoke insert, update, delete, truncate, references, trigger on public.relatorios_automaticos, public.relatorios_envios from authenticated;
grant select on public.relatorios_automaticos, public.relatorios_envios to authenticated;
revoke all on sequence public.relatorios_envios_id_seq from anon, authenticated;

insert into public.relatorios_automaticos (id, nome, descricao, dias_semana, hora, destinatarios, enviar_whatsapp, whatsapp_destino, evolution_instance_id)
values
  ('diario', 'Boletim diário', 'Leads e visitas do dia, comparação com ontem, meta de visitas e próximas visitas (7 dias).',
   '{1,2,3,4,5}', '17:00',
   '{ramontoso11@gmail.com,reno@memude.com.br,serginho@memude.com.br,lucasmoura.realestate@gmail.com}',
   false, '120363417112012222@g.us', (select id from public.evolution_instances where instance_name = 'memude-visitas' limit 1)),
  ('semanal', 'Relatório semanal', 'Últimos 7 dias com gráficos: evolução de leads, canais, status, corretores e resultado das visitas.',
   '{5}', '17:30',
   '{ramontoso11@gmail.com,reno@memude.com.br,serginho@memude.com.br,lucasmoura.realestate@gmail.com}',
   false, null, null)
on conflict (id) do nothing;

-- Horário local de Fortaleza (UTC-3) -> expressão do pg_cron (UTC), com virada de dia quando passa da meia-noite UTC
create or replace function private.relatorio_cron_expr(p_hora time, p_dias smallint[])
returns text language plpgsql immutable set search_path = '' as $$
declare h int := extract(hour from p_hora)::int + 3; m int := extract(minute from p_hora)::int; desloc int := 0;
begin
  if h >= 24 then h := h - 24; desloc := 1; end if;
  return format('%s %s * * %s', m, h,
    (select string_agg(((d + desloc) % 7)::text, ',' order by (d + desloc) % 7) from unnest(p_dias) d));
end $$;

create or replace function private.relatorio_agendar(p_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.relatorios_automaticos; nome_job text := 'relatorio-' || p_id;
begin
  select * into r from public.relatorios_automaticos where id = p_id;
  perform cron.schedule(nome_job, private.relatorio_cron_expr(r.hora, r.dias_semana), format($c$
    SELECT net.http_post(
      url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/relatorios-automaticos',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_function_secret')),
      body := '{"relatorio":"%s","acao":"enviar"}'::jsonb,
      timeout_milliseconds := 120000);
  $c$, p_id));
  perform cron.alter_job((select jobid from cron.job where jobname = nome_job), active := r.ativo);
end $$;
revoke all on function private.relatorio_agendar(text) from public, anon, authenticated;

create or replace function public.relatorio_salvar(p_id text, p_dados jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare ator uuid := (select auth.uid()); emails text[]; e text;
begin
  if not private.has_role(ator, 'admin'::public.app_role) then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  if p_dados ? 'destinatarios' then
    select coalesce(array_agg(distinct lower(btrim(x))), '{}') into emails
    from jsonb_array_elements_text(p_dados->'destinatarios') x where btrim(x) <> '';
    foreach e in array emails loop
      if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido: %', e using errcode = '22023'; end if;
    end loop;
    if array_length(emails, 1) > 30 then raise exception 'Máximo de 30 destinatários' using errcode = '22023'; end if;
  end if;
  if p_dados ? 'dias_semana' and jsonb_array_length(p_dados->'dias_semana') = 0 then
    raise exception 'Escolha pelo menos um dia da semana' using errcode = '22023';
  end if;
  update public.relatorios_automaticos set
    ativo = coalesce((p_dados->>'ativo')::boolean, ativo),
    dias_semana = case when p_dados ? 'dias_semana' then array(select (x)::smallint from jsonb_array_elements_text(p_dados->'dias_semana') x where x::int between 0 and 6) else dias_semana end,
    hora = coalesce(nullif(p_dados->>'hora', '')::time, hora),
    destinatarios = coalesce(emails, destinatarios),
    enviar_email = coalesce((p_dados->>'enviar_email')::boolean, enviar_email),
    enviar_whatsapp = coalesce((p_dados->>'enviar_whatsapp')::boolean, enviar_whatsapp),
    whatsapp_destino = case when p_dados ? 'whatsapp_destino' then nullif(btrim(p_dados->>'whatsapp_destino'), '') else whatsapp_destino end,
    meta_visitas_dia = coalesce((p_dados->>'meta_visitas_dia')::int, meta_visitas_dia),
    fonte_dados = coalesce(p_dados->>'fonte_dados', fonte_dados),
    remetente = coalesce(nullif(btrim(p_dados->>'remetente'), ''), remetente),
    atualizado_em = now(), atualizado_por = ator
  where id = p_id;
  if not found then raise exception 'Relatório não encontrado' using errcode = 'P0002'; end if;
  perform private.relatorio_agendar(p_id);
end $$;
revoke all on function public.relatorio_salvar(text, jsonb) from public, anon;
grant execute on function public.relatorio_salvar(text, jsonb) to authenticated;

select private.relatorio_agendar('diario');
select private.relatorio_agendar('semanal');
