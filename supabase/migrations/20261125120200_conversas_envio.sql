-- ============================================================
-- MeMude Conversas — envio pelo app, continuidade entre números, segredos e ajustes
-- ============================================================

-- 1) Sugestão da IA só grava status/empreendimento válidos
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.ia_sugestao_decidir(uuid,boolean,jsonb)'::regprocedure);
  if position('status_valido' in src) = 0 then
    src := replace(src, $a$if v ? 'status_atendimento' then$a$,
      $a$if v->>'status_atendimento' = any (array['NOVO','EM CONVERSA','INTERESSADO','VISITA AGENDADA','INVESTIDOR','CORRETOR','SEM RENDA','NÃO INTERESSADO']) /* status_valido */ then$a$);
    src := replace(src, $a$if v ? 'empreendimento_id' then$a$,
      $a$if v->>'empreendimento_id' ~ '^[0-9a-f-]{36}$' and exists (select 1 from public.empreendimentos e where e.id = (v->>'empreendimento_id')::uuid) then$a$);
    if position('status_valido' in src) = 0 then raise exception 'Ajuste de ia_sugestao_decidir não aplicado'; end if;
    execute src;
  end if;
end $do$;

-- 2) Entrada: o mesmo cliente em outro número (backup) continua com o mesmo dono;
--    eco de mensagem enviada pelo app não duplica.
create or replace function public.conv_registrar_mensagem(p jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  n public.conv_numeros; c public.conversas; ant public.conversas; v_lead uuid; v_msg uuid; v_novo boolean := false;
  v_tel text := public.normalize_phone_canonical(p->>'telefone');
  v_chave text := public.normalize_phone_key(p->>'telefone');
  v_dir text := p->>'direcao';
  v_tipo text := coalesce(p->>'tipo', 'texto');
  v_texto text := nullif(left(p->>'texto', 8000), '');
  v_nome text := nullif(btrim(p->>'nome_contato'), '');
  v_wa text := nullif(p->>'wa_id', '');
  v_quando timestamptz := coalesce(nullif(p->>'quando', '')::timestamptz, now());
  v_previa text;
begin
  select * into n from public.conv_numeros where instancia = p->>'instancia';
  if not found then return jsonb_build_object('ignorado', 'numero desconhecido'); end if;
  if v_chave is null then return jsonb_build_object('ignorado', 'telefone inválido'); end if;
  if v_dir not in ('entrada', 'saida') then raise exception 'direção inválida'; end if;
  if v_tipo not in ('texto', 'imagem', 'audio', 'video', 'documento', 'figurinha', 'localizacao', 'contato', 'reacao', 'sistema') then
    v_tipo := 'texto';
  end if;

  select * into c from public.conversas where numero_id = n.id and telefone_chave = v_chave for update;
  if not found then
    select * into ant from public.conversas where telefone_chave = v_chave and numero_id <> n.id
      order by ultima_mensagem_em desc nulls last limit 1;
    v_lead := ant.lead_id;
    if v_lead is null then
      select id into v_lead from public.leads where telefone_chave = v_chave and deleted_at is null
        order by telefone_chave_conflito, created_at limit 1;
    end if;
    if v_lead is null and v_dir = 'entrada' then
      perform set_config('memude.fase1', '1', true);
      insert into public.leads (nome, telefone, fonte, status_atendimento, origem, data_entrada)
      values (coalesce(v_nome, 'Contato ' || right(v_tel, 4)), v_tel, private.conv_fonte_por_texto(v_texto), 'NOVO', 'conversas',
              (v_quando at time zone 'America/Fortaleza')::date)
      returning id into v_lead;
    end if;
    insert into public.conversas (numero_id, lead_id, telefone, telefone_chave, jid, nome_contato, ultima_mensagem_em,
      dono_id, dono_papel, etapa)
    values (n.id, v_lead, v_tel, v_chave, coalesce(p->>'jid', v_tel || '@s.whatsapp.net'), coalesce(v_nome, ant.nome_contato), v_quando,
      ant.dono_id, coalesce(ant.dono_papel, 'sdr'), coalesce(ant.etapa, 'novo'))
    on conflict (numero_id, telefone_chave) do nothing
    returning * into c;
    if c.id is null then
      select * into c from public.conversas where numero_id = n.id and telefone_chave = v_chave for update;
    else
      insert into public.conversa_donos (conversa_id, dono_id, dono_papel, motivo)
      values (c.id, c.dono_id, c.dono_papel, case when ant.id is null then 'Conversa nova' else 'Cliente falou pelo número ' || n.nome end);
      v_novo := true;
    end if;
  end if;

  -- Eco do WhatsApp de uma mensagem que o app acabou de enviar: só liga o id
  if v_dir = 'saida' and v_wa is not null then
    update public.mensagens m set wa_id = v_wa, status = case when m.status = 'pendente' then 'enviada' else m.status end
    where m.id = (select m2.id from public.mensagens m2 where m2.conversa_id = c.id and m2.direcao = 'saida' and m2.origem = 'app'
                  and m2.wa_id is null and m2.status in ('pendente', 'enviada') and m2.criado_em > now() - interval '3 minutes'
                  and (m2.tipo = v_tipo) and (m2.texto is null or (v_texto is not null and right(v_texto, length(m2.texto)) = m2.texto))
                  order by m2.criado_em limit 1)
      and not exists (select 1 from public.mensagens m3 where m3.conversa_id = c.id and m3.wa_id = v_wa)
    returning m.id into v_msg;
    if v_msg is not null then return jsonb_build_object('conversa_id', c.id, 'mensagem_id', v_msg, 'vinculada', true); end if;
  end if;

  insert into public.mensagens (conversa_id, wa_id, direcao, tipo, texto, midia_path, midia_mime, midia_nome, midia_bytes, duracao_s,
    origem, status, criado_em)
  values (c.id, v_wa, v_dir, v_tipo, v_texto, p->>'midia_path', p->>'midia_mime', left(p->>'midia_nome', 200),
    nullif(p->>'midia_bytes', '')::int, nullif(p->>'duracao_s', '')::int,
    case when v_dir = 'entrada' then 'cliente' else 'celular' end,
    case when v_dir = 'entrada' then 'recebida' else 'enviada' end, v_quando)
  on conflict (conversa_id, wa_id) do nothing
  returning id into v_msg;
  if v_msg is null then return jsonb_build_object('conversa_id', c.id, 'duplicada', true); end if;

  v_previa := private.conv_previa(v_tipo, v_texto, p->>'midia_nome');

  if v_tipo <> 'reacao' then
    update public.conversas set
      ultima_mensagem_em = greatest(coalesce(ultima_mensagem_em, v_quando), v_quando),
      ultima_previa = v_previa, ultima_direcao = v_dir,
      aguardando_desde = case when v_dir = 'entrada' then coalesce(aguardando_desde, v_quando) else null end,
      nome_contato = coalesce(nome_contato, v_nome),
      ia_pendente_desde = now(),
      arquivada = case when v_dir = 'entrada' then false else arquivada end,
      etapa = case when v_dir = 'saida' and etapa = 'novo' then 'em_atendimento' else etapa end
    where id = c.id returning * into c;
  end if;

  if v_dir = 'entrada' and c.dono_id is not null and v_tipo <> 'reacao' then
    perform private.conv_push(array[c.dono_id], coalesce((select nome from public.leads where id = c.lead_id), c.nome_contato, c.telefone),
      v_previa, case when c.dono_papel = 'corretor' then '/app/c/' || c.id else '/conversas?c=' || c.id end, 'msg-' || c.id);
  end if;
  return jsonb_build_object('conversa_id', c.id, 'mensagem_id', v_msg, 'nova_conversa', v_novo, 'dono_id', c.dono_id);
end $$;

create or replace function private.conv_previa(p_tipo text, p_texto text, p_nome text)
returns text language sql immutable set search_path to '' as $$
  select coalesce(left(p_texto, 140), case p_tipo when 'imagem' then '📷 Foto' when 'audio' then '🎤 Áudio' when 'video' then '🎥 Vídeo'
    when 'documento' then '📄 ' || coalesce(p_nome, 'Documento') when 'figurinha' then 'Figurinha' when 'localizacao' then '📍 Localização'
    when 'contato' then '👤 Contato' when 'reacao' then 'Reagiu a uma mensagem' else 'Mensagem' end);
$$;

-- 3) Envio pelo app
create or replace function private.conv_rotulo_papel(p_user uuid)
returns text language sql stable security definer set search_path to '' as $$
  select case
    when private.has_role(p_user, 'closer'::public.app_role) then 'Especialista'
    when private.conv_user_corretor(p_user) is not null and not private.has_role(p_user, 'admin'::public.app_role)
         and not private.has_role(p_user, 'sdr'::public.app_role) then 'Corretor(a)'
    else 'Atendimento' end;
