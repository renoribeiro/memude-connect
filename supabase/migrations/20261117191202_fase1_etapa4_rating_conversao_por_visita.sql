-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

do $$
declare d text;
begin
  d := pg_get_functiondef('private.f1_rating'::regproc);
  d := replace(d,
    'select v.corretor_id as cid, v.empreendimento_id as eid, v.avaliacao_lead as nota_cliente',
    'select v.corretor_id as cid, v.empreendimento_id as eid, v.avaliacao_lead as nota_cliente, v.lead_id as lid');
  d := replace(d,
    'select s.corretor_id as cid, s.empreendimento_id as eid, s.valor_imovel',
    'select s.corretor_id as cid, s.empreendimento_id as eid, s.valor_imovel, s.lead_id as lid');
  d := replace(d,
    '  respostas as (',
    '  convertidas as (
    select distinct s.cid, s.lid from vendas_ok s
    where exists (select 1 from realizadas r where r.cid = s.cid and r.lid = s.lid)
  ),
  respostas as (');
  d := replace(d,
    'least((select count(*) from vendas_ok)::numeric / nullif((select count(*) from realizadas), 0), 1) as conv',
    'least((select count(*) from convertidas)::numeric / nullif((select count(*) from realizadas), 0), 1) as conv');
  d := replace(d,
    '(select count(*) from vendas_ok s where s.cid = c.id)::int as n_vendas,',
    '(select count(*) from vendas_ok s where s.cid = c.id)::int as n_vendas,
      (select count(*) from convertidas s where s.cid = c.id)::int as n_conv,');
  d := replace(d,
    'then least(b.n_vendas::numeric / b.n_real, 1) * 100 else g.conv * 100 end as v_conv',
    'then least(b.n_conv::numeric / b.n_real, 1) * 100 else g.conv * 100 end as v_conv');
  d := replace(d,
    'case when p.historico_proprio and p.n_vendas > 0
        then format(''Conversão %s%% (%s de %s visitas)'', private.f1_num(p.v_conv), p.n_vendas, p.n_real) end,',
    'case when p.historico_proprio and p.n_conv > 0
        then format(''Conversão %s%% (%s de %s visitas)'', private.f1_num(p.v_conv), p.n_conv, p.n_real) end,');
  if position('n_conv' in d) = 0 or position('convertidas' in d) = 0 or position('p.n_conv > 0' in d) = 0 then
    raise exception 'Ajuste de conversão não aplicado';
  end if;
  execute d;
end $$;
;
