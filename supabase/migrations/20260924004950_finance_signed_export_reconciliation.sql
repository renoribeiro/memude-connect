-- Reconcile independently of the app container and recover missed realtime events.
create or replace function private.request_finance_reconciliation() returns bigint
language plpgsql security definer set search_path='' as $$
declare config jsonb; stamp text; body jsonb; signature text; request_id bigint;
begin
  config := public.get_finance_webhook_config();
  if nullif(config->>'secret','') is null then raise exception 'Finance credential missing'; end if;
  stamp := floor(extract(epoch from clock_timestamp()))::bigint::text;
  body := jsonb_build_object('event_id',gen_random_uuid(),'source','memude_core','event_type','reconciliation');
  signature := encode(extensions.hmac(convert_to(stamp||'.'||body::text,'utf8'),convert_to(config->>'secret','utf8'),'sha256'),'hex');
  select net.http_post(
    url := 'https://syeidxevgupqziwirwdz.supabase.co/functions/v1/core-sync',
    headers := jsonb_build_object('content-type','application/json','x-memude-timestamp',stamp,'x-memude-signature','sha256='||signature),
    body := body, timeout_milliseconds := 120000
  ) into request_id;
  return request_id;
end $$;
revoke all on function private.request_finance_reconciliation() from public,anon,authenticated;
grant execute on function private.request_finance_reconciliation() to service_role;
select cron.schedule('memude-finance-reconciliation','*/5 * * * *','select private.request_finance_reconciliation()');
