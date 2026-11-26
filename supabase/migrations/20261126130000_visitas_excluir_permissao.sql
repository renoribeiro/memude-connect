-- Excluir/restaurar visita falhava para todos com "permission denied for schema private":
-- as funções rodavam com o papel de quem chama (authenticated), que não acessa o schema private
-- usado por public.has_role. Passam a SECURITY DEFINER com checagem explícita de quem pode.
-- Excluir e restaurar: equipe comercial (admin, SDR, closer) ou o corretor da visita.
-- Excluir permanentemente: só admin.

create or replace function public.soft_delete_visita(visita_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  _actor uuid := auth.uid();
begin
  if _actor is null then
    raise exception using errcode = '42501', message = 'Autenticação obrigatória';
  end if;
  if not (private.is_comercial() or exists (
    select 1 from public.visitas v
      join public.corretores c on c.id = v.corretor_id
      join public.profiles p on p.id = c.profile_id
     where v.id = soft_delete_visita.visita_id and p.user_id = _actor)) then
    raise exception using errcode = '42501', message = 'Sem permissão para excluir esta visita';
  end if;

  update public.visitas v set deleted_at = now(), updated_at = now()
   where v.id = soft_delete_visita.visita_id and v.deleted_at is null;

  update public.leads l set status = 'cancelado', updated_at = now()
   where l.id = (select v.lead_id from public.visitas v where v.id = soft_delete_visita.visita_id)
     and l.status = 'visita_agendada';
end $$;

create or replace function public.restore_visita(visita_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  _actor uuid := auth.uid();
begin
  if _actor is null then
    raise exception using errcode = '42501', message = 'Autenticação obrigatória';
  end if;
  if not (private.is_comercial() or exists (
    select 1 from public.visitas v
      join public.corretores c on c.id = v.corretor_id
      join public.profiles p on p.id = c.profile_id
     where v.id = restore_visita.visita_id and p.user_id = _actor)) then
    raise exception using errcode = '42501', message = 'Sem permissão para restaurar esta visita';
  end if;

  update public.visitas v set deleted_at = null, updated_at = now()
   where v.id = restore_visita.visita_id and v.deleted_at is not null;

  update public.leads l set status = 'visita_agendada', updated_at = now()
   where l.id = (select v.lead_id from public.visitas v where v.id = restore_visita.visita_id)
     and l.status = 'cancelado';
end $$;

create or replace function public.hard_delete_visita(visita_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if auth.uid() is null or not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception using errcode = '42501', message = 'A exclusão permanente é restrita a administradores';
  end if;
  delete from public.visit_distribution_attempts a where a.visita_id = hard_delete_visita.visita_id;
  delete from public.visit_distribution_queue q where q.visita_id = hard_delete_visita.visita_id;
  delete from public.visitas v where v.id = hard_delete_visita.visita_id;
end $$;

revoke all on function public.soft_delete_visita(uuid), public.restore_visita(uuid), public.hard_delete_visita(uuid) from public, anon;
grant execute on function public.soft_delete_visita(uuid), public.restore_visita(uuid), public.hard_delete_visita(uuid) to authenticated;
