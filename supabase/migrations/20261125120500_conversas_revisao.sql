-- MeMude Conversas — correções da revisão
-- 1) "Minhas" não traz arquivadas (arquivar no app do corretor tira a conversa da lista)
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.conversas_listar(text,text,integer)'::regprocedure);
  if position('minhas_sem_arquivo' in src) = 0 then
    src := replace(src, $a$when 'minhas' then c.dono_id = u$a$, $a$when 'minhas' then c.dono_id = u and not c.arquivada /* minhas_sem_arquivo */$a$);
    if position('minhas_sem_arquivo' in src) = 0 then raise exception 'Ajuste de conversas_listar não aplicado'; end if;
    execute src;
  end if;
end $do$;

-- 2) Alerta por push: equipe abre no Connect; o corretor responsável abre no app (ele não acessa /conversas)
create or replace function private.conv_push_alerta()
returns trigger language plpgsql security definer set search_path to '' as $$
declare equipe uuid[]; titulo text; tag text;
begin
  select array_agg(distinct user_id) into equipe from public.user_roles where role::text in ('admin', 'closer');
  titulo := case NEW.tipo when 'sem_resposta' then 'Cliente sem resposta' when 'pos_visita_esquecido' then 'Cliente esfriando'
    when 'sinal_compra' then 'Sinal de compra' when 'contato_pessoal' then 'Atenção na conversa' when 'numero_caiu' then 'Número desconectado'
    else 'Alerta' end;
  tag := 'alerta-' || NEW.tipo || '-' || coalesce(NEW.conversa_id::text, NEW.id::text);
  perform private.conv_push(coalesce(equipe, '{}'), titulo, NEW.titulo,
    case when NEW.conversa_id is not null then '/conversas?c=' || NEW.conversa_id
         when NEW.tipo = 'numero_caiu' then '/conversas?aba=numeros' else '/conversas?aba=alertas' end, tag);
  if NEW.responsavel_id is not null and not (NEW.responsavel_id = any (coalesce(equipe, '{}')))
     and NEW.tipo in ('sem_resposta', 'pos_visita_esquecido') then
    perform private.conv_push(array[NEW.responsavel_id],
      case NEW.tipo when 'sem_resposta' then 'Cliente esperando você' else 'Cliente esfriando' end,
      case NEW.tipo when 'sem_resposta' then 'Responda agora: ' else 'Retome o contato: ' end || NEW.titulo,
      case when NEW.conversa_id is not null then '/app/c/' || NEW.conversa_id else '/app' end, tag);
  end if;
  return NEW;
end $$;

-- 3) Resposta sugerida pela IA perde o sentido assim que a equipe responde
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
  update public.ia_sugestoes set status = 'substituida' where conversa_id = m.conversa_id and tipo = 'resposta' and status = 'aberta';
end $$;

do $do$
declare src text;
begin
  src := pg_get_functiondef('public.conv_registrar_mensagem(jsonb)'::regprocedure);
  if position('resposta_vencida' in src) = 0 then
    src := replace(src, $a$  if v_dir = 'entrada' and c.dono_id is not null and v_tipo <> 'reacao' then$a$,
$a$  if v_dir = 'saida' then /* resposta_vencida: respondeu pelo celular, a sugestão da IA perde o sentido */
    update public.ia_sugestoes set status = 'substituida' where conversa_id = c.id and tipo = 'resposta' and status = 'aberta';
  end if;

  if v_dir = 'entrada' and c.dono_id is not null and v_tipo <> 'reacao' then$a$);
    if position('resposta_vencida' in src) = 0 then raise exception 'Ajuste de conv_registrar_mensagem não aplicado'; end if;
    execute src;
  end if;
end $do$;
