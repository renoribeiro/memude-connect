-- ============================================================
-- Ajustes do Connect (18/11/2026)
-- 1) Retorno pós-visita: o próximo passo vira uma ATIVIDADE com data e horário
--    (tarefa tipo 'atividade', que aparece na Agenda e na tela Hoje). Data da venda sai do formulário.
-- 2) Kanban: ao agendar visita, o card recebe a etiqueta do mês da visita ("Novembro/26"),
--    no mesmo padrão e cores dos cards existentes.
-- 3) Notas do lead entram no histórico (lead_eventos tipo 'nota').
-- 4) painel_apresentacao: dados das novas telas da apresentação do Dashboard.
-- ============================================================

-- ---------- 1) Próximo passo = atividade agendada ----------
alter table public.tarefas drop constraint if exists tarefas_tipo_check;
alter table public.tarefas add constraint tarefas_tipo_check check (tipo = any (array[
  'aceite_corretor', 'confirmacao_d2', 'confirmacao_d1', 'confirmacao_d0', 'registrar_resultado', 'retorno',
  'proximo_passo', 'remarcar_no_show', 'escalada', 'manual', 'atividade']));

create index if not exists tarefas_disponivel_em_idx on public.tarefas (disponivel_em) where tipo in ('atividade', 'manual');

create or replace function public.visita_registrar_retorno(p_visita_id uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ator uuid := private.f1_exigir_comercial();
  v public.visitas;
  v_nota int := nullif(p_dados->>'nota', '')::int;
  v_impressao text := nullif(btrim(coalesce(p_dados->>'impressao', '')), '');
  v_feedback text := nullif(btrim(coalesce(p_dados->>'feedback_corretor', '')), '');
  v_proximo text := nullif(btrim(coalesce(p_dados->>'proximo_passo', '')), '');
  v_quando timestamptz := nullif(p_dados->>'proximo_passo_em', '')::timestamptz;
  v_tem_atividade boolean;
  v_tarefa uuid;
begin
  perform set_config('memude.fase1', '1', true);
  v := private.f1_visita(p_visita_id);
  if v.status <> 'realizada' then
    raise exception 'O retorno só pode ser registrado em visita realizada' using errcode = '22023';
  end if;
  if v_nota is not null and v_nota not between 1 and 5 then
    raise exception 'A nota do cliente vai de 1 a 5' using errcode = '22023';
  end if;
  if length(coalesce(v_impressao,'')) > 4000 or length(coalesce(v_feedback,'')) > 4000 or length(coalesce(v_proximo,'')) > 200 then
    raise exception 'Texto muito longo' using errcode = '22023';
  end if;

  -- Próximo passo obrigatório: uma atividade com data e horário (fica na agenda)
  select exists (select 1 from public.tarefas t where t.visita_id = v.id and t.tipo = 'atividade' and t.status <> 'cancelada')
    into v_tem_atividade;
  if v_quando is not null and v_proximo is null then
    raise exception 'Descreva a atividade do próximo passo' using errcode = '22023';
  end if;
  if v_quando is null and not v_tem_atividade then
    raise exception 'O próximo passo é obrigatório: descreva a atividade e agende data e horário' using errcode = '22023';
  end if;
  if v_quando is not null and v_quando < now() - interval '5 minutes' then
    raise exception 'Agende o próximo passo para uma data e horário futuros' using errcode = '22023';
  end if;

  update public.visitas set
    avaliacao_lead = coalesce(v_nota, avaliacao_lead),
    comentarios_lead = coalesce(v_impressao, comentarios_lead),
    feedback_corretor = coalesce(v_feedback, feedback_corretor),
    proximo_passo = case when v_quando is not null then v_proximo else proximo_passo end
  where id = v.id
  returning * into v;

  if v_quando is not null then
    insert into public.tarefas (tipo, titulo, visita_id, lead_id, dono_id, disponivel_em, vence_em, status)
    values ('atividade', left(v_proximo, 200), v.id, v.lead_id, ator, v_quando, v_quando + interval '1 hour', 'pendente')
    returning id into v_tarefa;
  end if;

  update public.visit_cycles set
    feedback = coalesce(feedback, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'nota_cliente_1a5', v.avaliacao_lead, 'impressao', v.comentarios_lead, 'next_step', v.proximo_passo)),
    feedback_at = now(),
    broker_feedback_at = case when v.feedback_corretor is not null then coalesce(broker_feedback_at, now()) else broker_feedback_at end,
    updated_at = now()
  where visita_id = v.id;

  perform private.f1_evento(v.id, 'f1_retorno', jsonb_strip_nulls(jsonb_build_object('nota', v_nota,
    'impressao', v_impressao, 'feedback_corretor', v_feedback,
    'proximo_passo', case when v_quando is not null then v_proximo end, 'proximo_passo_em', v_quando)), ator);

  if (v.avaliacao_lead is not null or v.comentarios_lead is not null) and v.feedback_corretor is not null then
    perform private.f1_fechar_tarefas(v.id, array['retorno'], 'concluida', ator, 'Retorno registrado');
  end if;
  if v_quando is not null or v_tem_atividade then
    perform private.f1_fechar_tarefas(v.id, array['proximo_passo'], 'concluida', ator, 'Próximo passo agendado');
  end if;
  return jsonb_build_object('visita_id', v.id, 'status', v.status, 'atividade_id', v_tarefa,
    'retorno_completo', (v.avaliacao_lead is not null or v.comentarios_lead is not null) and v.feedback_corretor is not null,
    'proximo_passo_definido', v_quando is not null or v_tem_atividade);
