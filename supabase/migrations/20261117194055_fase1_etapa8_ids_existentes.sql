-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

create or replace function public.sheet_ids_existentes(p_aba text, p_ids text[])
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(x), '{}') from unnest(p_ids) x
  where x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and case when p_aba = 'LEADS' then exists (select 1 from public.leads l where l.id = x::uuid)
             else exists (select 1 from public.visitas v where v.id = x::uuid) end;
$$;
revoke all on function public.sheet_ids_existentes(text, text[]) from public, anon, authenticated;
grant execute on function public.sheet_ids_existentes(text, text[]) to service_role;
;
