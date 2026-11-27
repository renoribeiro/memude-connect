-- 1) Mensagens automáticas ao cliente: cada mensagem liga/desliga nos Ajustes (padrão: MSG 1 ao agendar e MSG 3 quando o corretor aceita)
-- 2) Comissão: divisão do corretor editável na venda (padrão 50%); valores calculados pelo banco a partir dela
-- 3) Corretor pede ajuda ao closer (alerta no Connect + aviso no celular)
-- 4) Agenda: link privado (iCal) para assinar as visitas no Google Agenda, iPhone e Outlook

-- ========== 1) Mensagens automáticas por modelo ==========
alter table public.fase1_config add column if not exists mensagens_auto_modelos text[] not null default array['msg1', 'msg3'];

do $do$
declare src text;
begin
  src := pg_get_functiondef('public.vma_reivindicar(integer)'::regprocedure);
  if position('mensagens_auto_modelos' in src) = 0 then
    src := replace(src, E'    return saida;\n  end if;\n', E'    return saida;\n  end if;\n'
      || E'  -- Só as mensagens ligadas nos Ajustes saem; as outras são canceladas\n'
      || E'  update public.visita_mensagens_auto set status = ''cancelada'', erro = ''Mensagem desligada nos Ajustes''\n'
      || E'    where status = ''agendada'' and enviar_em <= now() and not (template = any (coalesce(cfg.mensagens_auto_modelos, ''{}''::text[])));\n');
    if position('mensagens_auto_modelos' in src) = 0 then raise exception 'vma_reivindicar não ajustada'; end if;
    execute src;
  end if;
end $do$;

-- ========== 2) Divisão da comissão ==========
create temporary table _vendas_antes on commit drop as select id, valor_corretor, valor_memude from public.vendas;

alter table public.vendas add column if not exists percentual_corretor numeric(5,2) not null default 50;
alter table public.vendas drop constraint if exists vendas_percentual_corretor_check;
alter table public.vendas add constraint vendas_percentual_corretor_check check (percentual_corretor >= 0 and percentual_corretor <= 100);

alter table public.vendas alter column valor_corretor set expression as (
  case when corretor_id is not null then
    (((valor_imovel * comissao_percentual) / 100::numeric) - ((((valor_imovel * comissao_percentual) / 100::numeric) * imposto_percentual) / 100::numeric))
    * percentual_corretor / 100::numeric
  else 0::numeric end);
alter table public.vendas alter column valor_memude set expression as (
  case when corretor_id is not null then
    (((valor_imovel * comissao_percentual) / 100::numeric) - ((((valor_imovel * comissao_percentual) / 100::numeric) * imposto_percentual) / 100::numeric))
    * (100::numeric - percentual_corretor) / 100::numeric
  else ((valor_imovel * comissao_percentual) / 100::numeric) - ((((valor_imovel * comissao_percentual) / 100::numeric) * imposto_percentual) / 100::numeric) end);

-- Segurança: nenhuma venda existente pode mudar de valor
do $do$
begin
  if exists (select 1 from public.vendas v join _vendas_antes a using (id)
             where round(v.valor_corretor, 2) is distinct from round(a.valor_corretor, 2)
                or round(v.valor_memude, 2) is distinct from round(a.valor_memude, 2)) then
    raise exception 'Valores das vendas mudaram; nada foi aplicado';
  end if;
end $do$;

-- Venda pelo CRM também grava a divisão
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.complete_crm_sale(uuid,jsonb)'::regprocedure);
  if position('percentual_corretor' in src) = 0 then
    src := replace(src, 'created_by,comprovantes)', 'created_by,comprovantes,percentual_corretor)');
    src := replace(src, $a$ARRAY(SELECT jsonb_array_elements_text(coalesce(p_sale->'comprovantes','[]'::jsonb)))) RETURNING id INTO sale_id;$a$,
      $a$ARRAY(SELECT jsonb_array_elements_text(coalesce(p_sale->'comprovantes','[]'::jsonb))),
    least(100, greatest(0, coalesce(nullif(p_sale->>'percentual_corretor','')::numeric, 50)))) RETURNING id INTO sale_id;$a$);
    if (length(src) - length(replace(src, 'percentual_corretor', ''))) / 19 < 2 then raise exception 'complete_crm_sale não ajustada'; end if;
    execute src;
  end if;
end $do$;

-- Comissões do corretor passam a mostrar a parte dele (%)
drop function if exists public.corretor_minhas_comissoes();
create function public.corretor_minhas_comissoes()
returns table(venda_id uuid, cliente text, empreendimento text, imagem text, data_venda date, valor_imovel numeric,
  comissao_percentual numeric, imposto_percentual numeric, valor_comissao_bruta numeric, valor_imposto numeric,
  valor_corretor numeric, status text, data_pagamento date, observacoes text, tem_comprovante boolean, atualizado_em timestamptz,
  percentual_corretor numeric)
