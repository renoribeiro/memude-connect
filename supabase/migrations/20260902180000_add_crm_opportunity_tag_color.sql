-- Cor da etiqueta da oportunidade, escolhida entre as opções do funil.
-- Complementa crm_leads.tag: a cor só aparece no card quando existe tag.
alter table public.crm_leads
    add column if not exists tag_cor text;

comment on column public.crm_leads.tag_cor is
    'Cor da etiqueta da oportunidade em hexadecimal (ex.: "#1d4ed8"). Nulo = etiqueta neutra, no cinza padrão do card.';

-- Valida o formato sem congelar a paleta: a lista de cores fica no frontend.
do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.crm_leads'::regclass
          and conname = 'crm_leads_tag_cor_format'
    ) then
        alter table public.crm_leads
            add constraint crm_leads_tag_cor_format
            check (tag_cor is null or tag_cor ~ '^#[0-9a-fA-F]{6}$');
    end if;
end
$$;
