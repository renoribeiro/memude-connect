-- MeMude Conversas — 2ª revisão
-- 1) Aceite do corretor: a conversa existente volta da pasta arquivada e vai para ele
create or replace function private.conv_dono_por_convite()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v public.visitas; uid uuid; c record;
begin
  if NEW.resposta is distinct from 'aceitou' or OLD.resposta is not distinct from 'aceitou' then return NEW; end if;
  select * into v from public.visitas where id = NEW.visita_id;
  select p.user_id into uid from public.corretores co join public.profiles p on p.id = co.profile_id where co.id = NEW.corretor_id;
  if v.lead_id is null or uid is null then return NEW; end if;
  for c in select id from public.conversas where lead_id = v.lead_id loop
    perform private.conv_trocar_dono(c.id, uid, 'corretor', 'Corretor aceitou a visita', auth.uid());
    update public.conversas set arquivada = false,
      etapa = case when etapa in ('novo', 'em_atendimento') then 'visita_marcada' else etapa end
    where id = c.id;
  end loop;
  return NEW;
end $$;

-- 2) Corretor que inicia a conversa com cliente da própria visita já começa em "Visita marcada"
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.conversa_iniciar(uuid,uuid)'::regprocedure);
  if position('etapa_inicial' in src) = 0 then
    src := replace(src, $a$    'em_atendimento', now())$a$,
      $a$    case when not equipe then 'visita_marcada' else 'em_atendimento' end /* etapa_inicial */, now())$a$);
    if position('etapa_inicial' in src) = 0 then raise exception 'Ajuste de conversa_iniciar não aplicado'; end if;
    execute src;
  end if;
end $do$;

-- 3) Ao iniciar, reaproveita a conversa do mesmo lead mesmo se o telefone do lead mudou
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.conversa_iniciar(uuid,uuid)'::regprocedure);
  if position('por_lead_ou_telefone' in src) = 0 then
    src := replace(src, $a$from public.conversas c where c.telefone_chave = l.telefone_chave$a$,
      $a$from public.conversas c where (c.lead_id = l.id or c.telefone_chave = l.telefone_chave) /* por_lead_ou_telefone */$a$);
    if position('por_lead_ou_telefone' in src) = 0 then raise exception 'Ajuste de conversa_iniciar não aplicado'; end if;
    execute src;
  end if;
end $do$;