end $function$;

-- ---------- 2) Etiqueta do mês no card do Kanban ----------
create or replace function private.crm_rotulo_mes(p_data date)
returns text language sql immutable set search_path to '' as $$
  select (array['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'])
    [extract(month from p_data)::int] || '/' || to_char(p_data, 'YY');
$$;

-- Mesmas cores já usadas nos cards (abr, jun, jul, ago, out, nov); as demais com contraste >= 5:1 no texto branco.
create or replace function private.crm_cor_mes(p_mes int)
returns text language sql immutable set search_path to '' as $$
  select (array['#4338ca','#a21caf','#4d7c0f','#be123c','#c2410c','#b45309','#047857','#1d4ed8','#be185d','#7c3aed','#0e7490','#b91c1c'])[p_mes];
$$;

create or replace function private.crm_tag_com_mes(p_tag text, p_data date)
returns text language plpgsql immutable set search_path to '' as $$
declare novo text := private.crm_rotulo_mes(p_data); t text := btrim(coalesce(p_tag, ''));
begin
  if t = '' then return novo; end if;
  -- "Outubro/26" ou "Outubro/26 - Renda Informal": troca só o mês, mantém o complemento
  if t ~* '^(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/[0-9]{2}' then
    return left(regexp_replace(t, '^[^/]+/[0-9]{2}', novo), 40);
  end if;
  -- formatos antigos ("Set 25", "AGO/26")
  if t ~* '^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*[ /-]*[0-9]{2}$' then return novo; end if;
  return left(novo || ' - ' || t, 40);
end $$;

create or replace function private.crm_aplicar_mes(p_card uuid, p_data date)
returns void language plpgsql security definer set search_path to '' as $$
begin
  update public.crm_leads c set
    tag = private.crm_tag_com_mes(c.tag, p_data),
    tag_cor = private.crm_cor_mes(extract(month from p_data)::int)
  where c.id = p_card
    and (c.tag is distinct from private.crm_tag_com_mes(c.tag, p_data)
      or c.tag_cor is distinct from private.crm_cor_mes(extract(month from p_data)::int));
end $$;

