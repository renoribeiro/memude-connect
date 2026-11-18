-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

alter table public.fase1_config
  add column if not exists responsaveis uuid[] not null default array['bdc44b50-38ce-400f-83e1-7255cec6f95f']::uuid[];

create or replace function private.f1_num(p numeric, p_casas int default 0)
returns text language sql immutable as $$
  select replace(round(p, p_casas)::text, '.', ',');
$$;

-- Rating 0-100 por corretor; com empreendimento calcula também a aderência ao perfil
create or replace function private.f1_rating(p_empreendimento uuid default null)
returns table (
  corretor_id uuid, nome text, whatsapp text, score numeric,
  conversao numeric, aderencia numeric, aceite numeric, nota numeric,
  realizadas integer, vendas integer, motivo text, detalhe jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg public.fase1_config;
  w_conv numeric; w_ader numeric; w_ace numeric; w_nota numeric;
  v_emp_nome text; v_construtora uuid; v_construtora_nome text;
  v_bairro uuid; v_bairro_nome text; v_vmin numeric; v_vmax numeric;
begin
  select * into cfg from public.fase1_config where id;
  w_conv := coalesce((cfg.pesos->>'conversao')::numeric, 40);
  w_ader := coalesce((cfg.pesos->>'aderencia')::numeric, 30);
  w_ace  := coalesce((cfg.pesos->>'aceite')::numeric, 15);
  w_nota := coalesce((cfg.pesos->>'nota')::numeric, 15);

  if p_empreendimento is not null then
    select e.nome, e.construtora_id, co.nome, e.bairro_id, b.nome, e.valor_min, e.valor_max
      into v_emp_nome, v_construtora, v_construtora_nome, v_bairro, v_bairro_nome, v_vmin, v_vmax
    from public.empreendimentos e
    left join public.construtoras co on co.id = e.construtora_id
    left join public.bairros b on b.id = e.bairro_id
    where e.id = p_empreendimento;
  end if;

  return query
  with realizadas as (
    select v.corretor_id as cid, v.empreendimento_id as eid, v.avaliacao_lead as nota_cliente
    from public.visitas v
    left join public.visit_cycles cy on cy.visita_id = v.id
    where v.deleted_at is null and v.corretor_id is not null
      and (v.status = 'realizada' or cy.outcome = 'held')
  ),
  vendas_ok as (
    select s.corretor_id as cid, s.empreendimento_id as eid, s.valor_imovel
    from public.vendas s
    where s.corretor_id is not null and coalesce(s.status::text, '') not in ('cancelada','cancelado')
  ),
  respostas as (
    select x.corretor_id as cid, (x.resposta = 'aceitou') as aceitou
    from public.visita_convites x where x.resposta in ('aceitou','recusou')
    union all
    select m.corretor_id, (m.status = 'accepted')
    from public.visit_match_attempts m where m.status in ('accepted','declined')
  ),
  glob as (
    select
      least((select count(*) from vendas_ok)::numeric / nullif((select count(*) from realizadas), 0), 1) as conv,
      (select avg(case when aceitou then 1.0 else 0.0 end) from respostas) as ace,
      (select avg(nota_cliente) from realizadas where nota_cliente is not null) as nota
  ),
  base as (
    select c.id,
      btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) as nome,
      c.whatsapp,
      (select count(*) from realizadas r where r.cid = c.id)::int as n_real,
      (select count(*) from vendas_ok s where s.cid = c.id)::int as n_vendas,
      (select count(*) from respostas x where x.cid = c.id and x.aceitou)::int as n_ace,
      (select count(*) from respostas x where x.cid = c.id and not x.aceitou)::int as n_rec,
      (select avg(r.nota_cliente) from realizadas r where r.cid = c.id and r.nota_cliente is not null) as media_nota,
      (select count(*) from vendas_ok s where s.cid = c.id and s.eid = p_empreendimento)::int as vendas_emp,
      (select count(*) from realizadas r where r.cid = c.id and r.eid = p_empreendimento)::int as real_emp,
      (v_construtora is not null and (
        exists (select 1 from public.corretor_construtoras cc where cc.corretor_id = c.id and cc.construtora_id = v_construtora)
        or exists (select 1 from vendas_ok s join public.empreendimentos e on e.id = s.eid where s.cid = c.id and e.construtora_id = v_construtora)
        or exists (select 1 from realizadas r join public.empreendimentos e on e.id = r.eid where r.cid = c.id and e.construtora_id = v_construtora)
      )) as mesma_construtora,
      (v_bairro is not null and exists (select 1 from public.corretor_bairros cb where cb.corretor_id = c.id and cb.bairro_id = v_bairro)) as mesmo_bairro,
      ((v_vmin is not null or v_vmax is not null) and (
        exists (select 1 from vendas_ok s where s.cid = c.id and s.valor_imovel
                between coalesce(v_vmin, v_vmax) * 0.85 and coalesce(v_vmax, v_vmin) * 1.15)
        or exists (select 1 from realizadas r join public.empreendimentos e on e.id = r.eid where r.cid = c.id
                   and e.valor_min <= coalesce(v_vmax, v_vmin) * 1.15 and e.valor_max >= coalesce(v_vmin, v_vmax) * 0.85)
      )) as mesma_faixa
    from public.corretores c
    join public.profiles p on p.id = c.profile_id
    where c.deleted_at is null and c.status = 'ativo' and c.sugerir_em_visitas
  ),
  crit as (
    select b.*,
      (b.n_real >= cfg.min_visitas_historico) as historico_proprio,
      case when b.n_real >= cfg.min_visitas_historico
        then least(b.n_vendas::numeric / b.n_real, 1) * 100 else g.conv * 100 end as v_conv,
      case when b.n_real >= cfg.min_visitas_historico
        then case when b.n_ace + b.n_rec > 0 then b.n_ace * 100.0 / (b.n_ace + b.n_rec) end
        else g.ace * 100 end as v_ace,
      case when b.n_real >= cfg.min_visitas_historico
        then b.media_nota / 5 * 100 else g.nota / 5 * 100 end as v_nota,
      case when p_empreendimento is null then null
        when b.vendas_emp > 0 or b.real_emp > 0 then 100
        when b.mesma_construtora then 70
        when b.mesmo_bairro or b.mesma_faixa then 40
        else 0 end::numeric as v_ader
    from base b cross join glob g
  ),
  pesos as (
    select c.*,
      (case when c.v_conv is not null then w_conv else 0 end
       + case when c.v_ader is not null then w_ader else 0 end
       + case when c.v_ace is not null then w_ace else 0 end
       + case when c.v_nota is not null then w_nota else 0 end) as w_total
    from crit c
  )
  select p.id, p.nome, p.whatsapp,
    round(case when p.w_total > 0 then
      (coalesce(w_conv * p.v_conv, 0) + coalesce(w_ader * p.v_ader, 0)
       + coalesce(w_ace * p.v_ace, 0) + coalesce(w_nota * p.v_nota, 0)) / p.w_total end, 1),
    round(p.v_conv, 1), round(p.v_ader, 1), round(p.v_ace, 1), round(p.v_nota, 1),
    p.n_real, p.n_vendas,
    coalesce(nullif(array_to_string(array_remove(array[
      case when p_empreendimento is null then null
        when p.vendas_emp > 0 then format('%s %s no %s', p.vendas_emp, case when p.vendas_emp = 1 then 'venda' else 'vendas' end, v_emp_nome)
        when p.real_emp > 0 then format('%s %s no %s', p.real_emp, case when p.real_emp = 1 then 'visita realizada' else 'visitas realizadas' end, v_emp_nome)
        when p.mesma_construtora then format('Atua com a %s', coalesce(v_construtora_nome, 'mesma construtora'))
        when p.mesmo_bairro then format('Atende o bairro %s', coalesce(v_bairro_nome, 'do empreendimento'))
        when p.mesma_faixa then 'Já atuou nessa faixa de preço'
      end,
      case when p.historico_proprio and p.n_vendas > 0
        then format('Conversão %s%% (%s de %s visitas)', private.f1_num(p.v_conv), p.n_vendas, p.n_real) end,
      case when p.historico_proprio and p.v_ace is not null
        then format('Aceita %s%% dos convites', private.f1_num(p.v_ace)) end,
      case when p.historico_proprio and p.media_nota is not null
        then format('Nota dos clientes %s/5', private.f1_num(p.media_nota, 1)) end,
      case when not p.historico_proprio and p.n_vendas > 0
        then format('%s %s no total', p.n_vendas, case when p.n_vendas = 1 then 'venda' else 'vendas' end) end,
      case when not p.historico_proprio
        then 'Pouco histórico: usa a média geral' end
    ], null), ' · '), ''), 'Sem histórico ainda'),
    jsonb_build_object(
      'conversao', round(p.v_conv, 1), 'aderencia', round(p.v_ader, 1),
      'aceite', round(p.v_ace, 1), 'nota', round(p.v_nota, 1),
      'realizadas', p.n_real, 'vendas', p.n_vendas, 'aceites', p.n_ace, 'recusas', p.n_rec,
      'historico_proprio', p.historico_proprio,
      'pesos_efetivos', jsonb_build_object(
        'conversao', case when p.v_conv is null or p.w_total = 0 then 0 else round(w_conv * 100 / p.w_total, 1) end,
        'aderencia', case when p.v_ader is null or p.w_total = 0 then 0 else round(w_ader * 100 / p.w_total, 1) end,
        'aceite', case when p.v_ace is null or p.w_total = 0 then 0 else round(w_ace * 100 / p.w_total, 1) end,
        'nota', case when p.v_nota is null or p.w_total = 0 then 0 else round(w_nota * 100 / p.w_total, 1) end)
    )
  from pesos p;
