-- Usuário desativado em Gestão de Usuários deixa de ser corretor ativo: some das sugestões de visita e do chamado automático.
-- Reativar volta o corretor de "inativo" para "ativo" (bloqueado/em avaliação não mudam). Nada é apagado.
create or replace function private.corretor_status_por_perfil()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if NEW.is_active is distinct from OLD.is_active then
    if coalesce(NEW.is_active, true) then
      update public.corretores c set status = 'ativo'::public.corretor_status, updated_at = now()
       where c.profile_id = NEW.id and c.deleted_at is null and c.status = 'inativo'::public.corretor_status;
    else
      update public.corretores c set status = 'inativo'::public.corretor_status, updated_at = now()
       where c.profile_id = NEW.id and c.deleted_at is null and c.status in ('ativo'::public.corretor_status, 'em_avaliacao'::public.corretor_status);
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists corretor_status_por_perfil on public.profiles;
create trigger corretor_status_por_perfil after update of is_active on public.profiles
  for each row execute function private.corretor_status_por_perfil();

-- Quem já está desativado hoje
update public.corretores c set status = 'inativo'::public.corretor_status, updated_at = now()
  from public.profiles p
 where p.id = c.profile_id and p.is_active = false and c.status = 'ativo'::public.corretor_status and c.deleted_at is null;
