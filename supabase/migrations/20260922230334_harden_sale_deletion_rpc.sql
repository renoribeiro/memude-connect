-- A Edge Function valida o JWT e o papel de administrador. O RPC mutante fica
-- invisivel aos clientes e aceita apenas o ator ja autenticado pelo backend.

create or replace function public.request_sale_deletion(
  _venda_id uuid,
  _delete_from_finance boolean,
  _actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_value jsonb;
  request_value public.sale_deletion_requests;
begin
  if _actor_id is null or not private.has_role(_actor_id, 'admin'::public.app_role) then
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
    _actor_id,
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

revoke all on function public.request_sale_deletion(uuid, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.request_sale_deletion(uuid, boolean, uuid)
  to service_role;

drop function public.request_sale_deletion(uuid, boolean);
