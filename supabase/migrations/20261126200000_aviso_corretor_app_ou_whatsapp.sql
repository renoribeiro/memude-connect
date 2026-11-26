-- Como avisar o corretor de uma visita: pelo app (chamado; o aceite entra sozinho) ou pelo WhatsApp
-- (a SDR manda a mensagem pronta e registra no Connect se ele aceitou). Vale para todos os convites da visita.

alter table public.visit_cycles add column if not exists aviso_corretor text not null default 'app'
  check (aviso_corretor in ('app', 'whatsapp'));
alter table public.visita_convites add column if not exists canal text not null default 'app'
  check (canal in ('app', 'whatsapp'));

-- Todo convite herda o canal da visita (agendar, trocar de corretor, chamado automático, reagendar)
create or replace function private.convite_canal()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  NEW.canal := coalesce((select aviso_corretor from public.visit_cycles where visita_id = NEW.visita_id), 'app');
  return NEW;
end $$;
drop trigger if exists convite_canal on public.visita_convites;
create trigger convite_canal before insert on public.visita_convites for each row execute function private.convite_canal();

-- Agendar: recebe o canal; pelo WhatsApp não existe chamado automático (o sistema não fica sabendo da resposta)
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.visita_agendar(jsonb)'::regprocedure);
  if position('aviso_corretor' in src) = 0 then
    src := replace(src, $a$v_auto boolean := coalesce((p_dados->>'automatico')::boolean, false); /* chamado_auto_agendar */$a$,
      $a$v_auto boolean := coalesce((p_dados->>'automatico')::boolean, false); /* chamado_auto_agendar */
  v_aviso text := case when p_dados->>'aviso' = 'whatsapp' then 'whatsapp' else 'app' end; /* aviso_corretor */$a$);
    src := replace(src, $a$perform set_config('memude.fase1', '1', true);$a$,
      $a$perform set_config('memude.fase1', '1', true);
  if v_aviso = 'whatsapp' then v_auto := false; end if;$a$);
    src := replace(src, $a$insert into public.visit_cycles (visita_id, scheduled_at, match_status, chamado_automatico)
  values (v_id, private.f1_inicio(v_data, v_hora), 'searching', v_auto);$a$,
      $a$insert into public.visit_cycles (visita_id, scheduled_at, match_status, chamado_automatico, aviso_corretor)
  values (v_id, private.f1_inicio(v_data, v_hora), 'searching', v_auto, v_aviso);$a$);
    if (length(src) - length(replace(src, 'v_aviso', ''))) / length('v_aviso') < 3 then
      raise exception 'Ajuste de visita_agendar não aplicado';
    end if;
    execute src;
  end if;
end $do$;

-- Reagendar mantém o canal da visita anterior
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.visita_reagendar(uuid,date,time,uuid,text)'::regprocedure);
  if position('aviso_corretor' in src) = 0 then
    src := replace(src, $a$insert into public.visit_cycles (visita_id, scheduled_at, match_status, previous_visita_id, chamado_automatico)
  values (v_novo, private.f1_inicio(p_data, p_hora), 'searching', o.id,
    coalesce((select c.chamado_automatico from public.visit_cycles c where c.visita_id = o.id), false)); /* chamado_auto_reagendar */$a$,
      $a$insert into public.visit_cycles (visita_id, scheduled_at, match_status, previous_visita_id, chamado_automatico, aviso_corretor)
  values (v_novo, private.f1_inicio(p_data, p_hora), 'searching', o.id,
    coalesce((select c.chamado_automatico from public.visit_cycles c where c.visita_id = o.id), false), /* chamado_auto_reagendar */
    coalesce((select c.aviso_corretor from public.visit_cycles c where c.visita_id = o.id), 'app'));$a$);
    if position('aviso_corretor' in src) = 0 then raise exception 'Ajuste de visita_reagendar não aplicado'; end if;
    execute src;
  end if;
end $do$;

-- Convite pelo WhatsApp não toca nem aparece no app do corretor
create or replace function private.conv_push_convite()
returns trigger language plpgsql security definer set search_path to '' as $$
declare uid uuid; t jsonb; prazo int;
begin
  if NEW.canal <> 'app' then return NEW; end if;
  select p.user_id into uid from public.corretores co join public.profiles p on p.id = co.profile_id where co.id = NEW.corretor_id;
  select coalesce(prazo_aceite_min, 15) into prazo from public.fase1_config where id;
  t := private.chamado_texto(NEW.id, prazo);
  perform private.conv_push(array[uid], coalesce(t->>'titulo', 'Nova visita para você'), coalesce(t->>'corpo', 'Toque para aceitar'),
    '/app?convite=' || NEW.id, 'convite-' || NEW.id, t->>'imagem');
  return NEW;
end $$;

do $do$
declare src text;
begin
  src := pg_get_functiondef('public.corretor_meus_convites()'::regprocedure);
  if position('vc.canal' in src) = 0 then
    src := replace(src, $a$where vc.corretor_id = cid and vc.resposta is null$a$, $a$where vc.corretor_id = cid and vc.resposta is null and vc.canal = 'app'$a$);
    if position('vc.canal' in src) = 0 then raise exception 'Ajuste de corretor_meus_convites não aplicado'; end if;
    execute src;
  end if;

  src := pg_get_functiondef('private.chamados_tick()'::regprocedure);
  if position('vc.canal' in src) = 0 then
    src := replace(src, $a$select vc.id, vc.visita_id, vc.corretor_id, vc.enviado_em, vc.reavisos,$a$,
      $a$select vc.id, vc.visita_id, vc.corretor_id, vc.enviado_em, vc.reavisos, vc.canal,$a$);
    src := replace(src, $a$elsif r.reavisos < 2 and r.uid is not null$a$, $a$elsif r.reavisos < 2 and r.uid is not null and r.canal = 'app'$a$);
    if position('r.canal' in src) = 0 then raise exception 'Ajuste de chamados_tick não aplicado'; end if;
    execute src;
  end if;
end $do$;
