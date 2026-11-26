-- 1) Chamado mais completo (foto do empreendimento, dia, hora, bairro e prazo na notificação)
-- 2) Mensagens prontas da visita enviadas e programadas sozinhas para o CLIENTE pelo número da MeMude
--    (o corretor não recebe mensagem: ele recebe o chamado no app).

-- ---------- Foto do empreendimento (vem da imagem destacada do post no site) ----------
alter table public.empreendimentos add column if not exists imagem_url text;

-- ---------- Liga/desliga do ENVIO automático (começa desligado: liga quando o número oficial da MeMude estiver conectado).
-- Desligado, as mensagens continuam sendo programadas; as que vencerem são descartadas (nada acumula para sair de uma vez).
alter table public.fase1_config add column if not exists mensagens_auto boolean not null default false;

-- ---------- Push com imagem (Android mostra a foto grande; iPhone mostra título e texto) ----------
create or replace function private.conv_push(p_users uuid[], p_titulo text, p_corpo text, p_url text, p_tag text, p_imagem text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if p_users is null or cardinality(p_users) = 0 then return; end if;
  if not exists (select 1 from public.push_inscricoes where user_id = any (p_users)) then return; end if;
  perform net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/conversas-push',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')),
    body := jsonb_strip_nulls(jsonb_build_object('users', to_jsonb(p_users), 'titulo', left(p_titulo, 80), 'corpo', left(p_corpo, 240),
      'url', p_url, 'tag', p_tag, 'imagem', p_imagem)),
    timeout_milliseconds := 15000);
exception when others then
  raise warning 'push não enviado: %', sqlerrm;
end $$;

-- Texto do chamado: "Dary quer visitar o Trendy Parquelândia / Sáb, 28/11 às 10h · Parquelândia / 15 min para aceitar"
create or replace function private.chamado_texto(p_convite uuid, p_minutos int)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'titulo', coalesce(split_part(l.nome, ' ', 1), 'Cliente') || ' quer visitar' || coalesce(' o ' || e.nome, ' um imóvel'),
    'corpo', (array['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'])[extract(dow from v.data_visita)::int + 1] || ', '
      || to_char(v.data_visita, 'DD/MM') || ' às ' || replace(to_char(v.horario_visita, 'HH24:MI'), ':00', 'h')
      || coalesce(' · ' || coalesce(v.meeting_neighborhood, b.nome), '')
      || E'\n' || 'Toque para aceitar · ' || greatest(p_minutos, 1) || ' min',
    'imagem', e.imagem_url)
  from public.visita_convites vc
  join public.visitas v on v.id = vc.visita_id
  join public.leads l on l.id = v.lead_id
  left join public.empreendimentos e on e.id = v.empreendimento_id
  left join public.bairros b on b.id = e.bairro_id
  where vc.id = p_convite;
$$;

create or replace function private.conv_push_convite()
returns trigger language plpgsql security definer set search_path to '' as $$
declare uid uuid; t jsonb; prazo int;
begin
  select p.user_id into uid from public.corretores co join public.profiles p on p.id = co.profile_id where co.id = NEW.corretor_id;
  select coalesce(prazo_aceite_min, 15) into prazo from public.fase1_config where id;
  t := private.chamado_texto(NEW.id, prazo);
  perform private.conv_push(array[uid], coalesce(t->>'titulo', 'Nova visita para você'), coalesce(t->>'corpo', 'Toque para aceitar'),
    '/app?convite=' || NEW.id, 'convite-' || NEW.id, t->>'imagem');
  return NEW;
end $$;

-- Reaviso do chamado no mesmo formato
do $do$
declare src text;
begin
  src := pg_get_functiondef('private.chamados_tick()'::regprocedure);
  if position('chamado_texto' in src) = 0 then
    src := replace(src,
      $a$perform private.conv_push(array[r.uid], 'Cliente esperando você',
          coalesce(r.lead_nome, 'Cliente') || coalesce(' · ' || r.emp, '') || ' — ' || faltam || ' min para aceitar',
          '/app?convite=' || r.id, 'convite-' || r.id);$a$,
      $a$perform private.conv_push(array[r.uid], coalesce(private.chamado_texto(r.id, faltam)->>'titulo', 'Cliente esperando você'),
          coalesce(private.chamado_texto(r.id, faltam)->>'corpo', faltam || ' min para aceitar'),
          '/app?convite=' || r.id, 'convite-' || r.id, private.chamado_texto(r.id, faltam)->>'imagem');$a$);
    if position('chamado_texto' in src) = 0 then raise exception 'Ajuste de chamados_tick não aplicado'; end if;
    execute src;
  end if;
