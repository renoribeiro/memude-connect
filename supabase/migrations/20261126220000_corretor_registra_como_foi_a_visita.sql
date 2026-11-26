-- Depois da visita o corretor conta no app como foi. Cada resposta segue o fluxo combinado:
--   vai_comprar  → continua com o corretor e o closer é avisado (2.3)
--   pensando     → continua com o corretor
--   nao_gostou   → a conversa volta para a SDR (2.2)
--   quer_outros  → a conversa volta para a SDR oferecer outros imóveis (2.5)
--   no_show      → não compareceu: volta para a SDR remarcar (2.1, mesmo caminho de sempre)
-- Em todos os casos fica uma nota interna na conversa com o resultado e o comentário do corretor.

alter table public.visitas add column if not exists resultado_cliente text
  check (resultado_cliente in ('vai_comprar', 'pensando', 'nao_gostou', 'quer_outros'));

create or replace function public.corretor_registrar_visita(p_visita uuid, p_resultado text, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  u uuid := auth.uid(); cid uuid := private.conv_user_corretor(auth.uid());
  v public.visitas; cfg public.fase1_config; inicio timestamptz; closer uuid; lead_nome text; c record;
  obs text := nullif(btrim(coalesce(p_observacao, '')), ''); rotulo text; nome_corretor text;
begin
  if cid is null then raise exception 'Acesso do corretor não encontrado' using errcode = '42501'; end if;
  if p_resultado is null or p_resultado not in ('vai_comprar', 'pensando', 'nao_gostou', 'quer_outros', 'no_show') then
    raise exception 'Escolha como foi a visita' using errcode = '22023';
  end if;
  if p_resultado in ('nao_gostou', 'quer_outros') and obs is null then
    raise exception 'Conte em poucas palavras o motivo: ajuda a SDR a oferecer o imóvel certo' using errcode = '22023';
  end if;
  if length(coalesce(obs, '')) > 1000 then raise exception 'Comentário muito longo (até 1000 caracteres)' using errcode = '22023'; end if;
  perform set_config('memude.fase1', '1', true);
  select * into cfg from public.fase1_config where id;
  select * into v from public.visitas where id = p_visita and deleted_at is null for update;
  if not found or v.corretor_id is distinct from cid then raise exception 'Visita não encontrada' using errcode = 'P0002'; end if;
  if v.status not in ('agendada', 'confirmada', 'realizada') then
    raise exception 'Esta visita não está mais em aberto' using errcode = '22023';
  end if;
  if p_resultado = 'no_show' and v.status = 'realizada' then
    raise exception 'Esta visita já foi registrada como realizada' using errcode = '22023';
  end if;
  inicio := private.f1_inicio(v.data_visita, v.horario_visita);
  if now() < inicio - interval '30 minutes' then raise exception 'A visita ainda não aconteceu' using errcode = '22023'; end if;
  closer := coalesce(cfg.closer_user_id, v.criado_por);
  select nome into lead_nome from public.leads where id = v.lead_id;
  nome_corretor := private.f1_nome_corretor(cid);

  if p_resultado = 'no_show' then
    update public.visit_cycles set outcome = 'not_held', match_status = 'closed', attendance_overdue = false,
      confirmation_overdue = false, recovery_open = false, updated_at = now() where visita_id = v.id;
    update public.visitas set no_show_em = now(), feedback_corretor = coalesce(obs, feedback_corretor) where id = v.id;
    perform private.f1_status(v.id, 'no_show', u, coalesce(obs, 'Corretor informou no app'));
    perform private.f1_fechar_tarefas(v.id, array['registrar_resultado', 'confirmacao_d0'], 'concluida', u, 'No-show (corretor no app)');
    perform private.f1_fechar_tarefas(v.id, null, 'cancelada', u, 'No-show');
    perform private.f1_tarefa('remarcar_no_show', 'Remarcar no-show com o corretor — ' || lead_nome, v.id, v.lead_id, closer,
      now(), now() + make_interval(hours => cfg.prazo_remarcar_horas));
    rotulo := 'Cliente não compareceu';
  else
    if v.status <> 'realizada' then
      update public.visit_cycles set outcome = 'held', match_status = 'closed', attendance_overdue = false,
        confirmation_overdue = false, recovery_open = false, updated_at = now() where visita_id = v.id;
      perform private.f1_status(v.id, 'realizada', u, 'Corretor informou no app');
      perform private.f1_fechar_tarefas(v.id, array['registrar_resultado', 'confirmacao_d0'], 'concluida', u, 'Visita realizada (corretor no app)');
      perform private.f1_fechar_tarefas(v.id, null, 'cancelada', u, 'Visita realizada');
      perform private.f1_tarefa('retorno', 'Registrar retorno do corretor e do cliente — ' || lead_nome, v.id, v.lead_id, closer,
        now(), greatest(inicio + make_interval(hours => cfg.prazo_retorno_horas), now() + interval '1 hour'));
      perform private.f1_tarefa('proximo_passo', 'Definir próximo passo — ' || lead_nome, v.id, v.lead_id, closer,
        now(), greatest(inicio + make_interval(hours => cfg.prazo_proximo_passo_horas), now() + interval '1 hour'));
      update public.leads set status = 'visita_realizada'::public.lead_status where id = v.lead_id;
    end if;
    update public.visitas set resultado_cliente = p_resultado, interesse = p_resultado in ('vai_comprar', 'pensando'),
      feedback_corretor = coalesce(obs, feedback_corretor) where id = v.id;
    rotulo := case p_resultado when 'vai_comprar' then 'Gostou e quer comprar' when 'pensando' then 'Gostou e está pensando'
      when 'nao_gostou' then 'Não gostou do imóvel' else 'Quer ver outros imóveis' end;
    perform private.f1_evento(v.id, 'f1_resultado_corretor', jsonb_build_object('resultado', p_resultado, 'rotulo', rotulo, 'observacao', obs), u);
  end if;

  for c in select id from public.conversas where lead_id = v.lead_id loop
    insert into public.mensagens (conversa_id, direcao, tipo, texto, autor_id, autor_nome, origem, status)
    values (c.id, 'nota', 'texto', left('Visita de ' || to_char(v.data_visita, 'DD/MM') || ': ' || rotulo || coalesce('. ' || obs, ''), 4000),
      u, private.conv_nome_usuario(u), 'app', 'recebida');
    if p_resultado in ('nao_gostou', 'quer_outros') then
      perform private.conv_trocar_dono(c.id, null, 'sdr', 'Depois da visita: ' || rotulo, u);
      update public.conversas set etapa = 'em_atendimento', arquivada = false where id = c.id;
    elsif p_resultado = 'vai_comprar' then
      insert into public.conv_alertas (tipo, conversa_id, lead_id, responsavel_id, titulo, detalhe)
      values ('sinal_compra', c.id, v.lead_id, closer, left(coalesce(lead_nome, 'Cliente') || ' visitou e quer comprar', 160),
        left('Corretor ' || coalesce(nome_corretor, '') || coalesce(': ' || obs, ''), 400))
      on conflict do nothing;
    end if;
  end loop;
  return jsonb_build_object('visita_id', v.id, 'resultado', p_resultado, 'volta_para_sdr', p_resultado in ('nao_gostou', 'quer_outros', 'no_show'));
end $$;
revoke all on function public.corretor_registrar_visita(uuid, text, text) from public, anon;
grant execute on function public.corretor_registrar_visita(uuid, text, text) to authenticated;