language plpgsql stable security definer set search_path to '' as $$
declare cid uuid := private.conv_user_corretor(auth.uid());
begin
  if cid is null then raise exception 'Acesso do corretor não encontrado' using errcode = '42501'; end if;
  return query
  select s.id, l.nome, e.nome, e.imagem_url, s.data_venda, s.valor_imovel, s.comissao_percentual, s.imposto_percentual,
    s.valor_comissao_bruta, s.valor_imposto, s.valor_corretor, s.status::text, s.data_pagamento, s.observacoes,
    coalesce(cardinality(s.comprovantes), 0) > 0, s.updated_at, s.percentual_corretor
  from public.vendas s
  left join public.leads l on l.id = s.lead_id
  left join public.empreendimentos e on e.id = s.empreendimento_id
  where s.corretor_id = cid
  order by s.data_venda desc nulls last, s.created_at desc;
end $$;
revoke all on function public.corretor_minhas_comissoes() from public, anon;
grant execute on function public.corretor_minhas_comissoes() to authenticated;

-- ========== 3) Pedir ajuda ao closer ==========
alter table public.conv_alertas drop constraint if exists conv_alertas_tipo_check;
alter table public.conv_alertas add constraint conv_alertas_tipo_check check (tipo = any (array['sem_resposta', 'pos_visita_esquecido',
  'sinal_compra', 'contato_pessoal', 'numero_caiu', 'confirmar_ia', 'pedido_ajuda']));
alter table public.conv_alertas add column if not exists contato text;
alter table public.conv_alertas add column if not exists solicitante_id uuid references auth.users(id) on delete set null;

create or replace function public.corretor_pedir_ajuda(p_assunto text, p_texto text default null, p_conversa uuid default null, p_urgente boolean default false)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  u uuid := auth.uid(); cfg public.fase1_config; nome text; fone text; v_lead uuid; cliente text;
  t text := btrim(coalesce(p_texto, '')); assunto text; novo uuid;
begin
  if u is null then raise exception 'Faça login' using errcode = '42501'; end if;
  assunto := case p_assunto when 'fechamento' then 'ajuda no fechamento' when 'comercial' then 'suporte comercial'
    when 'duvida' then 'tirar uma dúvida' end;
  if assunto is null then raise exception 'Escolha o tipo de ajuda' using errcode = '22023'; end if;
  if length(t) > 600 then raise exception 'Escreva em até 600 caracteres' using errcode = '22023'; end if;
  if (select count(*) from public.conv_alertas where solicitante_id = u and tipo = 'pedido_ajuda' and criado_em > now() - interval '1 hour') >= 5 then
    raise exception 'Você já pediu ajuda 5 vezes na última hora. O closer vai falar com você.' using errcode = '22023';
  end if;
  if p_conversa is not null then
    perform private.conv_exigir_ver(p_conversa);
    select c.lead_id, coalesce(nullif(l.nome, ''), c.nome_contato) into v_lead, cliente
    from public.conversas c left join public.leads l on l.id = c.lead_id where c.id = p_conversa;
  end if;
  select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), coalesce(co.whatsapp, co.telefone, p.phone) into nome, fone
  from public.profiles p left join public.corretores co on co.profile_id = p.id and co.deleted_at is null
  where p.user_id = u limit 1;
  select * into cfg from public.fase1_config where id;

  insert into public.conv_alertas (tipo, conversa_id, lead_id, responsavel_id, titulo, detalhe, contato, solicitante_id)
  values ('pedido_ajuda', p_conversa, v_lead, cfg.closer_user_id,
    left(case when p_urgente then 'AGORA · ' else '' end || coalesce(nome, 'Corretor') || ' pediu ' || assunto, 200),
    nullif(left(concat_ws(' · ', 'Cliente: ' || cliente, nullif(t, '')), 600), ''), fone, u)
  -- Pedido ainda aberto sobre o mesmo cliente: atualiza (volta para o topo) em vez de duplicar
  on conflict (tipo, conversa_id) where resolvido_em is null and conversa_id is not null
  do update set titulo = excluded.titulo, detalhe = excluded.detalhe, contato = excluded.contato,
    solicitante_id = excluded.solicitante_id, responsavel_id = excluded.responsavel_id, criado_em = now()
  returning id into novo;

  perform private.conv_push(array_remove(array[cfg.closer_user_id], null),
    case when p_urgente then 'Ajuda AGORA · ' else 'Pedido de ajuda · ' end || coalesce(nome, 'Corretor'),
    left(initcap(assunto) || coalesce(' · ' || cliente, '') || coalesce(' · ' || nullif(t, ''), ''), 200),
    '/conversas?aba=alertas', 'ajuda-' || novo, null);
  return novo;