end $do$;

-- Convites do corretor trazem a foto do empreendimento
drop function if exists public.corretor_meus_convites();
create function public.corretor_meus_convites()
returns table(convite_id uuid, visita_id uuid, enviado_em timestamptz, prazo_em timestamptz, lead_nome text, empreendimento text,
  bairro text, data_visita date, horario_visita time, local_nome text, perfil text, renda text, fonte text, imagem text)
language plpgsql stable security definer set search_path to '' as $$
declare cid uuid := private.conv_user_corretor(auth.uid()); prazo int;
begin
  if cid is null then raise exception 'Acesso do corretor não encontrado' using errcode = '42501'; end if;
  select coalesce(prazo_aceite_min, 15) into prazo from public.fase1_config where id;
  return query
  select vc.id, v.id, vc.enviado_em, vc.enviado_em + make_interval(mins => coalesce(prazo, 15)),
    l.nome, e.nome, coalesce(v.meeting_neighborhood, b.nome), v.data_visita, v.horario_visita,
    v.local_nome, v.customer_profile, l.qualificacao->>'renda', l.fonte, e.imagem_url
  from public.visita_convites vc
  join public.visitas v on v.id = vc.visita_id and v.deleted_at is null and v.status = 'aguardando_corretor'
  join public.leads l on l.id = v.lead_id
  left join public.empreendimentos e on e.id = v.empreendimento_id
  left join public.bairros b on b.id = e.bairro_id
  where vc.corretor_id = cid and vc.resposta is null
  order by vc.enviado_em;
end $$;
revoke all on function public.corretor_meus_convites() from public, anon;
grant execute on function public.corretor_meus_convites() to authenticated;

-- ---------- Mensagem de passagem (por que a atendente sai e o corretor entra) ----------
insert into public.message_templates (name, type, category, content, metadata, is_active, is_system, variables)
select 'Visita · MSG 3B — cliente (passagem)', 'whatsapp', 'visit_confirmation',
  E'A partir de agora, quem segue com você é [NOME DO CORRETOR], corretor parceiro da MeMude e especialista no [EMPREENDIMENTO]. '
  || E'A conversa continua aqui mesmo, neste número, e é quem vai te receber na visita.\n\n'
  || E'Eu continuo acompanhando tudo de perto. Qualquer coisa, é só chamar!',
  '{"quem":"agendador","chave":"msg3b","fase1":true,"ordem":2,"destino":"cliente","momento":"aceite"}'::jsonb, true, true,
  '["[NOME DO CORRETOR]","[EMPREENDIMENTO]"]'::jsonb
where not exists (select 1 from public.message_templates where metadata->>'chave' = 'msg3b');

-- ---------- Fila das mensagens automáticas ----------
create table if not exists public.visita_mensagens_auto (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid not null references public.visitas(id) on delete cascade,
  chave text not null,          -- msg1, msg2, msg3:<corretor>, msg3b:<corretor>, d2_cliente, d1_cliente, d0_cliente, realizada_cliente, noshow_cliente
  template text not null,       -- message_templates.metadata->>'chave'
  enviar_em timestamptz not null,
  status text not null default 'agendada' check (status in ('agendada', 'enviando', 'enviada', 'cancelada', 'erro')),
  tentativas int not null default 0,
  reivindicada_em timestamptz,
  conversa_id uuid references public.conversas(id) on delete set null,
  mensagem_id uuid references public.mensagens(id) on delete set null,
  erro text,
  criado_em timestamptz not null default now(),
  enviada_em timestamptz,
  unique (visita_id, chave)
);
create index if not exists visita_mensagens_auto_fila_idx on public.visita_mensagens_auto (enviar_em) where status = 'agendada';
alter table public.visita_mensagens_auto enable row level security;
revoke all on public.visita_mensagens_auto from anon;
grant select on public.visita_mensagens_auto to authenticated;
drop policy if exists "Mensagens automáticas visíveis à equipe comercial" on public.visita_mensagens_auto;
create policy "Mensagens automáticas visíveis à equipe comercial" on public.visita_mensagens_auto for select to authenticated
  using ((select private.is_comercial()));