end $$;

-- Conflito de agenda do corretor (mesma regra já usada pelo core: duração + intervalo)
create or replace function private.f1_corretor_ocupado(p_corretor uuid, p_data date, p_hora time, p_ignorar uuid default null)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select v.id from public.visitas v
  left join public.visit_cycles cy on cy.visita_id = v.id
  where v.corretor_id = p_corretor and v.deleted_at is null
    and v.id is distinct from p_ignorar
    and v.status in ('aguardando_corretor','agendada','confirmada')
    and coalesce(cy.outcome, 'pending') = 'pending'
    and (p_data + p_hora) < (v.data_visita + v.horario_visita) + (v.duration_minutes + v.buffer_minutes) * interval '1 minute'
    and (p_data + p_hora) + interval '90 minutes' > (v.data_visita + v.horario_visita)
  limit 1;
$$;

create or replace function public.corretores_sugeridos(
  p_empreendimento_id uuid,
  p_data date default null,
  p_hora time default null,
  p_visita_id uuid default null,
  p_excluir uuid[] default '{}',
  p_limite integer default 3
)
returns table (
  corretor_id uuid, nome text, whatsapp text, score numeric,
  conversao numeric, aderencia numeric, aceite numeric, nota numeric,
  realizadas integer, vendas integer, motivo text, detalhe jsonb,
  disponivel boolean, ja_convidado boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_comercial() then
    raise exception 'Acesso restrito à equipe comercial' using errcode = '42501';
  end if;
  return query
  select r.corretor_id, r.nome, r.whatsapp, r.score, r.conversao, r.aderencia, r.aceite, r.nota,
         r.realizadas, r.vendas, r.motivo, r.detalhe,
         (p_data is null or p_hora is null or private.f1_corretor_ocupado(r.corretor_id, p_data, p_hora, p_visita_id) is null) as disponivel,
         exists (select 1 from public.visita_convites x where x.visita_id = p_visita_id and x.corretor_id = r.corretor_id) as ja_convidado
  from private.f1_rating(p_empreendimento_id) r
  where not (r.corretor_id = any(coalesce(p_excluir, '{}')))
  order by
    exists (select 1 from public.visita_convites x where x.visita_id = p_visita_id and x.corretor_id = r.corretor_id),
    (p_data is null or p_hora is null or private.f1_corretor_ocupado(r.corretor_id, p_data, p_hora, p_visita_id) is null) desc,
    r.score desc nulls last, r.nome
  limit greatest(coalesce(p_limite, 3), 1);
end $$;

create or replace function public.corretores_ranking()
returns table (
  corretor_id uuid, nome text, score numeric, conversao numeric, aceite numeric, nota numeric,
  realizadas integer, vendas integer, motivo text, detalhe jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_comercial() then
    raise exception 'Acesso restrito à equipe comercial' using errcode = '42501';
  end if;
  return query
  select r.corretor_id, r.nome, r.score, r.conversao, r.aceite, r.nota, r.realizadas, r.vendas, r.motivo, r.detalhe
  from private.f1_rating(null) r
  order by r.score desc nulls last, r.nome;
end $$;

-- Métricas persistidas: roda como sistema (pg_cron), sem afrouxar a proteção de métricas do corretor
create or replace function private.corretor_metricas_recalcular()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := 0;
  m integer;
begin
  with resp as (
    select x.corretor_id,
      count(*) filter (where x.resposta = 'aceitou') as a,
      count(*) filter (where x.resposta = 'recusou') as r,
      avg(extract(epoch from (x.respondido_em - x.enviado_em)) / 60)
        filter (where x.resposta in ('aceitou','recusou') and x.respondido_em is not null) as t
    from public.visita_convites x group by x.corretor_id
  ),
  bot as (
    select corretor_id,
      count(*) filter (where status = 'accepted') as a,
      count(*) filter (where status = 'declined') as r
    from public.visit_match_attempts group by corretor_id
  ),
  alvo as (
    select c.id,
      coalesce(resp.a, 0) + coalesce(bot.a, 0) as a,
      coalesce(resp.r, 0) + coalesce(bot.r, 0) as r,
      coalesce(round(resp.t, 1), c.avg_response_time_minutes) as t
    from public.corretores c
    left join resp on resp.corretor_id = c.id
    left join bot on bot.corretor_id = c.id
    where resp.corretor_id is not null or bot.corretor_id is not null
  )
  update public.corretores c set
    total_accepts = alvo.a, total_rejects = alvo.r, avg_response_time_minutes = alvo.t, last_activity_at = now()
  from alvo
  where c.id = alvo.id
    and (c.total_accepts, c.total_rejects, c.avg_response_time_minutes) is distinct from (alvo.a, alvo.r, alvo.t);
  get diagnostics m = row_count; n := n + m;

  update public.corretores c set
    rating_score = r.score, rating_detalhe = r.detalhe, rating_calculado_em = now()
  from private.f1_rating(null) r
  where c.id = r.corretor_id
    and (c.rating_score, c.rating_detalhe) is distinct from (r.score, r.detalhe);
  get diagnostics m = row_count; n := n + m;
  return n;
end $$;

revoke all on function private.f1_rating(uuid) from public, anon, authenticated;
revoke all on function private.corretor_metricas_recalcular() from public, anon, authenticated;
revoke all on function public.corretores_sugeridos(uuid, date, time, uuid, uuid[], integer) from public, anon;
revoke all on function public.corretores_ranking() from public, anon;
grant execute on function public.corretores_sugeridos(uuid, date, time, uuid, uuid[], integer) to authenticated;
grant execute on function public.corretores_ranking() to authenticated;
;
