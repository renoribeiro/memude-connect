-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

create or replace function public.fase1_robo_definir(p_ativo boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ator uuid := (select auth.uid());
begin
  if not private.has_role(ator, 'admin'::public.app_role) then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  update public.visit_automation_config set enabled = p_ativo, intake_enabled = p_ativo, updated_at = now() where id;
  insert into public.audit_logs (user_id, action, table_name, record_id, new_values)
  select ator, case when p_ativo then 'robo_visitas_religado' else 'robo_visitas_standby' end, 'visit_automation_config', null,
    jsonb_build_object('enabled', p_ativo)
  where to_regclass('public.audit_logs') is not null;
  return jsonb_build_object('ativo', p_ativo);
exception when undefined_column or not_null_violation or invalid_text_representation then
  update public.visit_automation_config set enabled = p_ativo, intake_enabled = p_ativo, updated_at = now() where id;
  return jsonb_build_object('ativo', p_ativo);
end $$;
revoke all on function public.fase1_robo_definir(boolean) from public, anon;
grant execute on function public.fase1_robo_definir(boolean) to authenticated;

create or replace function public.import_conflito_resolver(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  update public.import_conflitos set resolvido = true where id = p_id;
end $$;
revoke all on function public.import_conflito_resolver(uuid) from public, anon;
grant execute on function public.import_conflito_resolver(uuid) to authenticated;
;
