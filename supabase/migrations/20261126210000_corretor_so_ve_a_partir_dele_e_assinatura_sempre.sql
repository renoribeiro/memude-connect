-- 1) O corretor só vê as mensagens a partir do momento em que assumiu a conversa (o atendimento da SDR fica oculto;
--    ele recebe o resumo da IA e a ficha do cliente). A equipe comercial continua vendo tudo.
-- 2) Toda mensagem ao cliente sai identificada ("*Nome · Corretor(a)*"), não só a primeira.

create or replace function private.conv_visivel_desde(p_conversa uuid)
returns timestamptz language sql stable security definer set search_path to '' as $$
  select case when private.is_comercial() then '-infinity'::timestamptz else coalesce(
    (select min(d.criado_em) from public.conversa_donos d where d.conversa_id = p_conversa and d.dono_id = (select auth.uid())),
    (select c.criada_em from public.conversas c where c.id = p_conversa)) end;
$$;

drop policy if exists "Conversas: mensagens de conversa visível" on public.mensagens;
create policy "Conversas: mensagens de conversa visível" on public.mensagens for select to authenticated
  using (private.conv_pode_ver(conversa_id) and criado_em >= private.conv_visivel_desde(conversa_id));

-- Prévia da última mensagem também some quando ela é do atendimento anterior
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.conversas_listar(text,text,integer)'::regprocedure);
  if position('conv_visivel_desde' in src) = 0 then
    src := replace(src, $a$c.ultima_mensagem_em, c.ultima_previa, c.ultima_direcao, c.aguardando_desde,$a$,
      $a$c.ultima_mensagem_em, case when equipe or c.ultima_mensagem_em >= private.conv_visivel_desde(c.id) then c.ultima_previa end,
    c.ultima_direcao, c.aguardando_desde,$a$);
    if position('conv_visivel_desde' in src) = 0 then raise exception 'Ajuste de conversas_listar não aplicado'; end if;
    execute src;
  end if;

  src := pg_get_functiondef('public.corretor_meus_clientes()'::regprocedure);
  if position('conv_visivel_desde' in src) = 0 then
    src := replace(src, $a$c.ultima_mensagem_em, c.ultima_previa, c.ultima_direcao, c.aguardando_desde,$a$,
      $a$c.ultima_mensagem_em, case when c.ultima_mensagem_em >= private.conv_visivel_desde(c.id) then c.ultima_previa end,
    c.ultima_direcao, c.aguardando_desde,$a$);
    if position('conv_visivel_desde' in src) = 0 then raise exception 'Ajuste de corretor_meus_clientes não aplicado'; end if;
    execute src;
  end if;

  -- Assinatura em toda mensagem (pelo app/Connect)
  src := pg_get_functiondef('public.conversa_preparar_envio(uuid)'::regprocedure);
  if position('assinatura_sempre' in src) = 0 then
    src := replace(src, $a$case when ultima.autor_id = u and ultima.criado_em > now() - interval '4 hours' then null$a$,
      $a$case when false /* assinatura_sempre */ then null$a$);
    if position('assinatura_sempre' in src) = 0 then raise exception 'Ajuste de conversa_preparar_envio não aplicado'; end if;
    execute src;
  end if;

  -- ... e nas mensagens automáticas da visita
  src := pg_get_functiondef('public.vma_reivindicar(integer)'::regprocedure);
  if position('assinatura_sempre' in src) = 0 then
    src := replace(src, $a$case when ultima.autor_id = autor and ultima.criado_em > now() - interval '4 hours' then null$a$,
      $a$case when false /* assinatura_sempre */ then null$a$);
    if position('assinatura_sempre' in src) = 0 then raise exception 'Ajuste de vma_reivindicar não aplicado'; end if;
    execute src;
  end if;
end $do$;
