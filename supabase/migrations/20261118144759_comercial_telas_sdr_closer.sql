-- SDR e closer usam as mesmas telas operacionais do admin (menus SDR e Closer).
-- Continuam só para admin: excluir vendas (via solicitação), configurar funis/automações, empreendimentos,
-- usuários, relatórios e configurações. Políticas apenas aditivas; nada é removido.

-- Vendas: ver, lançar e editar
drop policy if exists "Equipe comercial vê vendas" on public.vendas;
create policy "Equipe comercial vê vendas" on public.vendas for select to authenticated
  using ((select private.is_comercial()));
drop policy if exists "Equipe comercial lança vendas" on public.vendas;
create policy "Equipe comercial lança vendas" on public.vendas for insert to authenticated
  with check ((select private.is_comercial()));
drop policy if exists "Equipe comercial edita vendas" on public.vendas;
create policy "Equipe comercial edita vendas" on public.vendas for update to authenticated
  using ((select private.is_comercial())) with check ((select private.is_comercial()));

-- Visitas: criar e editar (leitura já existia)
drop policy if exists "Equipe comercial cria visitas" on public.visitas;
create policy "Equipe comercial cria visitas" on public.visitas for insert to authenticated
  with check ((select private.is_comercial()));
drop policy if exists "Equipe comercial edita visitas" on public.visitas;
create policy "Equipe comercial edita visitas" on public.visitas for update to authenticated
  using ((select private.is_comercial())) with check ((select private.is_comercial()));

-- CRM: mover, criar e tirar cards do funil (leitura já existia)
drop policy if exists "Equipe comercial cria cards do CRM" on public.crm_leads;
create policy "Equipe comercial cria cards do CRM" on public.crm_leads for insert to authenticated
  with check ((select private.is_comercial()));
drop policy if exists "Equipe comercial move cards do CRM" on public.crm_leads;
create policy "Equipe comercial move cards do CRM" on public.crm_leads for update to authenticated
  using ((select private.is_comercial())) with check ((select private.is_comercial()));
drop policy if exists "Equipe comercial tira cards do CRM" on public.crm_leads;
create policy "Equipe comercial tira cards do CRM" on public.crm_leads for delete to authenticated
  using ((select private.is_comercial()));
drop policy if exists "Equipe comercial lê automações do CRM" on public.crm_automations;
create policy "Equipe comercial lê automações do CRM" on public.crm_automations for select to authenticated
  using ((select private.is_comercial()));

-- Corretores: editar dados e status (leitura já existia)
drop policy if exists "Equipe comercial edita corretores" on public.corretores;
create policy "Equipe comercial edita corretores" on public.corretores for update to authenticated
  using ((select private.is_comercial())) with check ((select private.is_comercial()));
