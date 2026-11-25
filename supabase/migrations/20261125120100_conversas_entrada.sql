-- ============================================================
-- MeMude Conversas — entrada de dados vinda do Evolution (só o servidor chama: service_role),
-- convites do corretor em tempo real, atividades do usuário e cron de alertas.
-- ============================================================

-- Fonte do lead pela 1ª mensagem (quando o contato é novo)
create or replace function private.conv_fonte_por_texto(p_texto text)
returns text language sql immutable set search_path to '' as $$
  select case
    when p_texto ~* '(google|pesquis)' then 'Google'
    when p_texto ~* '(instagram|facebook|an[uú]ncio)' then 'Meta'
    when p_texto ~* '(memude\.com|site|formul[aá]rio|cadastr)' then 'Cadastro'
    else null end;
$$;

-- Registra uma mensagem do Evolution (do cliente, ou enviada direto pelo celular do número)
create or replace function public.conv_registrar_mensagem(p jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  n public.conv_numeros; c public.conversas; v_lead uuid; v_msg uuid; v_novo boolean := false;
  v_tel text := public.normalize_phone_canonical(p->>'telefone');
  v_chave text := public.normalize_phone_key(p->>'telefone');
  v_dir text := p->>'direcao';
  v_tipo text := coalesce(p->>'tipo', 'texto');
  v_texto text := nullif(left(p->>'texto', 8000), '');
  v_nome text := nullif(btrim(p->>'nome_contato'), '');
  v_quando timestamptz := coalesce(nullif(p->>'quando', '')::timestamptz, now());
  v_previa text;
begin
  select * into n from public.conv_numeros where instancia = p->>'instancia';
  if not found then return jsonb_build_object('ignorado', 'numero desconhecido'); end if;
  if v_chave is null then return jsonb_build_object('ignorado', 'telefone inválido'); end if;
  if v_dir not in ('entrada', 'saida') then raise exception 'direção inválida'; end if;

  select * into c from public.conversas where numero_id = n.id and telefone_chave = v_chave for update;
  if not found then
    -- Lead: o mesmo telefone já cadastrado; senão, cria (contato novo pelo WhatsApp)
    select id into v_lead from public.leads where telefone_chave = v_chave and deleted_at is null
      order by telefone_chave_conflito, created_at limit 1;
    if v_lead is null and v_dir = 'entrada' then
      perform set_config('memude.fase1', '1', true);
      insert into public.leads (nome, telefone, fonte, status_atendimento, origem, data_entrada)
      values (coalesce(v_nome, 'Contato ' || right(v_tel, 4)), v_tel, private.conv_fonte_por_texto(v_texto), 'NOVO', 'conversas',
              (v_quando at time zone 'America/Fortaleza')::date)
      returning id into v_lead;
    end if;
    insert into public.conversas (numero_id, lead_id, telefone, telefone_chave, jid, nome_contato, ultima_mensagem_em)
    values (n.id, v_lead, v_tel, v_chave, coalesce(p->>'jid', v_tel || '@s.whatsapp.net'), v_nome, v_quando)
    returning * into c;
    insert into public.conversa_donos (conversa_id, dono_id, dono_papel, motivo) values (c.id, null, 'sdr', 'Conversa nova');
    v_novo := true;
  end if;

  insert into public.mensagens (conversa_id, wa_id, direcao, tipo, texto, midia_path, midia_mime, midia_nome, midia_bytes, duracao_s,
    origem, status, criado_em)
  values (c.id, p->>'wa_id', v_dir, v_tipo, v_texto, p->>'midia_path', p->>'midia_mime', p->>'midia_nome',
    nullif(p->>'midia_bytes', '')::int, nullif(p->>'duracao_s', '')::int,
    case when v_dir = 'entrada' then 'cliente' else 'celular' end,
    case when v_dir = 'entrada' then 'recebida' else 'enviada' end, v_quando)
  on conflict (conversa_id, wa_id) do nothing
  returning id into v_msg;
  if v_msg is null then return jsonb_build_object('conversa_id', c.id, 'duplicada', true); end if;

  v_previa := coalesce(left(v_texto, 140), case v_tipo when 'imagem' then '📷 Foto' when 'audio' then '🎤 Áudio' when 'video' then '🎥 Vídeo'
    when 'documento' then '📄 ' || coalesce(p->>'midia_nome', 'Documento') when 'figurinha' then 'Figurinha' when 'localizacao' then '📍 Localização'
    when 'contato' then '👤 Contato' when 'reacao' then 'Reagiu a uma mensagem' else 'Mensagem' end);

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

  -- Notifica o dono quando o cliente escreve
  if v_dir = 'entrada' and c.dono_id is not null and v_tipo <> 'reacao' then
    perform private.conv_push(array[c.dono_id], coalesce((select nome from public.leads where id = c.lead_id), c.nome_contato, c.telefone),
      v_previa, case when c.dono_papel = 'corretor' then '/app/c/' || c.id else '/conversas?c=' || c.id end, 'msg-' || c.id);
  end if;
  return jsonb_build_object('conversa_id', c.id, 'mensagem_id', v_msg, 'nova_conversa', v_novo, 'dono_id', c.dono_id);
end $$;

-- Status de entrega/leitura vindo do WhatsApp (só avança: enviada → entregue → lida)
create or replace function public.conv_atualizar_status(p_instancia text, p_wa_id text, p_status text)
returns void language plpgsql security definer set search_path to '' as $$
declare ordem text[] := array['pendente', 'enviada', 'entregue', 'lida'];
begin
  if p_status not in ('enviada', 'entregue', 'lida', 'erro') then return; end if;
  update public.mensagens m set status = p_status
  from public.conversas c join public.conv_numeros n on n.id = c.numero_id
  where m.conversa_id = c.id and n.instancia = p_instancia and m.wa_id = p_wa_id and m.direcao = 'saida'
    and (p_status = 'erro' or coalesce(array_position(ordem, m.status), 0) < array_position(ordem, p_status));
end $$;

-- Conexão do número; avisa a equipe se cair e resolve o aviso quando volta
create or replace function public.conv_numero_status(p_instancia text, p_status text, p_telefone text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare n public.conv_numeros; novo text := case p_status when 'open' then 'aberto' when 'connecting' then 'conectando' else 'desconectado' end;
begin
  select * into n from public.conv_numeros where instancia = p_instancia for update;
  if not found then return; end if;
  update public.conv_numeros set status = novo, ultimo_evento_em = now(),
    telefone = coalesce(public.normalize_phone_canonical(nullif(p_telefone, '')), telefone) where id = n.id;
  if novo = 'desconectado' and n.status = 'aberto' then
    insert into public.conv_alertas (tipo, titulo, detalhe)
    values ('numero_caiu', 'Número "' || n.nome || '" desconectou', 'Reconecte em Conversas → Números (QR code).');
  elsif novo = 'aberto' then
    update public.conv_alertas set resolvido_em = now() where tipo = 'numero_caiu' and resolvido_em is null
      and titulo = 'Número "' || n.nome || '" desconectou';
  end if;
end $$;

revoke all on function public.conv_registrar_mensagem(jsonb) from public, anon, authenticated;
revoke all on function public.conv_atualizar_status(text, text, text) from public, anon, authenticated;
revoke all on function public.conv_numero_status(text, text, text) from public, anon, authenticated;
grant execute on function public.conv_registrar_mensagem(jsonb), public.conv_atualizar_status(text, text, text),
  public.conv_numero_status(text, text, text) to service_role;

-- Corretor vê os próprios convites (tempo real do "Cliente novo")
drop policy if exists "Conversas: corretor vê seus convites" on public.visita_convites;
create policy "Conversas: corretor vê seus convites" on public.visita_convites for select to authenticated
  using (corretor_id = (select private.conv_user_corretor((select auth.uid()))));

-- Atividades pendentes da pessoa (próximos passos e lembretes) — "Hoje" do app
create or replace function public.minhas_atividades()
returns table (id uuid, titulo text, disponivel_em timestamptz, vence_em timestamptz, lead_id uuid, lead_nome text, conversa_id uuid)
language plpgsql stable security definer set search_path to '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Faça login' using errcode = '42501'; end if;
  return query
  select t.id, t.titulo, t.disponivel_em, t.vence_em, t.lead_id, l.nome,
    (select c.id from public.conversas c where c.lead_id = t.lead_id and (c.dono_id = u or private.is_comercial())
     order by c.ultima_mensagem_em desc nulls last limit 1)
  from public.tarefas t left join public.leads l on l.id = t.lead_id
  where t.dono_id = u and t.status = 'pendente' and t.tipo in ('atividade', 'manual')
  order by t.disponivel_em;
end $$;

create or replace function public.minha_atividade_concluir(p_tarefa uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare u uuid := auth.uid();
begin
  update public.tarefas set status = 'concluida', concluida_em = now(), concluida_por = u
  where id = p_tarefa and dono_id = u and status = 'pendente';
  if not found then raise exception 'Atividade não encontrada' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.minhas_atividades(), public.minha_atividade_concluir(uuid) from public, anon;
grant execute on function public.minhas_atividades(), public.minha_atividade_concluir(uuid) to authenticated;

-- Cron: alertas a cada minuto (sem resposta em 15 min, pós-visita esquecido)
select cron.schedule('conversas-alertas', '* * * * *', $cron$select private.conv_verificar_alertas()$cron$);