-- Horário comercial para mensagem ao cliente: 8h às 20h30 (fora disso, vai às 8h)
create or replace function private.vma_comercial(p timestamptz)
returns timestamptz language sql stable set search_path to '' as $$
  select case
    when (p at time zone 'America/Fortaleza')::time < time '08:00'
      then ((p at time zone 'America/Fortaleza')::date + time '08:00') at time zone 'America/Fortaleza'
    when (p at time zone 'America/Fortaleza')::time > time '20:30'
      then (((p at time zone 'America/Fortaleza')::date + 1) + time '08:00') at time zone 'America/Fortaleza'
    else p end;
$$;

create or replace function private.vma_agendar(p_visita uuid, p_chave text, p_template text, p_quando timestamptz, p_reprogramar boolean)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if p_reprogramar then
    insert into public.visita_mensagens_auto (visita_id, chave, template, enviar_em)
    values (p_visita, p_chave, p_template, p_quando)
    on conflict (visita_id, chave) do update set enviar_em = excluded.enviar_em, status = 'agendada', tentativas = 0, erro = null
      where public.visita_mensagens_auto.status in ('agendada', 'cancelada');
  else
    insert into public.visita_mensagens_auto (visita_id, chave, template, enviar_em)
    values (p_visita, p_chave, p_template, p_quando)
    on conflict (visita_id, chave) do nothing;
  end if;
end $$;

-- Programa (ou reprograma) as mensagens de uma visita. p_evento: criacao | aceite | resultado | atualizacao | backfill
create or replace function private.vma_programar(p_visita uuid, p_evento text)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v public.visitas; cfg public.fase1_config; tz constant text := 'America/Fortaleza';
  ini timestamptz; t timestamptz; base timestamptz := now();
begin
  select * into cfg from public.fase1_config where id;
  select * into v from public.visitas where id = p_visita;
  if not found or not coalesce(v.fase1, false) then return; end if;
  if not exists (select 1 from public.leads l where l.id = v.lead_id and l.telefone_chave is not null and l.deleted_at is null) then return; end if;

  -- Visita cancelada, apagada ou substituída: nada pendente sai
  if v.deleted_at is not null or v.status not in ('aguardando_corretor', 'agendada', 'confirmada', 'realizada', 'no_show') then
    update public.visita_mensagens_auto set status = 'cancelada' where visita_id = v.id and status = 'agendada';
    return;
  end if;
  ini := private.f1_inicio(v.data_visita, v.horario_visita);

  if v.status in ('realizada', 'no_show') then
    update public.visita_mensagens_auto set status = 'cancelada'
      where visita_id = v.id and status = 'agendada' and template in ('d2_cliente', 'd1_cliente', 'd0_cliente');
    if p_evento = 'resultado' then
      perform private.vma_agendar(v.id, case v.status when 'realizada' then 'realizada_cliente' else 'noshow_cliente' end,
        case v.status when 'realizada' then 'realizada_cliente' else 'noshow_cliente' end,
        private.vma_comercial(greatest(now(), ini + interval '1 hour')), false);
    end if;
    return;
  end if;
  if ini <= now() then return; end if;

  -- Agendamento feito pela SDR: confirmação dos dados e aviso de que o corretor vem a seguir
  if p_evento = 'criacao' and v.intake_source = 'fase1_manual' then
    perform private.vma_agendar(v.id, 'msg1', 'msg1', private.vma_comercial(base), false);
    perform private.vma_agendar(v.id, 'msg2', 'msg2', private.vma_comercial(base) + interval '20 seconds', false);
    base := base + interval '40 seconds';
  end if;

  -- Corretor definido: apresenta o corretor e explica a passagem do atendimento
  if p_evento in ('criacao', 'aceite') and v.corretor_id is not null and v.status in ('agendada', 'confirmada') then
    update public.visita_mensagens_auto set status = 'cancelada'
      where visita_id = v.id and status = 'agendada' and template in ('msg3', 'msg3b')
        and chave not in ('msg3:' || v.corretor_id, 'msg3b:' || v.corretor_id);
    perform private.vma_agendar(v.id, 'msg3:' || v.corretor_id, 'msg3', private.vma_comercial(base), false);
    perform private.vma_agendar(v.id, 'msg3b:' || v.corretor_id, 'msg3b', private.vma_comercial(base) + interval '20 seconds', false);
  end if;

  -- Lembretes: D-2 e D-1 às 10h; no dia, 3 h antes (não antes das 8h). Só se ficarem a mais de 6 h do agendamento.
  t := ((v.data_visita - 2) + time '10:00') at time zone tz;
  if t > now() and t > v.created_at + interval '6 hours' then perform private.vma_agendar(v.id, 'd2_cliente', 'd2_cliente', t, true);
  else update public.visita_mensagens_auto set status = 'cancelada' where visita_id = v.id and chave = 'd2_cliente' and status = 'agendada'; end if;

  t := ((v.data_visita - 1) + time '10:00') at time zone tz;
  if t > now() and t > v.created_at + interval '6 hours' then perform private.vma_agendar(v.id, 'd1_cliente', 'd1_cliente', t, true);
  else update public.visita_mensagens_auto set status = 'cancelada' where visita_id = v.id and chave = 'd1_cliente' and status = 'agendada'; end if;

  t := greatest((v.data_visita + time '08:00') at time zone tz, ini - make_interval(hours => coalesce(cfg.prazo_d0_horas_antes, 3)));
  if t > now() and t > v.created_at + interval '6 hours' and t < ini then perform private.vma_agendar(v.id, 'd0_cliente', 'd0_cliente', t, true);
  else update public.visita_mensagens_auto set status = 'cancelada' where visita_id = v.id and chave = 'd0_cliente' and status = 'agendada'; end if;
