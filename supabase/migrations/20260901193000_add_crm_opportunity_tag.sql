-- Etiqueta livre da oportunidade no funil de vendas (Lote 3, item 1).
-- Serve principalmente para marcar a safra da oportunidade (mês em que foi gerada),
-- mas é de preenchimento livre: origem, prioridade, condição de pagamento, pendências.
alter table public.crm_leads
    add column if not exists tag text;

comment on column public.crm_leads.tag is
    'Etiqueta livre da oportunidade, exibida no card do funil (ex.: "AGO/26", "Prioridade", "Aguardando doc").';

-- Limite de tamanho para a etiqueta não quebrar o layout do card do kanban.
do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.crm_leads'::regclass
          and conname = 'crm_leads_tag_length'
    ) then
        alter table public.crm_leads
            add constraint crm_leads_tag_length
            check (tag is null or char_length(tag) <= 40);
    end if;
end
$$;
