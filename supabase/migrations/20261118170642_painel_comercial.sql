-- Painel comercial do Dashboard (e do modo apresentação): KPIs, funil, origem dos leads e entrada diária.
-- Qualificado = lead do período com status "em conversa" ou mais quente, ou que já teve visita.

create or replace function private.painel_numeros(p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = '' as $$
  with l as (
    select ld.id, coalesce(nullif(ld.fonte, ''), 'Outros') as fonte,
      private.f1_norm(coalesce(ld.planilha_extra->>'status_label', ld.status_atendimento)) as st
    from public.leads ld
    where ld.deleted_at is null and ld.data_entrada between p_de and p_ate
  ), v as (
    select vi.id, vi.lead_id, vi.status from public.visitas vi
    where vi.deleted_at is null and vi.data_visita between p_de and p_ate
  ), s as (
    select ve.valor_imovel, ve.valor_memude, ve.valor_comissao_liquida from public.vendas ve
    where ve.data_venda between p_de and p_ate and ve.status::text <> 'cancelada'
  )
  select jsonb_build_object(
    'leads', (select count(*) from l),
    'qualificados', (select count(*) from l where l.st in ('em conversa', 'interessado', 'visita agendada', 'documentacao',
        'doc aprovada', 'negociacao', 'ja comprou', 'vendido', 'vendido!')
        or exists (select 1 from public.visitas x where x.lead_id = l.id and x.deleted_at is null)),
    'visitas_agendadas', (select count(*) from v),
    'visitas_realizadas', (select count(*) from v where v.status = 'realizada'),
    'visitas_no_show', (select count(*) from v where v.status = 'no_show'),
    'visitas_canceladas', (select count(*) from v where v.status = 'cancelada'),
    'visitas_futuras', (select count(*) from v where v.status in ('aguardando_corretor', 'agendada', 'confirmada')),
    'vendas', (select count(*) from s),
    'vgv', (select coalesce(sum(valor_imovel), 0) from s),
    'ticket_medio', (select coalesce(avg(valor_imovel), 0) from s),
    'comissao_memude', (select coalesce(sum(valor_memude), 0) from s),
    'comissao_liquida', (select coalesce(sum(valor_comissao_liquida), 0) from s)
  );
$$;
revoke all on function private.painel_numeros(date, date) from public, anon, authenticated;

create or replace function public.painel_comercial(p_de date, p_ate date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare dias int := (p_ate - p_de) + 1;
begin
  if not private.is_comercial() then raise exception 'Acesso restrito à equipe comercial' using errcode = '42501'; end if;
  if p_de is null or p_ate is null or p_ate < p_de or dias > 400 then
    raise exception 'Período inválido' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'de', p_de, 'ate', p_ate,
    'atual', private.painel_numeros(p_de, p_ate),
    'anterior', private.painel_numeros(p_de - dias, p_de - 1),
    'origem', (select coalesce(jsonb_agg(jsonb_build_object('fonte', fonte, 'total', n) order by n desc), '[]'::jsonb) from (
      select coalesce(nullif(fonte, ''), 'Outros') as fonte, count(*) n from public.leads
      where deleted_at is null and data_entrada between p_de and p_ate group by 1) o),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d::date, 'leads', coalesce(n, 0)) order by d), '[]'::jsonb)
      from generate_series(p_de, p_ate, interval '1 day') d
      left join (select data_entrada, count(*) n from public.leads where deleted_at is null
                 and data_entrada between p_de and p_ate group by 1) c on c.data_entrada = d::date)
  );
end $$;
revoke all on function public.painel_comercial(date, date) from public, anon;
grant execute on function public.painel_comercial(date, date) to authenticated;