end $$;

create or replace function private.vma_gatilho()
returns trigger language plpgsql security definer set search_path to '' as $$
declare ev text := 'atualizacao';
begin
  if TG_OP = 'INSERT' then ev := 'criacao';
  elsif NEW.status is distinct from OLD.status and NEW.status in ('realizada', 'no_show') then ev := 'resultado';
  elsif NEW.corretor_id is not null and NEW.status in ('agendada', 'confirmada')
        and (NEW.corretor_id is distinct from OLD.corretor_id or OLD.status = 'aguardando_corretor') then ev := 'aceite';
  end if;
  perform private.vma_programar(NEW.id, ev);
  return NEW;
exception when others then
  raise warning 'mensagens automáticas da visita % não programadas: %', NEW.id, sqlerrm;
  return NEW;
end $$;

drop trigger if exists vma_visitas on public.visitas;
create trigger vma_visitas after insert or update of status, corretor_id, data_visita, horario_visita, deleted_at on public.visitas
  for each row execute function private.vma_gatilho();

-- Texto final da mensagem com os dados atuais da visita (linhas sem dado somem)
create or replace function private.vma_render(p_conteudo text, p_visita uuid)
returns text language plpgsql stable security definer set search_path to '' as $$
declare v public.visitas; l public.leads; e public.empreendimentos; corretor text; endereco text; local text; t text; linha text; saida text[] := '{}';
begin
  select * into v from public.visitas where id = p_visita;
  select * into l from public.leads where id = v.lead_id;
  select * into e from public.empreendimentos where id = v.empreendimento_id;
  select nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '') into corretor
    from public.corretores c join public.profiles p on p.id = c.profile_id where c.id = v.corretor_id;
  endereco := nullif(concat_ws(' – ', nullif(trim(v.meeting_address), ''),
    case when v.meeting_neighborhood is not null and position(lower(v.meeting_neighborhood) in lower(coalesce(v.meeting_address, ''))) = 0
      then nullif(trim(v.meeting_neighborhood), '') end), '');
  local := nullif(concat_ws(' – ', nullif(trim(v.local_nome), ''), endereco), '');
  t := p_conteudo;
  t := replace(t, '[DATA]', to_char(v.data_visita, 'DD/MM/YYYY'));
  t := replace(t, '[HORÁRIO]', to_char(v.horario_visita, 'HH24:MI'));
  t := replace(t, '[LOCAL]', coalesce(local, '—'));
  t := replace(t, '[ENDEREÇO]', coalesce(endereco, '—'));
  t := replace(t, '[EMPREENDIMENTO]', coalesce(e.nome, 'empreendimento'));
  t := replace(t, '[LINK DO EMPREENDIMENTO]', coalesce('https://memude.com.br/?p=' || e.wp_post_id, '—'));
  t := replace(t, '[NOME DO CLIENTE]', coalesce(l.nome, '—'));
  t := replace(t, '[PERFIL DO CLIENTE]', coalesce(v.customer_profile, '—'));
  t := replace(t, '[NOME DO CORRETOR]', coalesce(corretor, '—'));
  t := replace(t, '[ORIGEM DO LEAD]', coalesce(l.fonte, '—'));
  t := replace(t, ' (—)', '');
  foreach linha in array string_to_array(t, E'\n') loop
    if linha !~ ':\s*—\s*$' then saida := saida || linha; end if;
  end loop;
  return array_to_string(saida, E'\n');
end $$;