$$;

-- Confere a permissão de quem envia e devolve o necessário para o servidor mandar a mensagem
create or replace function public.conversa_preparar_envio(p_conversa uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare u uuid := private.conv_exigir_ver(p_conversa); c public.conversas; n public.conv_numeros; ultima record; nome text;
begin
  if not private.conv_pode_responder(p_conversa) then raise exception 'Só quem atende esta conversa pode responder' using errcode = '42501'; end if;
  select * into c from public.conversas where id = p_conversa;
  select * into n from public.conv_numeros where id = c.numero_id;
  if not n.ativo then raise exception 'O número desta conversa foi desativado' using errcode = '22023'; end if;
  if n.status <> 'aberto' then raise exception 'O número "%" está desconectado. Peça para reconectar em Conversas → Números.', n.nome using errcode = '22023'; end if;
  nome := coalesce(split_part(private.conv_nome_usuario(u), ' ', 1), 'Equipe');
  -- Assinatura inteligente: só quando a pessoa ainda não falou nesta conversa nas últimas 4 horas
  select m.autor_id, m.criado_em into ultima from public.mensagens m
  where m.conversa_id = p_conversa and m.direcao = 'saida' and m.status <> 'erro' order by m.criado_em desc limit 1;
  return jsonb_build_object(
    'instancia', n.instancia, 'jid', c.jid, 'telefone', c.telefone, 'autor_id', u, 'autor_nome', private.conv_nome_usuario(u),
    'assinatura', case when ultima.autor_id = u and ultima.criado_em > now() - interval '4 hours' then null
                       else '*' || nome || ' · ' || private.conv_rotulo_papel(u) || '*' end);
end $$;

-- Registra a mensagem antes de enviar (status pendente) com limites contra disparo em massa
create or replace function public.conv_mensagem_saida(p jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
declare v_id uuid; v_conv uuid := (p->>'conversa_id')::uuid; v_autor uuid := (p->>'autor_id')::uuid; v_num uuid;
begin
  select numero_id into v_num from public.conversas where id = v_conv;
  if v_num is null then raise exception 'Conversa não encontrada' using errcode = 'P0002'; end if;
  if (select count(*) from public.mensagens m where m.autor_id = v_autor and m.direcao = 'saida' and m.criado_em > now() - interval '1 minute') >= 20 then
    raise exception 'Muitas mensagens em pouco tempo. Aguarde um minuto.' using errcode = '22023';
  end if;
  if (select count(*) from public.mensagens m join public.conversas c on c.id = m.conversa_id
      where c.numero_id = v_num and m.direcao = 'saida' and m.criado_em > now() - interval '1 minute') >= 40 then
    raise exception 'O número está enviando muitas mensagens agora. Aguarde um minuto para proteger o número.' using errcode = '22023';
  end if;
  insert into public.mensagens (conversa_id, direcao, tipo, texto, midia_path, midia_mime, midia_nome, midia_bytes, duracao_s,
    autor_id, autor_nome, origem, status, responde_a)
  values (v_conv, 'saida', coalesce(p->>'tipo', 'texto'), nullif(left(p->>'texto', 4000), ''), p->>'midia_path', p->>'midia_mime',
    left(p->>'midia_nome', 200), nullif(p->>'midia_bytes', '')::int, nullif(p->>'duracao_s', '')::int,
    v_autor, p->>'autor_nome', 'app', 'pendente', nullif(p->>'responde_a', '')::uuid)
  returning id into v_id;
  return v_id;
end $$;

-- Resultado do envio: grava o id do WhatsApp e atualiza a conversa
create or replace function public.conv_mensagem_resultado(p_id uuid, p_wa_id text, p_erro text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare m public.mensagens;
begin
  update public.mensagens set
    wa_id = case when p_erro is null and not exists (select 1 from public.mensagens x where x.conversa_id = mensagens.conversa_id
              and x.wa_id = p_wa_id and x.id <> p_id) then coalesce(wa_id, p_wa_id) else wa_id end,
    status = case when p_erro is not null then 'erro' when status = 'pendente' then 'enviada' else status end,
    erro = left(p_erro, 300)
  where id = p_id returning * into m;
  if m.id is null or p_erro is not null then return; end if;
  update public.conversas set ultima_mensagem_em = greatest(coalesce(ultima_mensagem_em, m.criado_em), m.criado_em),
    ultima_previa = private.conv_previa(m.tipo, m.texto, m.midia_nome), ultima_direcao = 'saida', aguardando_desde = null,
    ia_pendente_desde = now(), etapa = case when etapa = 'novo' then 'em_atendimento' else etapa end
  where id = m.conversa_id;
end $$;

-- Começar uma conversa com um lead que ainda não falou no número da MeMude
create or replace function public.conversa_iniciar(p_lead uuid, p_numero uuid default null)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  u uuid := auth.uid(); l public.leads; n public.conv_numeros; v_id uuid; equipe boolean := private.is_comercial();
  cid uuid := private.conv_user_corretor(auth.uid()); hoje timestamptz := (date_trunc('day', now() at time zone 'America/Fortaleza')) at time zone 'America/Fortaleza';
begin
  if u is null then raise exception 'Faça login' using errcode = '42501'; end if;
  select * into l from public.leads where id = p_lead and deleted_at is null;
  if not found then raise exception 'Lead não encontrado' using errcode = 'P0002'; end if;
  if not equipe and (cid is null or not exists (select 1 from public.visitas v where v.lead_id = l.id and v.corretor_id = cid and v.deleted_at is null)) then
    raise exception 'Você só pode iniciar conversa com clientes das suas visitas' using errcode = '42501';
  end if;
  if l.telefone_chave is null then raise exception 'Este lead não tem telefone válido' using errcode = '22023'; end if;

  select x.id into v_id from (select c.id from public.conversas c where c.telefone_chave = l.telefone_chave
    and (p_numero is null or c.numero_id = p_numero) order by c.ultima_mensagem_em desc nulls last limit 1) x;
  if v_id is not null then
    if not private.conv_pode_ver(v_id) then raise exception 'Este cliente já conversa com outra pessoa da equipe' using errcode = '42501'; end if;
    return v_id;
  end if;

  select * into n from public.conv_numeros where ativo and status = 'aberto' and (p_numero is null or id = p_numero)
    order by (papel = 'principal') desc, criado_em limit 1;
  if not found then raise exception 'Nenhum número conectado. Conecte um em Conversas → Números.' using errcode = '22023'; end if;
  if (select count(*) from public.conversa_donos d join public.conversas c on c.id = d.conversa_id
      where c.numero_id = n.id and d.motivo = 'Iniciada pela equipe' and d.criado_em >= hoje) >= 40 then
    raise exception 'Limite de 40 conversas novas por dia neste número (protege contra bloqueio). Tente amanhã ou use outro número.' using errcode = '22023';
  end if;

  insert into public.conversas (numero_id, lead_id, telefone, telefone_chave, jid, nome_contato, dono_id, dono_papel, etapa, ultima_mensagem_em)
  values (n.id, l.id, public.normalize_phone_canonical(l.telefone), l.telefone_chave,
    public.normalize_phone_canonical(l.telefone) || '@s.whatsapp.net', l.nome, u,
    case when not equipe then 'corretor' when private.has_role(u, 'closer'::public.app_role) then 'closer' else 'sdr' end,
    'em_atendimento', now())
  returning id into v_id;
  insert into public.conversa_donos (conversa_id, dono_id, dono_papel, motivo, ator_id)
  select v_id, dono_id, dono_papel, 'Iniciada pela equipe', u from public.conversas where id = v_id;
  return v_id;
end $$;

-- 4) Segredos do servidor (Vault): só o service_role lê/grava, e só estes nomes
create or replace function public.conv_segredo(p_nome text)
returns text language sql stable security definer set search_path to '' as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = p_nome and p_nome in ('conversas_webhook_secret', 'conversas_vapid') limit 1;
$$;

create or replace function public.conv_segredo_salvar(p_nome text, p_valor text)
returns text language plpgsql security definer set search_path to '' as $$
declare atual text;
begin
  if p_nome not in ('conversas_webhook_secret', 'conversas_vapid') then raise exception 'Nome inválido'; end if;
  perform pg_advisory_xact_lock(hashtext('conv_segredo_' || p_nome));
  select decrypted_secret into atual from vault.decrypted_secrets where name = p_nome;
  if atual is not null then return atual; end if;
  perform vault.create_secret(p_valor, p_nome, 'MeMude Conversas');
  return p_valor;
end $$;

-- 5) Fila da IA: pega conversas paradas há 60 s (junta mensagens seguidas numa análise só)
create or replace function public.conv_ia_proximas(p_limite int default 8)
returns setof public.conversas language sql security definer set search_path to '' as $$
  update public.conversas c set ia_pendente_desde = null, ia_analisada_em = now()
  where c.id in (select id from public.conversas where ia_pendente_desde < now() - interval '60 seconds'
                 order by ia_pendente_desde limit least(greatest(p_limite, 1), 20) for update skip locked)
  returning c.*;
$$;

revoke all on function public.conversa_preparar_envio(uuid) from public, anon;
grant execute on function public.conversa_preparar_envio(uuid) to authenticated;
revoke all on function public.conversa_iniciar(uuid, uuid) from public, anon;
grant execute on function public.conversa_iniciar(uuid, uuid) to authenticated;
revoke all on function public.conv_mensagem_saida(jsonb), public.conv_mensagem_resultado(uuid, text, text),
  public.conv_segredo(text), public.conv_segredo_salvar(text, text), public.conv_ia_proximas(int) from public, anon, authenticated;
grant execute on function public.conv_mensagem_saida(jsonb), public.conv_mensagem_resultado(uuid, text, text),
  public.conv_segredo(text), public.conv_segredo_salvar(text, text), public.conv_ia_proximas(int) to service_role;

-- 6) IA a cada minuto (a função sai na hora se não houver nada para analisar)
select cron.schedule('conversas-ia', '* * * * *', $cron$
  select net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/conversas-ia',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 120000)
  where exists (select 1 from public.conversas where ia_pendente_desde < now() - interval '60 seconds')
     or exists (select 1 from public.mensagens where tipo = 'audio' and transcricao is null and midia_path is not null
                and criado_em > now() - interval '1 day')
$cron$);
