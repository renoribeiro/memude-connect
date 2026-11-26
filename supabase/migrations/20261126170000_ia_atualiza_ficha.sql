-- IA das conversas passa a ATUALIZAR a ficha do cliente sozinha (o corretor não precisa preencher nada), com travas:
--  * só preenche o que o cliente disse (cada mudança guarda o trecho da conversa como evidência);
--  * nunca sobrescreve campo preenchido por uma pessoa (vira sugestão para conferir);
--  * status só anda para frente e só até INTERESSADO; mudanças graves (não interessado, sem renda, vendido, perdido)
--    não são aplicadas: viram sugestão + alerta para o closer confirmar;
--  * toda mudança pode ser desfeita (e a IA não refaz o que foi desfeito).

-- ---------- O que falta para avançar (resumo da IA na conversa) ----------
alter table public.conversas add column if not exists ia_falta text;

-- ---------- Histórico do que a IA mudou na ficha ----------
create table if not exists public.lead_ia_mudancas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  conversa_id uuid references public.conversas(id) on delete set null,
  campo text not null check (campo in ('status_atendimento', 'renda', 'entrada_fgts', 'prazo', 'finalidade', 'regiao')),
  de text,
  para text not null,
  evidencia text,
  criado_em timestamptz not null default clock_timestamp(),   -- ordem exata mesmo dentro de uma transação
  desfeita_em timestamptz,
  desfeita_por uuid references auth.users(id) on delete set null
);
create index if not exists lead_ia_mudancas_lead_idx on public.lead_ia_mudancas (lead_id, criado_em desc);
create index if not exists lead_ia_mudancas_conversa_idx on public.lead_ia_mudancas (conversa_id);

alter table public.lead_ia_mudancas enable row level security;
revoke all on public.lead_ia_mudancas from anon;
grant select on public.lead_ia_mudancas to authenticated;
drop policy if exists "IA: mudanças na ficha visíveis à equipe comercial" on public.lead_ia_mudancas;
create policy "IA: mudanças na ficha visíveis à equipe comercial" on public.lead_ia_mudancas for select to authenticated
  using ((select private.is_comercial()));

-- ---------- Alerta para o closer confirmar o que a IA não aplica sozinha ----------
alter table public.conv_alertas drop constraint if exists conv_alertas_tipo_check;
alter table public.conv_alertas add constraint conv_alertas_tipo_check
  check (tipo in ('sem_resposta', 'pos_visita_esquecido', 'sinal_compra', 'contato_pessoal', 'numero_caiu', 'confirmar_ia'));

do $do$
declare src text;
begin
  src := pg_get_functiondef('private.conv_push_alerta()'::regprocedure);
  if position('confirmar_ia' in src) = 0 then
    src := replace(src, $a$when 'numero_caiu' then 'Número desconectado'$a$,
      $a$when 'numero_caiu' then 'Número desconectado' when 'confirmar_ia' then 'Confirme na conversa'$a$);
    if position('confirmar_ia' in src) = 0 then raise exception 'Ajuste de conv_push_alerta não aplicado'; end if;
    execute src;
  end if;
end $do$;

-- ---------- Histórico do lead: status trocado pela IA aparece como "pela IA" ----------
do $do$
declare src text;
begin
  src := pg_get_functiondef('private.leads_fase1_historico()'::regprocedure);
  if position('memude.ia' in src) = 0 then
    src := replace(src,
      $a$insert into public.lead_eventos (lead_id, tipo, campo, de, para, ator_id) values (new.id, 'status', 'Status', old.status_atendimento, new.status_atendimento, ator);$a$,
      $a$insert into public.lead_eventos (lead_id, tipo, campo, de, para, observacao, ator_id) values (new.id, 'status', 'Status', old.status_atendimento, new.status_atendimento,
      case when current_setting('memude.ia', true) = '1' then 'Atualizado pela IA a partir da conversa' end, ator);$a$);
    if position('memude.ia' in src) = 0 then raise exception 'Ajuste de leads_fase1_historico não aplicado'; end if;
    execute src;
  end if;
end $do$;

