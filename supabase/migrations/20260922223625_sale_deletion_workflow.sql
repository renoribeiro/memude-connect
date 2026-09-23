-- Exclusao de vendas coordenada entre o Core e o Financeiro.
-- A venda do Core e removida na mesma transacao que cria o registro duravel
-- de entrega. O espelho financeiro e apagado de forma assincrona e idempotente.

create table public.sale_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null,
  delete_from_finance boolean not null default false,
  state text not null default 'pending'
    check (state in ('pending', 'processing', 'completed', 'failed')),
  venda_snapshot jsonb not null,
  created_by uuid not null references auth.users(id),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  next_retry_at timestamptz,
  leased_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (venda_id)
);

create index sale_deletion_requests_delivery_idx
  on public.sale_deletion_requests(state, next_retry_at, created_at)
  where delete_from_finance and state in ('pending', 'processing', 'failed');

alter table public.sale_deletion_requests enable row level security;

create policy sale_deletion_requests_admin_select
  on public.sale_deletion_requests
  for select to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role));

revoke all on table public.sale_deletion_requests from public, anon, authenticated;
grant select on table public.sale_deletion_requests to authenticated;
grant all on table public.sale_deletion_requests to service_role;

create or replace function public.request_sale_deletion(
  _venda_id uuid,
  _delete_from_finance boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  snapshot_value jsonb;
  request_value public.sale_deletion_requests;
begin
  if actor_id is null or not private.has_role(actor_id, 'admin'::public.app_role) then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;

  select to_jsonb(v)
    into snapshot_value
    from public.vendas v
   where v.id = _venda_id
   for update;

  if snapshot_value is null then
    raise exception 'Venda nao encontrada' using errcode = 'P0002';
  end if;

  insert into public.sale_deletion_requests (
    venda_id,
    delete_from_finance,
    state,
    venda_snapshot,
    created_by,
    completed_at
  )
  values (
    _venda_id,
    coalesce(_delete_from_finance, false),
    case when coalesce(_delete_from_finance, false) then 'pending' else 'completed' end,
    snapshot_value,
    actor_id,
    case when coalesce(_delete_from_finance, false) then null else now() end
  )
  returning * into request_value;

  delete from public.vendas where id = _venda_id;

  return jsonb_build_object(
    'request_id', request_value.id,
    'venda_id', request_value.venda_id,
    'delete_from_finance', request_value.delete_from_finance,
    'state', request_value.state
  );
end;
$$;

revoke all on function public.request_sale_deletion(uuid, boolean) from public, anon;
grant execute on function public.request_sale_deletion(uuid, boolean) to authenticated;
revoke delete on table public.vendas from anon, authenticated;

create or replace function public.claim_sale_deletion_requests(
  _request_id uuid default null,
  _limit integer default 10
)
returns setof public.sale_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Acesso restrito ao servico interno' using errcode = '42501';
  end if;

  return query
  with candidates as (
    select r.id
      from public.sale_deletion_requests r
     where r.delete_from_finance
       and (_request_id is null or r.id = _request_id)
       and r.attempts < 10
       and (
         r.state = 'pending'
         or (r.state = 'failed' and coalesce(r.next_retry_at, now()) <= now())
         or (r.state = 'processing' and coalesce(r.leased_until, '-infinity'::timestamptz) <= now())
       )
     order by r.created_at
     limit greatest(1, least(coalesce(_limit, 10), 50))
     for update skip locked
  )
  update public.sale_deletion_requests r
     set state = 'processing',
         attempts = r.attempts + 1,
         leased_until = now() + interval '2 minutes',
         updated_at = now(),
         last_error = null
    from candidates c
   where r.id = c.id
  returning r.*;
end;
$$;

revoke all on function public.claim_sale_deletion_requests(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_sale_deletion_requests(uuid, integer) to service_role;

create or replace function public.finish_sale_deletion_request(
  _request_id uuid,
  _success boolean,
  _error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Acesso restrito ao servico interno' using errcode = '42501';
  end if;

  update public.sale_deletion_requests
     set state = case when _success then 'completed' else 'failed' end,
         last_error = case when _success then null else left(coalesce(_error, 'Falha desconhecida'), 1000) end,
         next_retry_at = case
           when _success or attempts >= 10 then null
           else now() + make_interval(mins => least(60, (power(2, greatest(attempts - 1, 0)))::integer))
         end,
         leased_until = null,
         completed_at = case when _success then now() else null end,
         updated_at = now()
   where id = _request_id;
end;
$$;

revoke all on function public.finish_sale_deletion_request(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.finish_sale_deletion_request(uuid, boolean, text) to service_role;

create or replace function public.get_finance_webhook_config()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_url text;
  webhook_secret text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Acesso restrito ao servico interno' using errcode = '42501';
  end if;

  select decrypted_secret into webhook_url
    from vault.decrypted_secrets
   where name = 'memude_financeiro_webhook_url'
   limit 1;

  select decrypted_secret into webhook_secret
    from vault.decrypted_secrets
   where name = 'memude_financeiro_webhook_secret'
   limit 1;

  if nullif(webhook_url, '') is null or nullif(webhook_secret, '') is null then
    raise exception 'Integracao com o Financeiro nao configurada';
  end if;

  return jsonb_build_object('url', webhook_url, 'secret', webhook_secret);
end;
$$;

revoke all on function public.get_finance_webhook_config() from public, anon, authenticated;
grant execute on function public.get_finance_webhook_config() to service_role;

-- Remove o emissor legado duplicado. O emissor HMAC atual continua atendendo
-- insercoes e alteracoes; exclusoes passam exclusivamente pela fila acima.
drop trigger if exists corretores_notify_memude_finance on public.corretores;
drop trigger if exists empreendimentos_notify_memude_finance on public.empreendimentos;
drop trigger if exists leads_notify_memude_finance on public.leads;
drop trigger if exists vendas_notify_memude_finance on public.vendas;

drop trigger if exists vendas_notify_memude_financeiro on public.vendas;
create trigger vendas_notify_memude_financeiro
  after insert or update on public.vendas
  for each row execute function private.notify_memude_financeiro();

do $$
declare
  command_text text;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'memude-sale-deletion-worker') then
      perform cron.unschedule('memude-sale-deletion-worker');
    end if;

    select command into command_text
      from cron.job
     where jobname = 'memude-monitor-visits'
     limit 1;

    if command_text is not null and position('/functions/v1/monitor-visits' in command_text) > 0 then
      perform cron.schedule(
        'memude-sale-deletion-worker',
        '*/5 * * * *',
        replace(command_text, '/functions/v1/monitor-visits', '/functions/v1/delete-sale')
      );
    end if;
  end if;
end;
$$;