end $$;
revoke all on function public.corretor_pedir_ajuda(text, text, uuid, boolean) from public, anon;
grant execute on function public.corretor_pedir_ajuda(text, text, uuid, boolean) to authenticated;

-- ========== 4) Agenda (iCal) ==========
create table if not exists public.agenda_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique,
  criado_em timestamptz not null default now(),
  usado_em timestamptz
);
alter table public.agenda_links enable row level security;
revoke all on public.agenda_links from anon, authenticated;

-- Meu link (cria na primeira vez; p_trocar = true invalida o anterior)
create or replace function public.minha_agenda_link(p_trocar boolean default false)
returns text language plpgsql security definer set search_path to '' as $$
declare u uuid := auth.uid(); t text;
begin
  if u is null then raise exception 'Faça login' using errcode = '42501'; end if;
  if not p_trocar then
    select token into t from public.agenda_links where user_id = u;
    if t is not null then return t; end if;
  end if;
  t := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.agenda_links (user_id, token) values (u, t)
  on conflict (user_id) do update set token = excluded.token, criado_em = now(), usado_em = null;
  return t;
end $$;
revoke all on function public.minha_agenda_link(boolean) from public, anon;
grant execute on function public.minha_agenda_link(boolean) to authenticated;

-- Eventos do link (só o servidor chama). Corretor: as visitas dele e os lembretes. Equipe: todas as visitas.
create or replace function public.agenda_feed(p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare u uuid; cid uuid; equipe boolean; eventos jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{48}$' then return null; end if;
  update public.agenda_links set usado_em = now() where token = p_token returning user_id into u;
  if u is null then return null; end if;
  cid := private.conv_user_corretor(u);
  equipe := exists (select 1 from public.user_roles r where r.user_id = u and r.role::text in ('admin', 'sdr', 'closer'));
  if cid is null and not equipe then return jsonb_build_object('nome', 'MeMude', 'eventos', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(x order by x->>'inicio'), '[]'::jsonb) into eventos from (
    select jsonb_build_object(
      'id', 'visita-' || v.id,
      'inicio', private.f1_inicio(v.data_visita, v.horario_visita),
      'minutos', 60,
      'titulo', 'Visita · ' || coalesce(split_part(btrim(l.nome), ' ', 1), 'Cliente') || coalesce(' · ' || e.nome, '')
        || case when cid is null or v.corretor_id is distinct from cid then coalesce(' (' || nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '') || ')', '') else '' end
        || case when v.status = 'aguardando_corretor' then ' · aguardando corretor' else '' end,
      'local', coalesce(nullif(v.meeting_address, ''), nullif(v.local_nome, ''), e.nome),
      'descricao', concat_ws(E'\n', 'Cliente: ' || l.nome, 'Empreendimento: ' || e.nome,
        'Ponto de encontro: ' || nullif(v.local_nome, ''), 'Abrir no app: https://core.memudecore.com.br/' || case when cid is not null then 'app/agenda' else 'visitas' end)
    ) as x
    from public.visitas v
    left join public.leads l on l.id = v.lead_id
    left join public.empreendimentos e on e.id = v.empreendimento_id
    left join public.corretores co on co.id = v.corretor_id
    left join public.profiles p on p.id = co.profile_id
    where v.deleted_at is null
      and v.status in ('aguardando_corretor', 'agendada', 'confirmada', 'realizada')
      and v.data_visita between current_date - 30 and current_date + 180
      and ((cid is not null and v.corretor_id = cid and v.status <> 'aguardando_corretor') or (cid is null and equipe and coalesce(v.fase1, false)))
    union all
    select jsonb_build_object('id', 'lembrete-' || t.id, 'inicio', t.disponivel_em, 'minutos', 15,
      'titulo', 'Lembrete · ' || t.titulo || coalesce(' · ' || split_part(btrim(l.nome), ' ', 1), ''),
      'local', null, 'descricao', 'Lembrete criado no app MeMude')
    from public.tarefas t left join public.leads l on l.id = t.lead_id
    where t.dono_id = u and t.tipo = 'atividade' and t.status = 'pendente'
      and t.disponivel_em between now() - interval '7 days' and now() + interval '180 days'
  ) s;
  return jsonb_build_object('nome', case when cid is not null then 'MeMude · Minhas visitas' else 'MeMude · Visitas da equipe' end, 'eventos', eventos);
end $$;
revoke all on function public.agenda_feed(text) from public, anon, authenticated;
grant execute on function public.agenda_feed(text) to service_role;
