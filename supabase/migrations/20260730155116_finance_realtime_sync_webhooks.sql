-- Notifica o Financeiro de forma assíncrona após mudanças nas entidades
-- compartilhadas. URL e segredo ficam no Vault e não entram no repositório.
create or replace function public.notify_memude_finance_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  finance_url text;
  sync_secret text;
  entity_id uuid;
begin
  select decrypted_secret into finance_url
  from vault.decrypted_secrets
  where name = 'memude_finance_sync_url'
  limit 1;

  select decrypted_secret into sync_secret
  from vault.decrypted_secrets
  where name = 'memude_finance_sync_secret'
  limit 1;

  if finance_url is null or sync_secret is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  entity_id := case when tg_op = 'DELETE' then old.id else new.id end;

  perform net.http_post(
    url := finance_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-integration-secret', sync_secret
    ),
    body := jsonb_build_object(
      'event_id', gen_random_uuid(),
      'event_type', lower(tg_op),
      'entity_type', tg_table_name,
      'entity_id', entity_id,
      'occurred_at', now()
    ),
    timeout_milliseconds := 5000
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_memude_finance_sync() from public, anon, authenticated;

drop trigger if exists corretores_notify_memude_finance on public.corretores;
create trigger corretores_notify_memude_finance
after insert or update or delete on public.corretores
for each row execute function public.notify_memude_finance_sync();

drop trigger if exists empreendimentos_notify_memude_finance on public.empreendimentos;
create trigger empreendimentos_notify_memude_finance
after insert or update or delete on public.empreendimentos
for each row execute function public.notify_memude_finance_sync();

drop trigger if exists leads_notify_memude_finance on public.leads;
create trigger leads_notify_memude_finance
after insert or update or delete on public.leads
for each row execute function public.notify_memude_finance_sync();

drop trigger if exists vendas_notify_memude_finance on public.vendas;
create trigger vendas_notify_memude_finance
after insert or update or delete on public.vendas
for each row execute function public.notify_memude_finance_sync();
