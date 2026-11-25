-- MeMude Conversas — 3ª revisão
-- 1) Corretor só inicia conversa com cliente de visita que ele aceitou (não durante o convite)
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.conversa_iniciar(uuid,uuid)'::regprocedure);
  if position('so_visita_aceita' in src) = 0 then
    src := replace(src, $a$v.corretor_id = cid and v.deleted_at is null)$a$,
      $a$v.corretor_id = cid and v.deleted_at is null and v.status in ('agendada', 'confirmada', 'realizada') /* so_visita_aceita */)$a$);
    if position('so_visita_aceita' in src) = 0 then raise exception 'Ajuste de conversa_iniciar não aplicado'; end if;
    execute src;
  end if;
end $do$;

-- 2) Aceite também leva a conversa do mesmo telefone que ainda não tinha lead ligado (e liga)
create or replace function private.conv_dono_por_convite()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v public.visitas; uid uuid; c record; chave text;
begin
  if NEW.resposta is distinct from 'aceitou' or OLD.resposta is not distinct from 'aceitou' then return NEW; end if;
  select * into v from public.visitas where id = NEW.visita_id;
  select p.user_id into uid from public.corretores co join public.profiles p on p.id = co.profile_id where co.id = NEW.corretor_id;
  if v.lead_id is null or uid is null then return NEW; end if;
  select telefone_chave into chave from public.leads where id = v.lead_id;
  for c in select id from public.conversas
           where lead_id = v.lead_id or (lead_id is null and chave is not null and telefone_chave = chave) loop
    perform private.conv_trocar_dono(c.id, uid, 'corretor', 'Corretor aceitou a visita', auth.uid());
    update public.conversas set arquivada = false, lead_id = coalesce(lead_id, v.lead_id),
      etapa = case when etapa in ('novo', 'em_atendimento') then 'visita_marcada' else etapa end
    where id = c.id;
  end loop;
  return NEW;
end $$;
