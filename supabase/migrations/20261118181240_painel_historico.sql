-- Comparativo mês a mês para o pop-up dos campos do Dashboard (últimos 3, 6 ou 12 meses até o mês informado).
create or replace function public.painel_historico(p_ate date, p_meses int default 6)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare fim date := (date_trunc('month', p_ate) + interval '1 month - 1 day')::date;
begin
  if not private.is_comercial() then raise exception 'Acesso restrito à equipe comercial' using errcode = '42501'; end if;
  if p_meses is null or p_meses < 1 or p_meses > 12 then raise exception 'Escolha de 1 a 12 meses' using errcode = '22023'; end if;
  return (
    select jsonb_agg(jsonb_build_object(
      'mes', to_char(m.ini, 'YYYY-MM'),
      'numeros', private.painel_numeros(m.ini, m.fim),
      'origem', (select coalesce(jsonb_object_agg(fonte, n), '{}'::jsonb) from (
        select coalesce(nullif(fonte, ''), 'Outros') as fonte, count(*) n from public.leads
        where deleted_at is null and data_entrada between m.ini and m.fim group by 1) o)
    ) order by m.ini)
    from (
      select g::date as ini, (g + interval '1 month - 1 day')::date as fim
      from generate_series(date_trunc('month', fim) - make_interval(months => p_meses - 1), date_trunc('month', fim), interval '1 month') g
    ) m
  );
end $$;
revoke all on function public.painel_historico(date, int) from public, anon;
grant execute on function public.painel_historico(date, int) to authenticated;
