-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

do $$
declare t text;
begin
  foreach t in array array['crm_leads','crm_stages','crm_pipelines'] loop
    execute format('drop policy if exists "Equipe comercial lê %1$s" on public.%1$I', t);
    execute format('create policy "Equipe comercial lê %1$s" on public.%1$I for select to authenticated using ((select private.is_comercial()))', t);
  end loop;
end $$;

-- Vincula leads importados ao responsável quando a conta dele existir (ex.: "Emilly" na planilha)
create or replace function public.leads_vincular_responsavel_importado(p_nome_planilha text, p_user uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not private.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  if not exists (select 1 from public.user_roles where user_id = p_user and role in ('admin','sdr','closer')) then
    raise exception 'O usuário precisa ter papel de admin, SDR ou closer' using errcode = '22023';
  end if;
  perform set_config('memude.fase1', '1', true);
  update public.leads set responsavel_id = p_user,
    planilha_extra = nullif(planilha_extra - 'responsavel', '{}'::jsonb)
  where responsavel_id is null and private.f1_norm(planilha_extra->>'responsavel') = private.f1_norm(p_nome_planilha);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.leads_vincular_responsavel_importado(text, uuid) from public, anon;
grant execute on function public.leads_vincular_responsavel_importado(text, uuid) to authenticated;

create or replace function public.leads_responsaveis_pendentes()
returns table (nome text, quantidade bigint)
language sql stable security definer set search_path = '' as $$
  select planilha_extra->>'responsavel', count(*) from public.leads
  where responsavel_id is null and coalesce(planilha_extra->>'responsavel', '') <> ''
    and (select private.is_comercial())
  group by 1 order by 2 desc;
$$;
revoke all on function public.leads_responsaveis_pendentes() from public, anon;
grant execute on function public.leads_responsaveis_pendentes() to authenticated;
;
