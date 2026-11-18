-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

do $$
declare d text;
begin
  d := pg_get_functiondef('private.f1_rating'::regproc);
  d := replace(d,
    'least((select count(*) from convertidas)::numeric / nullif((select count(*) from realizadas), 0), 1) as conv',
    '(select case when count(*) > 0 then least((select count(*) from convertidas)::numeric / count(*), 1) end from realizadas) as conv');
  d := replace(d, 'b.n_real >= cfg.min_visitas_historico', 'b.n_real >= greatest(cfg.min_visitas_historico, 1)');
  d := replace(d, '(b.n_real >= greatest(cfg.min_visitas_historico, 1)) as historico_proprio', '(b.n_real >= greatest(cfg.min_visitas_historico, 1)) as historico_proprio');
  if position('from convertidas)::numeric / count(*)' in d) = 0 or position('greatest(cfg.min_visitas_historico, 1)' in d) = 0 then
    raise exception 'Correção não aplicada';
  end if;
  execute d;
end $$;
;
