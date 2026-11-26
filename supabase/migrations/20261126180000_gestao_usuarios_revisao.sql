-- Gestão de Usuários: mensagens claras antes de criar/excluir (só as funções create-user e manage-user chamam, com a chave de serviço).

-- Quem já usa este e-mail (nome para mostrar ao admin)
create or replace function public.usuario_por_email(p_email text)
returns text language sql stable security definer set search_path to '' as $$
  select coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), 'outro usuário')
  from auth.users u left join public.profiles p on p.user_id = u.id
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

-- Corretor que já usa este CRECI
create or replace function public.usuario_creci_em_uso(p_creci text)
returns text language sql stable security definer set search_path to '' as $$
  select coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), 'outro corretor')
  from public.corretores c left join public.profiles p on p.id = c.profile_id
  where upper(trim(c.creci)) = upper(trim(p_creci))
  limit 1;
$$;

-- O que se perderia ao excluir: com histórico, a conta só pode ser desativada
create or replace function public.usuario_historico(p_user uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  with alvo as (
    select p.id as perfil, c.id as corretor
    from public.profiles p left join public.corretores c on c.profile_id = p.id
    where p.user_id = p_user
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'visitas', nullif((select count(*) from public.visitas v, alvo where v.corretor_id = alvo.corretor), 0),
    'vendas', nullif((select count(*) from public.vendas s, alvo where s.corretor_id = alvo.corretor or s.created_by = alvo.perfil), 0),
    'convites', nullif((select count(*) from public.visita_convites x, alvo where x.corretor_id = alvo.corretor), 0),
    'leads', nullif((select count(*) from public.leads l where l.responsavel_id = p_user and l.deleted_at is null), 0),
    'conversas', nullif((select count(*) from public.conversas cv where cv.dono_id = p_user), 0)
  ));
$$;

revoke all on function public.usuario_por_email(text) from public, anon, authenticated;
revoke all on function public.usuario_creci_em_uso(text) from public, anon, authenticated;
revoke all on function public.usuario_historico(uuid) from public, anon, authenticated;
grant execute on function public.usuario_por_email(text) to service_role;
grant execute on function public.usuario_creci_em_uso(text) to service_role;
grant execute on function public.usuario_historico(uuid) to service_role;