create or replace function private.crm_mover_por_visita(p_visita uuid, p_alvo text, p_pode_criar boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public.visitas; v_pipe uuid; v_stage uuid; v_pos int;
  c_id uuid; c_pos int; c_visita uuid; c_tag text;
begin
  select * into v from public.visitas where id = p_visita;
  if not found or v.deleted_at is not null or v.lead_id is null then return; end if;

  select id into v_pipe from public.crm_pipelines
  where is_default = true and auto_add_visits = true order by created_at, id limit 1;
  if v_pipe is null then return; end if;

  select id, posicao into v_stage, v_pos from public.crm_stages
  where pipeline_id = v_pipe and private.f1_norm(nome) = p_alvo order by posicao limit 1;
  if v_stage is null then return; end if;

  -- Card aberto do cliente: o da própria visita primeiro, depois o mais recente
  select c.id, s.posicao, c.visita_id into c_id, c_pos, c_visita
  from public.crm_leads c join public.crm_stages s on s.id = c.stage_id
  where c.pipeline_id = v_pipe and c.lead_id = v.lead_id
    and c.archived_at is null and c.completed_at is null and c.venda_id is null
  order by (c.visita_id = v.id) desc nulls last, c.updated_at desc
  limit 1;

  if c_id is not null then
    if c_pos < v_pos then
      update public.crm_leads set
        stage_id = v_stage,
        posicao = coalesce((select max(posicao) + 1 from public.crm_leads where stage_id = v_stage), 0),
        visita_id = case when c_visita is null and not exists (
            select 1 from public.crm_leads o where o.pipeline_id = v_pipe and o.visita_id = v.id) then v.id else visita_id end,
        empreendimento_id = coalesce(empreendimento_id, v.empreendimento_id),
        moved_at = now(), updated_at = now()
      where id = c_id;
    end if;
  elsif p_pode_criar then
    insert into public.crm_leads (lead_id, pipeline_id, stage_id, empreendimento_id, visita_id, posicao)
    values (v.lead_id, v_pipe, v_stage, v.empreendimento_id, v.id,
      coalesce((select max(posicao) + 1 from public.crm_leads where stage_id = v_stage), 0))
    on conflict (pipeline_id, visita_id) where visita_id is not null do nothing
    returning id into c_id;
    if c_id is null then
      select id into c_id from public.crm_leads where pipeline_id = v_pipe and visita_id = v.id;
    end if;
  end if;

  -- Etiqueta do mês da visita agendada (só a visita mais recente do cliente manda no mês;
  -- importações de visitas antigas não voltam a etiqueta para trás)
  if c_id is not null and not exists (
      select 1 from public.visitas o where o.lead_id = v.lead_id and o.id <> v.id and o.deleted_at is null
        and o.status not in ('cancelada', 'reagendada') and o.data_visita > v.data_visita) then
    select tag into c_tag from public.crm_leads where id = c_id;
    if p_alvo = 'visita agendada' or c_tag is null or btrim(c_tag) = '' then
      perform private.crm_aplicar_mes(c_id, v.data_visita);
    end if;
  end if;
end $function$;

-- Mudou só a data da visita (mesma visita): atualiza o mês da etiqueta
create or replace function private.crm_visita_data_kanban()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if NEW.status in ('aguardando_corretor', 'agendada', 'confirmada') then
    perform private.crm_mover_por_visita(NEW.id, 'visita agendada', false);
  end if;
  return NEW;
end $$;

drop trigger if exists crm_kanban_data_visita on public.visitas;
create trigger crm_kanban_data_visita
  after update of data_visita on public.visitas
  for each row when (old.data_visita is distinct from new.data_visita)
  execute function private.crm_visita_data_kanban();

-- Backup das etiquetas antes do ajuste em massa (reverter: supabase/rollback/fase1_reverter.sql)
create schema if not exists backup_20261118;
create table if not exists backup_20261118.crm_leads_etiqueta as select id, tag, tag_cor from public.crm_leads;

-- Cards sem etiqueta que têm visita: mês da visita mais recente do cliente
update public.crm_leads c set
  tag = private.crm_rotulo_mes(x.data_visita),
  tag_cor = private.crm_cor_mes(extract(month from x.data_visita)::int)
from (
  select distinct on (c2.id) c2.id, vi.data_visita
  from public.crm_leads c2
  join public.visitas vi on vi.lead_id = c2.lead_id and vi.deleted_at is null and vi.status not in ('cancelada', 'reagendada')
  where c2.archived_at is null and (c2.tag is null or btrim(c2.tag) = '')
  order by c2.id, vi.data_visita desc
) x
where c.id = x.id;

-- Etiquetas de mês já existentes sem cor (ex.: "Setembro/26") recebem a cor do mês
update public.crm_leads set tag_cor = private.crm_cor_mes(array_position(
    array['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'],
    private.f1_norm(split_part(tag, '/', 1))))
where tag_cor is null
  and private.f1_norm(split_part(tag, '/', 1)) = any (array['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])
  and tag ~ '/[0-9]{2}';

-- ---------- 3) Notas do lead no histórico ----------
create or replace function public.lead_adicionar_nota(p_lead_id uuid, p_texto text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare ator uuid := private.f1_exigir_comercial(); t text := btrim(coalesce(p_texto, '')); v_id uuid;
begin
  if length(t) < 2 then raise exception 'Escreva a nota' using errcode = '22023'; end if;
  if length(t) > 2000 then raise exception 'Nota muito longa (máximo 2000 caracteres)' using errcode = '22023'; end if;
  if not exists (select 1 from public.leads where id = p_lead_id and deleted_at is null) then
    raise exception 'Lead não encontrado' using errcode = 'P0002';
  end if;
  insert into public.lead_eventos (lead_id, tipo, campo, observacao, ator_id)
  values (p_lead_id, 'nota', 'Nota', t, ator) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

revoke all on function public.lead_adicionar_nota(uuid, text) from public, anon;
grant execute on function public.lead_adicionar_nota(uuid, text) to authenticated;

-- ---------- 4) Dados da apresentação ----------
create or replace function public.painel_apresentacao(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare v_out jsonb;
begin
  if not private.is_comercial() then raise exception 'Acesso restrito à equipe comercial' using errcode = '42501'; end if;
  if p_de is null or p_ate is null or p_ate < p_de or (p_ate - p_de) > 400 then
    raise exception 'Período inválido' using errcode = '22023';
  end if;

  with
  l as (
    select ld.id, coalesce(nullif(btrim(ld.fonte), ''), 'Outros') as fonte,
      upper(coalesce(nullif(btrim(ld.planilha_extra->>'status_label'), ''), nullif(btrim(ld.status_atendimento), ''), 'NOVO')) as status,
      private.f1_norm(coalesce(ld.planilha_extra->>'status_label', ld.status_atendimento)) as st
    from public.leads ld
    where ld.deleted_at is null and ld.data_entrada between p_de and p_ate
  ),
  lq as (
    select l.*, (l.st in ('em conversa', 'interessado', 'visita agendada', 'documentacao', 'doc aprovada', 'negociacao',
        'ja comprou', 'vendido', 'vendido!')
      or exists (select 1 from public.visitas x where x.lead_id = l.id and x.deleted_at is null)) as qualificado
    from l
  ),
  s as (
    select ve.id, ve.data_venda, ve.data_pagamento, ve.valor_imovel, ve.valor_comissao_liquida, ve.valor_memude,
      ld.nome as cliente, coalesce(nullif(btrim(ld.fonte), ''), 'Outros') as fonte, ld.data_entrada,
      e.nome as empreendimento,
      coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Sem corretor') as corretor
    from public.vendas ve
    left join public.leads ld on ld.id = ve.lead_id
    left join public.empreendimentos e on e.id = ve.empreendimento_id
    left join public.corretores c on c.id = ve.corretor_id
    left join public.profiles p on p.id = c.profile_id
    where ve.data_venda between p_de and p_ate and ve.status::text <> 'cancelada'
  ),
  v as (
    select vi.id, vi.status, vi.data_visita,
      coalesce(nullif(btrim(ld.fonte), ''), 'Outros') as fonte,
      coalesce(e.nome, 'Sem empreendimento') as empreendimento,
      coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Sem corretor definido') as corretor,
      case when concat_ws(' ', vi.meeting_address, vi.local_nome, vi.planilha_extra->'original'->>'local')
        ~* '(online|v[ií]deo|videochamada|remot)' then 'Online' else 'Presencial' end as formato,
      coalesce(nullif(btrim(vi.planilha_extra->>'status_label'), ''), nullif(btrim(vi.motivo_cancelamento), '')) as rotulo
    from public.visitas vi
    left join public.leads ld on ld.id = vi.lead_id
    left join public.empreendimentos e on e.id = vi.empreendimento_id
    left join public.corretores c on c.id = vi.corretor_id
    left join public.profiles p on p.id = c.profile_id
    where vi.deleted_at is null and vi.data_visita between p_de and p_ate
  )
  select jsonb_build_object(
    'de', p_de, 'ate', p_ate,
    'contratos', (select coalesce(jsonb_agg(jsonb_build_object(
        'cliente', s.cliente, 'empreendimento', s.empreendimento, 'corretor', s.corretor, 'data_venda', s.data_venda,
        'recebimento', s.data_pagamento, 'origem', s.fonte, 'entrada', s.data_entrada, 'vgv', s.valor_imovel,
        'comissao_liquida', s.valor_comissao_liquida, 'valor_memude', s.valor_memude) order by s.data_venda, s.cliente), '[]'::jsonb) from s),
    'canais', (select coalesce(jsonb_agg(x order by (x->>'leads')::int desc, x->>'fonte'), '[]'::jsonb) from (
        select jsonb_build_object('fonte', f.fonte,
          'leads', (select count(*) from lq where lq.fonte = f.fonte),
          'qualificados', (select count(*) from lq where lq.fonte = f.fonte and lq.qualificado),
          'vendas', (select count(*) from s where s.fonte = f.fonte),
          'vgv', (select coalesce(sum(s.valor_imovel), 0) from s where s.fonte = f.fonte)) as x
        from (select fonte from lq union select fonte from s) f) t),
    'status_leads', (select coalesce(jsonb_agg(jsonb_build_object('status', status, 'total', n) order by n desc), '[]'::jsonb)
        from (select status, count(*) n from l group by status) t),
    'corretores_vendas', (select coalesce(jsonb_agg(jsonb_build_object('corretor', corretor, 'vendas', n, 'vgv', vgv, 'comissao_memude', memude)
        order by vgv desc), '[]'::jsonb)
        from (select corretor, count(*) n, coalesce(sum(valor_imovel), 0) vgv, coalesce(sum(valor_memude), 0) memude from s group by corretor) t),
    'visitas', (select jsonb_build_object(
        'agendadas', count(*), 'realizadas', count(*) filter (where status = 'realizada'),
        'no_show', count(*) filter (where status = 'no_show'), 'canceladas', count(*) filter (where status in ('cancelada', 'reagendada')),
        'futuras', count(*) filter (where status in ('aguardando_corretor', 'agendada', 'confirmada'))) from v),
    'nao_aconteceram', (select coalesce(jsonb_agg(jsonb_build_object('motivo', motivo, 'total', n) order by n desc, motivo), '[]'::jsonb)
        from (select coalesce(rotulo, case status when 'no_show' then 'No-show' when 'reagendada' then 'Reagendada' else 'Cancelada' end) motivo, count(*) n
              from v where status in ('no_show', 'cancelada', 'reagendada') group by 1) t),
    'realizadas_rotulos', (select coalesce(jsonb_agg(jsonb_build_object('rotulo', rotulo, 'total', n) order by n desc), '[]'::jsonb)
        from (select rotulo, count(*) n from v where status = 'realizada' and rotulo is not null group by rotulo) t),
    'comparecimento_origem', (select coalesce(jsonb_agg(jsonb_build_object('fonte', fonte, 'agendadas', a, 'realizadas', r) order by a desc, fonte), '[]'::jsonb)
        from (select fonte, count(*) a, count(*) filter (where status = 'realizada') r from v group by fonte) t),
    'comparecimento_formato', (select coalesce(jsonb_agg(jsonb_build_object('formato', formato, 'agendadas', a, 'realizadas', r) order by a desc), '[]'::jsonb)
        from (select formato, count(*) a, count(*) filter (where status = 'realizada') r from v group by formato) t),
    'corretores_visitas', (select coalesce(jsonb_agg(jsonb_build_object('corretor', corretor, 'agendadas', a, 'realizadas', r)
        order by (corretor = 'Sem corretor definido'), a desc, r desc, corretor), '[]'::jsonb)
        from (select corretor, count(*) a, count(*) filter (where status = 'realizada') r from v group by corretor) t),
    'empreendimentos_visitas', (select coalesce(jsonb_agg(jsonb_build_object('empreendimento', empreendimento, 'agendadas', a, 'realizadas', r)
        order by a desc, r desc, empreendimento), '[]'::jsonb)
        from (select empreendimento, count(*) a, count(*) filter (where status = 'realizada') r from v group by empreendimento
              order by count(*) desc, empreendimento limit 8) t),
    'semanas', (select coalesce(jsonb_agg(jsonb_build_object('inicio', ini, 'fim', fim, 'agendadas', a, 'realizadas', r) order by ini), '[]'::jsonb)
        from (select greatest(w::date, p_de) ini, least(w::date + 6, p_ate) fim,
                (select count(*) from v where v.data_visita between greatest(w::date, p_de) and least(w::date + 6, p_ate)) a,
                (select count(*) from v where v.status = 'realizada' and v.data_visita between greatest(w::date, p_de) and least(w::date + 6, p_ate)) r
              from generate_series(date_trunc('week', p_de::timestamp), p_ate::timestamp, interval '1 week') w) t),
    'evolucao', (select coalesce(jsonb_agg(jsonb_build_object('mes', to_char(m, 'YYYY-MM'), 'agendadas', a, 'realizadas', r) order by m), '[]'::jsonb)
        from (select m,
                (select count(*) from public.visitas x where x.deleted_at is null and x.data_visita >= m::date and x.data_visita < (m + interval '1 month')::date) a,
                (select count(*) from public.visitas x where x.deleted_at is null and x.status = 'realizada'
                   and x.data_visita >= m::date and x.data_visita < (m + interval '1 month')::date) r
              from generate_series(date_trunc('month', p_ate::timestamp) - interval '5 months', date_trunc('month', p_ate::timestamp), interval '1 month') m) t)
  ) into v_out;
  return v_out;
end $function$;

revoke all on function public.painel_apresentacao(date, date) from public, anon;
grant execute on function public.painel_apresentacao(date, date) to authenticated;