-- ---------- Aplicação automática (chamada só pela função conversas-ia, com a chave de serviço) ----------
create or replace function public.ia_aplicar_ficha(p_conversa uuid, p_lead uuid, p_status text, p_qualificacao jsonb, p_evidencias jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  ld public.leads;
  atual jsonb;
  novos jsonb := '{}'::jsonb;
  aplicados jsonb := '[]'::jsonb;
  conferir jsonb := '{}'::jsonb;
  grave text;
  k text; v text; cur text; dono_ia boolean;
  ordem constant jsonb := '{"NOVO": 0, "EM CONVERSA": 1, "INTERESSADO": 2}';
  ev jsonb := coalesce(p_evidencias, '{}'::jsonb);
begin
  select * into ld from public.leads where id = p_lead and deleted_at is null for update;
  if not found then return jsonb_build_object('aplicados', aplicados, 'conferir', conferir); end if;
  atual := coalesce(ld.qualificacao, '{}'::jsonb);

  -- Qualificação: preenche o que está vazio ou o que a própria IA preencheu antes
  for k, v in select key, btrim(value) from jsonb_each_text(coalesce(p_qualificacao, '{}'::jsonb)) loop
    continue when k not in ('renda', 'entrada_fgts', 'prazo', 'finalidade', 'regiao') or nullif(v, '') is null;
    cur := nullif(btrim(coalesce(atual->>k, '')), '');
    continue when lower(coalesce(cur, '')) = lower(v);
    -- Já desfeito por alguém: a IA não insiste
    continue when exists (select 1 from public.lead_ia_mudancas m where m.lead_id = p_lead and m.campo = k
      and m.desfeita_em is not null and lower(m.para) = lower(v));
    dono_ia := cur is null or exists (
      select 1 from (select m.para from public.lead_ia_mudancas m where m.lead_id = p_lead and m.campo = k and m.desfeita_em is null
        order by m.criado_em desc limit 1) ult where ult.para = cur);
    if dono_ia then
      novos := novos || jsonb_build_object(k, v);
      insert into public.lead_ia_mudancas (lead_id, conversa_id, campo, de, para, evidencia)
      values (p_lead, p_conversa, k, cur, left(v, 200), left(nullif(btrim(coalesce(ev->>k, '')), ''), 300));
      aplicados := aplicados || jsonb_build_object('campo', k, 'de', cur, 'para', v);
    else
      conferir := conferir || jsonb_build_object(k, v);   -- uma pessoa preencheu: só sugere
    end if;
  end loop;

  -- Status: só para frente e só até INTERESSADO; o resto é grave ou é do sistema (visita agendada)
  v := nullif(btrim(coalesce(p_status, '')), '');
  if v is not null and v is distinct from ld.status_atendimento then
    if v in ('NÃO INTERESSADO', 'SEM RENDA') then
      grave := v;
    elsif ordem ? v and (ld.status_atendimento is null or (ordem ? ld.status_atendimento and (ordem->>v)::int > (ordem->>ld.status_atendimento)::int))
      and not exists (select 1 from public.lead_ia_mudancas m where m.lead_id = p_lead and m.campo = 'status_atendimento'
        and m.desfeita_em is not null and m.para = v) then
      insert into public.lead_ia_mudancas (lead_id, conversa_id, campo, de, para, evidencia)
      values (p_lead, p_conversa, 'status_atendimento', ld.status_atendimento, v, left(nullif(btrim(coalesce(ev->>'status_crm', '')), ''), 300));
      aplicados := aplicados || jsonb_build_object('campo', 'status_atendimento', 'de', ld.status_atendimento, 'para', v);
    else
      v := null;
    end if;
  else
    v := null;
  end if;

  if novos <> '{}'::jsonb or (v is not null and grave is null) then
    perform set_config('memude.fase1', '1', true);
    perform set_config('memude.ia', '1', true);
    update public.leads l set
      status_atendimento = case when grave is null and v is not null then v else l.status_atendimento end,
      qualificacao = case when novos <> '{}'::jsonb
        then jsonb_strip_nulls(coalesce(l.qualificacao, '{}'::jsonb) || novos || jsonb_build_object('atualizado_em', now()))
        else l.qualificacao end
    where l.id = p_lead;
    perform set_config('memude.ia', '0', true);
  end if;

  return jsonb_build_object('aplicados', aplicados, 'conferir', conferir, 'grave', grave);
end $$;
revoke all on function public.ia_aplicar_ficha(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ia_aplicar_ficha(uuid, uuid, text, jsonb, jsonb) to service_role;

-- ---------- Desfazer (equipe comercial) ----------
create or replace function public.ia_mudanca_desfazer(p_mudanca uuid)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  u uuid := auth.uid(); m public.lead_ia_mudancas; ld public.leads; cur text;
  rotulo constant jsonb := '{"status_atendimento": "Status", "renda": "Renda", "entrada_fgts": "Entrada/FGTS", "prazo": "Prazo", "finalidade": "Finalidade", "regiao": "Região"}';
begin
  if u is null or not private.is_comercial() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select * into m from public.lead_ia_mudancas where id = p_mudanca for update;
  if not found then raise exception 'Mudança não encontrada' using errcode = 'P0002'; end if;
  if m.desfeita_em is not null then raise exception 'Esta mudança já foi desfeita' using errcode = '22023'; end if;
  select * into ld from public.leads where id = m.lead_id and deleted_at is null for update;
  if not found then raise exception 'Lead não encontrado' using errcode = 'P0002'; end if;

  cur := case when m.campo = 'status_atendimento' then ld.status_atendimento else ld.qualificacao->>m.campo end;
  if cur is distinct from m.para then
    raise exception 'A ficha já mudou depois disso. Edite o campo direto na ficha.' using errcode = '22023';
  end if;

  perform set_config('memude.fase1', '1', true);
  if m.campo = 'status_atendimento' then
    update public.leads set status_atendimento = coalesce(m.de, 'NOVO') where id = ld.id;
  else
    update public.leads set qualificacao = case when m.de is null then coalesce(qualificacao, '{}'::jsonb) - m.campo
      else coalesce(qualificacao, '{}'::jsonb) || jsonb_build_object(m.campo, m.de) end where id = ld.id;
  end if;
  update public.lead_ia_mudancas set desfeita_em = now(), desfeita_por = u where id = m.id;
  if m.campo <> 'status_atendimento' then   -- o status já entra no histórico pelo gatilho do lead
    insert into public.lead_eventos (lead_id, tipo, campo, de, para, observacao, ator_id)
    values (ld.id, 'alteracao', coalesce(rotulo->>m.campo, m.campo), m.para, m.de, 'Desfeito: a IA tinha preenchido', u);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.ia_mudanca_desfazer(uuid) from public, anon;
grant execute on function public.ia_mudanca_desfazer(uuid) to authenticated;

-- ---------- Limpeza: sugestões trocadas ou descartadas há mais de 90 dias (o banco não acumula lixo) ----------
do $do$
begin
  perform cron.unschedule('ia-limpeza-sugestoes') where exists (select 1 from cron.job where jobname = 'ia-limpeza-sugestoes');
  perform cron.schedule('ia-limpeza-sugestoes', '15 6 * * *', $cron$
    delete from public.ia_sugestoes where status in ('substituida', 'descartada') and criada_em < now() - interval '90 days';
  $cron$);
end $do$;
