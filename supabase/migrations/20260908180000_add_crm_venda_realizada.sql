-- Marca de venda realizada na oportunidade do funil.
-- O funil é organizado por mês (Janeiro, Fevereiro...), então mover o card para
-- uma etapa "Venda Realizada" faria perder a safra. A marca resolve isso: o card
-- continua no mês em que a negociação nasceu e ganha o sinal de vendido.
alter table public.crm_leads
    add column if not exists venda_realizada boolean not null default false;

alter table public.crm_leads
    add column if not exists venda_realizada_em timestamptz;

comment on column public.crm_leads.venda_realizada is
    'Oportunidade fechada como venda. Alimenta o card "Vendas Realizadas" do topo do CRM.';

comment on column public.crm_leads.venda_realizada_em is
    'Quando a venda foi marcada. Nulo enquanto a oportunidade não estiver vendida.';

-- Soma de vendas por funil é feita filtrando por esta coluna; o índice parcial
-- mantém a conta barata conforme o funil cresce.
create index if not exists crm_leads_venda_realizada_idx
    on public.crm_leads (pipeline_id)
    where venda_realizada;
