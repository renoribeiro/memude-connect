-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

create or replace function public.sheet_sync_ids(p_aba text)
returns table (registro_id uuid, linha jsonb)
language sql stable security definer set search_path = '' as $$
  select x.id, x.linha from (
    select l.id, private.sheet_linha_lead(l.id) as linha from public.leads l where p_aba = 'LEADS'
    union all
    select v.id, private.sheet_linha_visita(v.id) from public.visitas v where p_aba = 'VISITAS'
  ) x order by x.id;
$$;
revoke all on function public.sheet_sync_ids(text) from public, anon, authenticated;
grant execute on function public.sheet_sync_ids(text) to service_role;
;
