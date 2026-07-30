-- Envia alterações dos domínios comerciais ao MeMude Financeiro.
-- Os segredos são lidos do Vault e nunca ficam no schema ou no repositório:
--   memude_financeiro_webhook_url
--   memude_financeiro_webhook_secret
--
-- A chamada usa pg_net (assíncrona), portanto não bloqueia a transação do Core.
-- A reconciliação periódica do financeiro cobre indisponibilidade ou falha HTTP.

create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.notify_memude_financeiro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_url text;
  webhook_secret text;
  event_id uuid := extensions.gen_random_uuid();
  timestamp_value text := extract(epoch from clock_timestamp())::bigint::text;
  body_value text;
  signature_value text;
  record_value jsonb;
  old_record_value jsonb;
begin
  select decrypted_secret
    into webhook_url
    from vault.decrypted_secrets
   where name = 'memude_financeiro_webhook_url'
   limit 1;

  select decrypted_secret
    into webhook_secret
    from vault.decrypted_secrets
   where name = 'memude_financeiro_webhook_secret'
   limit 1;

  -- Permite aplicar a migração antes do deploy do financeiro.
  if nullif(webhook_url, '') is null or nullif(webhook_secret, '') is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  record_value := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  old_record_value := case when tg_op = 'INSERT' then null else to_jsonb(old) end;

  body_value := jsonb_build_object(
    'event_id', event_id,
    'event_type', tg_table_name || '.' || lower(tg_op) || '.v1',
    'schema_version', 1,
    'source', 'memude_core',
    'entity_type', tg_table_name,
    'entity_id', coalesce(record_value->>'id', old_record_value->>'id'),
    'occurred_at', clock_timestamp(),
    'record', record_value,
    'old_record', old_record_value
  )::text;

  signature_value := encode(
    extensions.hmac(
      convert_to(timestamp_value || '.' || body_value, 'utf8'),
      convert_to(webhook_secret, 'utf8'),
      'sha256'
    ),
    'hex'
  );

  perform net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-memude-timestamp', timestamp_value,
      'x-memude-signature', 'sha256=' || signature_value
    ),
    body := body_value::jsonb,
    timeout_milliseconds := 5000
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
exception
  when others then
    -- Integração não deve interromper a operação comercial. O sync periódico
    -- reconciliará o registro; o erro fica disponível nos logs do Postgres.
    raise warning 'Falha ao notificar MeMude Financeiro (%): %', tg_table_name, sqlerrm;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

revoke all on function private.notify_memude_financeiro()
  from public, anon, authenticated;

drop trigger if exists corretores_notify_memude_financeiro on public.corretores;
create trigger corretores_notify_memude_financeiro
  after insert or update or delete on public.corretores
  for each row execute function private.notify_memude_financeiro();

drop trigger if exists empreendimentos_notify_memude_financeiro on public.empreendimentos;
create trigger empreendimentos_notify_memude_financeiro
  after insert or update or delete on public.empreendimentos
  for each row execute function private.notify_memude_financeiro();

drop trigger if exists leads_notify_memude_financeiro on public.leads;
create trigger leads_notify_memude_financeiro
  after insert or update or delete on public.leads
  for each row execute function private.notify_memude_financeiro();

drop trigger if exists vendas_notify_memude_financeiro on public.vendas;
create trigger vendas_notify_memude_financeiro
  after insert or update or delete on public.vendas
  for each row execute function private.notify_memude_financeiro();