-- Conversa do cliente no número principal (cria se ainda não existe)
create or replace function private.vma_conversa(p_visita uuid, p_autor uuid)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v public.visitas; l public.leads; n public.conv_numeros; v_id uuid; dono uuid; papel text; etapa text;
  hoje timestamptz := (date_trunc('day', now() at time zone 'America/Fortaleza')) at time zone 'America/Fortaleza';
begin
  select * into v from public.visitas where id = p_visita;
  select * into l from public.leads where id = v.lead_id and deleted_at is null;
  if l.id is null or l.telefone_chave is null then raise exception 'Cliente sem telefone válido'; end if;
  select c.id into v_id from public.conversas c join public.conv_numeros x on x.id = c.numero_id
    where (c.lead_id = l.id or c.telefone_chave = l.telefone_chave) and x.ativo and x.status = 'aberto'
    order by (x.papel = 'principal') desc, c.ultima_mensagem_em desc nulls last limit 1;
  if v_id is not null then return v_id; end if;

  select * into n from public.conv_numeros where ativo and status = 'aberto' order by (papel = 'principal') desc, criado_em limit 1;
  if not found then raise exception 'Nenhum número conectado em Conversas → Números'; end if;
  if (select count(*) from public.conversa_donos d join public.conversas c on c.id = d.conversa_id
      where c.numero_id = n.id and d.motivo in ('Iniciada pela equipe', 'Mensagem automática da visita') and d.criado_em >= hoje) >= 40 then
    raise exception 'Limite de 40 conversas novas por dia neste número';
  end if;
  -- Com corretor definido, a conversa já nasce com ele; antes disso, com quem agendou
  select p.user_id into dono from public.corretores co join public.profiles p on p.id = co.profile_id
    where co.id = v.corretor_id and v.status in ('agendada', 'confirmada');
  if dono is not null then papel := 'corretor'; etapa := 'visita_marcada';
  else dono := p_autor; papel := case when private.has_role(p_autor, 'closer'::public.app_role) then 'closer' else 'sdr' end; etapa := 'visita_marcada';
  end if;
  insert into public.conversas (numero_id, lead_id, telefone, telefone_chave, jid, nome_contato, dono_id, dono_papel, etapa, ultima_mensagem_em)
  values (n.id, l.id, public.normalize_phone_canonical(l.telefone), l.telefone_chave,
    public.normalize_phone_canonical(l.telefone) || '@s.whatsapp.net', l.nome, dono, papel, etapa, now())
  returning id into v_id;
  insert into public.conversa_donos (conversa_id, dono_id, dono_papel, motivo, ator_id)
  values (v_id, dono, papel, 'Mensagem automática da visita', p_autor);
  return v_id;
end $$;

-- Separa as mensagens que venceram e já registra cada uma na conversa (o envio é feito pela função conversas-automaticas)
create or replace function public.vma_reivindicar(p_limite int default 10)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  r public.visita_mensagens_auto; v public.visitas; cfg public.fase1_config; tpl record; texto text; autor uuid; conv uuid;
  n public.conv_numeros; c public.conversas; ultima record; assinatura text; msg uuid; saida jsonb := '[]'::jsonb; valida boolean;
begin
  select * into cfg from public.fase1_config where id;
  -- Envio que travou no meio (função caiu): volta para a fila
  update public.visita_mensagens_auto set status = 'agendada' where status = 'enviando' and reivindicada_em < now() - interval '10 minutes';
  if not coalesce(cfg.mensagens_auto, false) then
    update public.visita_mensagens_auto set status = 'cancelada', erro = 'Envio automático desligado'
      where status = 'agendada' and enviar_em <= now();
    return saida;
  end if;

  for r in
    update public.visita_mensagens_auto set status = 'enviando', tentativas = tentativas + 1, reivindicada_em = now()
    where id in (select id from public.visita_mensagens_auto where status = 'agendada' and enviar_em <= now()
                 order by enviar_em limit least(greatest(p_limite, 1), 20) for update skip locked)
    returning *
  loop
    begin
      select * into v from public.visitas where id = r.visita_id;
      valida := v.id is not null and v.deleted_at is null and case
        when r.template in ('d2_cliente', 'd1_cliente', 'd0_cliente') then v.status in ('aguardando_corretor', 'agendada', 'confirmada')
          and private.f1_inicio(v.data_visita, v.horario_visita) > now()
        when r.template in ('msg3', 'msg3b') then v.status in ('agendada', 'confirmada') and r.chave like '%:' || v.corretor_id
        when r.template = 'realizada_cliente' then v.status = 'realizada'
        when r.template = 'noshow_cliente' then v.status = 'no_show'
        else v.status in ('aguardando_corretor', 'agendada', 'confirmada') end;
      select content, metadata->>'quem' as quem into tpl from public.message_templates
        where metadata->>'chave' = r.template and is_active limit 1;
      if not coalesce(valida, false) or tpl.content is null then
        update public.visita_mensagens_auto set status = 'cancelada', erro = case when tpl.content is null then 'Modelo desativado' end where id = r.id;
        continue;
      end if;
      texto := private.vma_render(tpl.content, v.id);
      autor := case when tpl.quem = 'closer' then coalesce(cfg.closer_user_id, v.criado_por) else coalesce(v.criado_por, cfg.closer_user_id) end;
      autor := coalesce(autor, cfg.responsaveis[1]);
      conv := private.vma_conversa(v.id, autor);
      select * into c from public.conversas where id = conv;
      select * into n from public.conv_numeros where id = c.numero_id;
      if n.status <> 'aberto' then raise exception 'Número desconectado'; end if;
      select m.autor_id, m.criado_em into ultima from public.mensagens m
        where m.conversa_id = conv and m.direcao = 'saida' and m.status <> 'erro' order by m.criado_em desc limit 1;
      assinatura := case when ultima.autor_id = autor and ultima.criado_em > now() - interval '4 hours' then null
        else '*' || coalesce(split_part(private.conv_nome_usuario(autor), ' ', 1), 'Equipe') || ' · ' || private.conv_rotulo_papel(autor) || '*' end;
      msg := public.conv_mensagem_saida(jsonb_build_object('conversa_id', conv, 'autor_id', autor,
        'autor_nome', private.conv_nome_usuario(autor), 'tipo', 'texto', 'texto', texto));
      update public.visita_mensagens_auto set conversa_id = conv, mensagem_id = msg where id = r.id;
      saida := saida || jsonb_build_object('id', r.id, 'mensagem_id', msg, 'instancia', n.instancia, 'telefone', c.telefone,
        'texto', case when assinatura is null then texto else assinatura || E'\n' || texto end);
    exception when others then
      update public.visita_mensagens_auto set
        status = case when r.tentativas >= 3 then 'erro' else 'agendada' end,
        enviar_em = now() + interval '10 minutes', erro = left(sqlerrm, 300)
      where id = r.id;
    end;
  end loop;
  return saida;
end $$;

-- Resultado do envio
create or replace function public.vma_resultado(p_id uuid, p_wa_id text, p_erro text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare r public.visita_mensagens_auto;
begin
  select * into r from public.visita_mensagens_auto where id = p_id for update;
  if not found then return; end if;
  if r.mensagem_id is not null then perform public.conv_mensagem_resultado(r.mensagem_id, p_wa_id, p_erro); end if;
  if p_erro is null then
    update public.visita_mensagens_auto set status = 'enviada', enviada_em = now(), erro = null where id = p_id;
  else
    update public.visita_mensagens_auto set status = case when r.tentativas >= 3 then 'erro' else 'agendada' end,
      enviar_em = now() + interval '10 minutes', erro = left(p_erro, 300) where id = p_id;
  end if;
end $$;

revoke all on function public.vma_reivindicar(int) from public, anon, authenticated;
revoke all on function public.vma_resultado(uuid, text, text) from public, anon, authenticated;
grant execute on function public.vma_reivindicar(int) to service_role;
grant execute on function public.vma_resultado(uuid, text, text) to service_role;

-- Só chama a função quando há mensagem vencida (custo zero no resto do tempo)
do $do$
begin
  perform cron.unschedule('conversas-automaticas') where exists (select 1 from cron.job where jobname = 'conversas-automaticas');
  perform cron.schedule('conversas-automaticas', '* * * * *', $cron$
    select net.http_post(
      url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/conversas-automaticas',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')),
      body := '{}'::jsonb, timeout_milliseconds := 60000)
    where exists (select 1 from public.visita_mensagens_auto where status = 'agendada' and enviar_em <= now());
  $cron$);
end $do$;

-- Visitas futuras que já existem: só os lembretes (as mensagens de agendamento e de corretor já foram mandadas à mão)
select private.vma_programar(v.id, 'backfill') from public.visitas v
where v.deleted_at is null and v.fase1 and v.status in ('aguardando_corretor', 'agendada', 'confirmada')
  and v.data_visita >= (now() at time zone 'America/Fortaleza')::date;
