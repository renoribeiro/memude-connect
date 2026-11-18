-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

alter table public.leads add column if not exists planilha_extra jsonb;
alter table public.visitas add column if not exists planilha_extra jsonb;
comment on column public.leads.planilha_extra is 'Valores originais da planilha que o core não representa; o espelho os preserva.';
comment on column public.visitas.planilha_extra is 'Valores originais da planilha que o core não representa; o espelho os preserva.';

create or replace function private.f1_norm(p text)
returns text language sql immutable as $$
  select btrim(regexp_replace(translate(lower(coalesce(p, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '\s+', ' ', 'g'));
$$;

create or replace function private.f1_data_br(p text)
returns date language plpgsql immutable as $$
declare t text := btrim(coalesce(p, '')); m text[];
begin
  if t = '' then return null; end if;
  m := regexp_match(t, '^(\d{1,2})/(\d{1,2})/(\d{2,4})');
  if m is not null then
    return make_date(case when length(m[3]) = 2 then 2000 + m[3]::int else m[3]::int end, m[2]::int, m[1]::int);
  end if;
  m := regexp_match(t, '^(\d{4})-(\d{2})-(\d{2})');
  if m is not null then return make_date(m[1]::int, m[2]::int, m[3]::int); end if;
  return null;
exception when others then return null;
end $$;

create or replace function private.f1_hora_br(p text)
returns time language plpgsql immutable as $$
declare m text[];
begin
  m := regexp_match(btrim(coalesce(p, '')), '^(\d{1,2})[:h](\d{2})?');
  if m is null then return null; end if;
  return make_time(m[1]::int, coalesce(m[2], '0')::int, 0);
exception when others then return null;
end $$;

-- Formatadores do espelho com preservação dos valores originais
create or replace function private.sheet_linha_visita(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with b as (
    select v.planilha_extra as x, jsonb_build_object(
      'nome', l.nome,
      'telefone', coalesce(l.telefone_exibicao, l.telefone),
      'data visita', to_char(v.data_visita, 'DD/MM/YYYY'),
      'fonte', coalesce(l.fonte, ''),
      'horario', to_char(v.horario_visita, 'HH24:MI:SS'),
      'imovel', coalesce(e.nome, ''),
      'local', coalesce(v.meeting_address, ''),
      'bairro', coalesce(v.meeting_neighborhood, ''),
      'corretor', coalesce(nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), ''),
      'status', case when v.deleted_at is not null then 'Cancelada' else public.sheet_status_visita(v.status) end,
      'data venda', coalesce(to_char(v.data_venda, 'DD/MM/YYYY'), ''),
      'follow up lucas', coalesce(nullif(concat_ws(' · ',
          case when v.avaliacao_lead is not null then 'Nota ' || v.avaliacao_lead || '/5' end,
          nullif(v.comentarios_lead, ''),
          case when nullif(v.feedback_corretor, '') is not null then 'Corretor: ' || v.feedback_corretor end,
          case when nullif(v.proximo_passo, '') is not null then 'Próximo passo: ' || v.proximo_passo end), ''), ''),
      'follow up no show', case when v.tentativas_remarcar > 0 then v.tentativas_remarcar::text else '' end,
      'ultima tentativa', coalesce(to_char(v.ultima_tentativa_remarcar at time zone 'America/Fortaleza', 'DD/MM/YYYY HH24:MI'), ''),
      'id_visita', v.id::text
    ) as j
    from public.visitas v
    join public.leads l on l.id = v.lead_id
    left join public.empreendimentos e on e.id = v.empreendimento_id
    left join public.corretores c on c.id = v.corretor_id
    left join public.profiles p on p.id = c.profile_id
    where v.id = p_id
  )
  select b.j
    || coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(b.x, '{}'::jsonb)) e
                 where b.j ? e.key and coalesce(b.j->>e.key, '') = ''), '{}'::jsonb)
    || case when b.x ? 'status_label' then jsonb_build_object('status', b.x->>'status_label') else '{}'::jsonb end
  from b;
$$;

create or replace function private.sheet_linha_lead(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with b as (
    select l.planilha_extra as x, jsonb_build_object(
      'nome', l.nome,
      'telefone', coalesce(l.telefone_exibicao, l.telefone),
      'empreendimento', coalesce(e.nome, ''),
      'fonte', coalesce(l.fonte, ''),
      'status', case when l.deleted_at is not null then 'ARQUIVADO' else l.status_atendimento end,
      'responsavel', coalesce(nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), ''),
      'entrada', to_char(l.data_entrada, 'DD/MM/YYYY'),
      'proxima visita', coalesce((
        select to_char(v.data_visita, 'DD/MM/YYYY') || ' ' || to_char(v.horario_visita, 'HH24:MI')
        from public.visitas v
        where v.lead_id = l.id and v.deleted_at is null and v.status in ('aguardando_corretor','agendada','confirmada')
        order by v.data_visita, v.horario_visita limit 1), ''),
      'observacao', coalesce(l.observacoes, ''),
      'email', coalesce(l.email, ''),
      'id_lead', l.id::text
    ) as j
    from public.leads l
    left join public.empreendimentos e on e.id = l.empreendimento_id
    left join public.profiles p on p.user_id = l.responsavel_id
    where l.id = p_id
  )
  select b.j
    || coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(b.x, '{}'::jsonb)) e
                 where b.j ? e.key and coalesce(b.j->>e.key, '') = ''), '{}'::jsonb)
    || case when b.x ? 'status_label' then jsonb_build_object('status', b.x->>'status_label') else '{}'::jsonb end
  from b;
$$;

-- Mudança de status pelo fluxo da Fase 1 encerra o rótulo histórico importado
create or replace function private.f1_status(p_visita uuid, p_para text, p_ator uuid, p_obs text default null, p_extra jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_de text;
begin
  select status into v_de from public.visitas where id = p_visita;
  update public.visitas set status = p_para, planilha_extra = nullif(coalesce(planilha_extra, '{}'::jsonb) - 'status_label', '{}'::jsonb)
  where id = p_visita and (status is distinct from p_para or planilha_extra ? 'status_label');
  perform private.f1_evento(p_visita, 'f1_status',
    jsonb_build_object('de', v_de, 'para', p_para, 'observacao', p_obs) || coalesce(p_extra, '{}'::jsonb), p_ator);
end $$;

-- Tarefas sem agendador conhecido (ex.: visitas importadas) vão para o primeiro responsável configurado
do $$
declare d text;
begin
  d := pg_get_functiondef('private.f1_tarefas_confirmacao'::regproc);
  d := replace(d, 'agenda := coalesce(v.criado_por, (select auth.uid()));',
                  'agenda := coalesce(v.criado_por, (select auth.uid()), cfg.responsaveis[1]);');
  if position('cfg.responsaveis[1]' in d) = 0 then raise exception 'Ajuste não aplicado'; end if;
  execute d;
end $$;

-- Um lote por vez: evita duas execuções calcularem a mesma linha nova da planilha
create or replace function public.sheet_sync_claim(p_limite integer default 200)
returns table (id bigint, aba text, registro_id uuid, tentativas integer, linha jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  update public.sheet_sync_queue q set status = 'erro', ultimo_erro = 'Execução interrompida; reenviando', lease_ate = null
  where q.status = 'processando' and q.lease_ate < now();
  if exists (select 1 from public.sheet_sync_queue q where q.status = 'processando' and q.lease_ate >= now()) then
    return;
  end if;

  return query
  with lote as (
    select q.id from public.sheet_sync_queue q
    where q.status in ('pendente','erro') and q.proxima_tentativa <= now()
    order by q.proxima_tentativa, q.id
    limit greatest(least(coalesce(p_limite, 200), 500), 1)
    for update skip locked
  ), marcado as (
    update public.sheet_sync_queue q set status = 'processando', tentativas = q.tentativas + 1,
      lease_ate = now() + interval '5 minutes'
    from lote where q.id = lote.id
    returning q.id, q.aba, q.registro_id, q.tentativas
  )
  select m.id, m.aba, m.registro_id, m.tentativas,
    case when m.aba = 'LEADS' then private.sheet_linha_lead(m.registro_id) else private.sheet_linha_visita(m.registro_id) end
  from marcado m;
end $$;

create or replace function public.sheet_sync_execucao(p_modo text, p_enviados int, p_erros int, p_mensagem text, p_detalhes jsonb, p_inicio timestamptz)
returns void language sql security definer set search_path = '' as $$
  insert into public.sheet_sync_execucoes (modo, iniciado_em, concluido_em, enviados, erros, mensagem, detalhes)
  values (p_modo, p_inicio, now(), p_enviados, p_erros, left(p_mensagem, 1000), p_detalhes);
$$;

create or replace function public.sheet_sync_enfileirar_todos(p_aba text, p_origem text)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_aba = 'LEADS' then
    insert into public.sheet_sync_queue (aba, registro_id, origem)
    select 'LEADS', id, p_origem from public.leads
    on conflict (aba, registro_id) where status in ('pendente','erro') do nothing;
  else
    insert into public.sheet_sync_queue (aba, registro_id, origem)
    select 'VISITAS', id, p_origem from public.visitas
    on conflict (aba, registro_id) where status in ('pendente','erro') do nothing;
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.sheet_sync_enfileirar_ids(p_aba text, p_ids uuid[], p_origem text)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.sheet_sync_queue (aba, registro_id, origem)
  select p_aba, x, p_origem from unnest(p_ids) x
  on conflict (aba, registro_id) where status in ('pendente','erro') do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ===== Importação histórica (Etapa 9): só insere o que não existe; diferenças vão para import_conflitos =====
create or replace function public.planilha_importar_lote(p_aba text, p_linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.fase1_config;
  r jsonb;
  v jsonb;
  res jsonb := '[]'::jsonb;
  v_linha int;
  v_nome text; v_tel text; v_chave text;
  v_lead public.leads;
  v_lead_id uuid;
  v_status text; v_status_raw text;
  v_fonte text; v_fonte_raw text;
  v_emp uuid; v_resp uuid; v_corr uuid;
  v_extra jsonb;
  v_diffs int;
  v_data date; v_hora time;
  v_visita uuid;
  v_vstatus text;
  v_outcome text;
  hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  if p_aba not in ('LEADS','VISITAS') then raise exception 'Aba inválida'; end if;
  select * into cfg from public.fase1_config where id;
  perform set_config('memude.fase1', '1', true);
  perform set_config('memude.reagendamento', '1', true);

  for r in select * from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) loop
    v_linha := (r->>'linha')::int;
    v := coalesce(r->'v', '{}'::jsonb);
    begin
      v_nome := nullif(btrim(coalesce(v->>'nome', '')), '');
      v_tel := btrim(coalesce(v->>'telefone', ''));
      v_chave := public.normalize_phone_key(v_tel);
      if v_chave is null or length(regexp_replace(v_tel, '\D', '', 'g')) < 10 then
        res := res || jsonb_build_object('linha', v_linha, 'acao', 'ignorada', 'mensagem', 'Telefone ausente ou inválido');
        continue;
      end if;

      -- Mapeamentos
      v_status_raw := nullif(btrim(coalesce(v->>'status', '')), '');
      v_fonte_raw := nullif(btrim(coalesce(v->>'fonte', '')), '');
      v_fonte := case private.f1_norm(v_fonte_raw)
        when 'google' then 'Google' when 'meta' then 'Meta' when 'cadastro' then 'Cadastro'
        when 'follow' then 'Follow' when 'outros' then 'Outros' else public.fonte_from_origem(v_fonte_raw) end;
      select id into v_emp from public.empreendimentos
        where private.f1_norm(nome) = private.f1_norm(coalesce(v->>'empreendimento', v->>'imovel')) limit 1;
      if v_emp is null and length(private.f1_norm(coalesce(v->>'empreendimento', v->>'imovel'))) >= 4 then
        select min(id::text)::uuid into v_emp from public.empreendimentos
          where private.f1_norm(nome) like '%' || private.f1_norm(coalesce(v->>'empreendimento', v->>'imovel')) || '%'
          having count(*) = 1;
      end if;

      select l.* into v_lead from public.leads l
        where l.telefone_chave = v_chave and l.deleted_at is null
        order by l.telefone_chave_conflito, l.created_at limit 1;
      v_lead_id := v_lead.id;

      if p_aba = 'LEADS' then
        v_status := case private.f1_norm(v_status_raw)
          when 'novo' then 'NOVO' when 'em conversa' then 'EM CONVERSA' when 'interessado' then 'INTERESSADO'
          when 'visita agendada' then 'VISITA AGENDADA' when 'investidor' then 'INVESTIDOR' when 'corretor' then 'CORRETOR'
          when 'sem renda' then 'SEM RENDA' when 'nao interessado' then 'NÃO INTERESSADO' else null end;
        select r2.user_id into v_resp from public.user_roles r2 join public.profiles p on p.user_id = r2.user_id
          where r2.role in ('admin','sdr','closer') and private.f1_norm(v->>'responsavel') <> ''
            and (private.f1_norm(p.first_name || ' ' || p.last_name) = private.f1_norm(v->>'responsavel')
                 or private.f1_norm(p.first_name) = private.f1_norm(v->>'responsavel'))
          limit 1;

        if v_lead_id is not null then
          v_diffs := 0;
          if v_nome is not null and private.f1_norm(v_nome) <> private.f1_norm(v_lead.nome) then
            insert into public.import_conflitos (aba, linha, telefone_chave, lead_id, campo, valor_core, valor_planilha, dados_planilha)
            values (p_aba, v_linha, v_chave, v_lead_id, 'Nome', v_lead.nome, v_nome, v); v_diffs := v_diffs + 1;
          end if;
          if v_status is not null and v_status <> v_lead.status_atendimento then
            insert into public.import_conflitos (aba, linha, telefone_chave, lead_id, campo, valor_core, valor_planilha, dados_planilha)
            values (p_aba, v_linha, v_chave, v_lead_id, 'Status', v_lead.status_atendimento, v_status_raw, v); v_diffs := v_diffs + 1;
          end if;
          if v_fonte is not null and v_fonte is distinct from v_lead.fonte then
            insert into public.import_conflitos (aba, linha, telefone_chave, lead_id, campo, valor_core, valor_planilha, dados_planilha)
            values (p_aba, v_linha, v_chave, v_lead_id, 'Fonte', v_lead.fonte, v_fonte_raw, v); v_diffs := v_diffs + 1;
          end if;
          if v_emp is not null and v_emp is distinct from v_lead.empreendimento_id then
            insert into public.import_conflitos (aba, linha, telefone_chave, lead_id, campo, valor_core, valor_planilha, dados_planilha)
            values (p_aba, v_linha, v_chave, v_lead_id, 'Empreendimento',
              (select nome from public.empreendimentos where id = v_lead.empreendimento_id),
              coalesce(v->>'empreendimento', v->>'imovel'), v); v_diffs := v_diffs + 1;
          end if;
          res := res || jsonb_build_object('linha', v_linha, 'id', v_lead_id,
            'acao', case when v_diffs > 0 then 'conflito' else 'existente' end, 'conflitos', v_diffs);
          continue;
        end if;

        v_extra := jsonb_strip_nulls(jsonb_build_object(
          'status_label', case when v_status is null and v_status_raw is not null then v_status_raw end,
          'empreendimento', case when v_emp is null then nullif(coalesce(v->>'empreendimento', v->>'imovel'), '') end,
          'responsavel', case when v_resp is null then nullif(v->>'responsavel', '') end,
          'fonte', case when v_fonte is null then v_fonte_raw end,
          'proxima visita', nullif(v->>'proxima visita', ''),
          'original', v));
        insert into public.leads (nome, telefone, email, empreendimento_id, fonte, status_atendimento, responsavel_id,
          observacoes, origem, data_entrada, planilha_extra)
        values (coalesce(v_nome, 'Sem nome'), public.normalize_phone_canonical(v_tel), nullif(btrim(coalesce(v->>'email', '')), ''),
          v_emp, v_fonte, coalesce(v_status, 'NOVO'), v_resp, nullif(left(btrim(coalesce(v->>'observacao', '')), 4000), ''),
          'planilha', coalesce(private.f1_data_br(v->>'entrada'), hoje), v_extra)
        returning id into v_lead_id;
        res := res || jsonb_build_object('linha', v_linha, 'id', v_lead_id, 'acao', 'criado',
          'avisos', jsonb_strip_nulls(jsonb_build_object(
            'status', case when v_status is null and v_status_raw is not null then v_status_raw end,
            'empreendimento', v_extra->>'empreendimento', 'responsavel', v_extra->>'responsavel')));
        continue;
      end if;

      -- ===== VISITAS =====
      v_data := private.f1_data_br(v->>'data visita');
      if v_data is null then
        res := res || jsonb_build_object('linha', v_linha, 'acao', 'erro', 'mensagem', 'Data da visita ausente ou inválida');
        continue;
      end if;
      v_hora := coalesce(private.f1_hora_br(v->>'horario'), time '00:00');

      if nullif(v->>'id_visita', '') is not null and exists (select 1 from public.visitas where id::text = v->>'id_visita') then
        res := res || jsonb_build_object('linha', v_linha, 'id', (v->>'id_visita')::uuid, 'acao', 'existente');
        continue;
      end if;

      if v_lead_id is null then
        insert into public.leads (nome, telefone, fonte, status_atendimento, origem, data_entrada, planilha_extra)
        values (coalesce(v_nome, 'Sem nome'), public.normalize_phone_canonical(v_tel), v_fonte, 'VISITA AGENDADA',
          'planilha', v_data, jsonb_build_object('original_visita', v))
        returning id into v_lead_id;
      end if;

      select id into v_visita from public.visitas
        where lead_id = v_lead_id and data_visita = v_data and deleted_at is null
        order by abs(extract(epoch from (horario_visita - v_hora))) limit 1;
      if v_visita is not null then
        res := res || jsonb_build_object('linha', v_linha, 'id', v_visita, 'acao', 'existente');
        continue;
      end if;

      v_vstatus := case private.f1_norm(v_status_raw)
        when 'aguardando corretor' then 'aguardando_corretor'
        when 'agendada' then 'agendada' when 'visita agendada' then 'agendada'
        when 'confirmada' then 'confirmada' when 'visita confirmada' then 'confirmada'
        when 'realizada' then 'realizada' when 'visita realizada' then 'realizada'
        when 'no-show' then 'no_show' when 'no show' then 'no_show' when 'noshow' then 'no_show'
        when 'nao compareceu' then 'no_show' when 'nao realizada' then 'no_show'
        when 'reagendada' then 'reagendada' when 'cancelada' then 'cancelada' when 'desistencia' then 'cancelada'
        else null end;

      select c.id into v_corr from public.corretores c join public.profiles p on p.id = c.profile_id
        where c.deleted_at is null and private.f1_norm(v->>'corretor') <> ''
          and private.f1_norm(p.first_name || ' ' || p.last_name) = private.f1_norm(v->>'corretor') limit 1;
      if v_corr is null and private.f1_norm(v->>'corretor') <> '' then
        select min(c.id::text)::uuid into v_corr from public.corretores c join public.profiles p on p.id = c.profile_id
          where c.deleted_at is null
            and (private.f1_norm(p.first_name) = split_part(private.f1_norm(v->>'corretor'), ' ', 1))
            and (split_part(private.f1_norm(v->>'corretor'), ' ', 2) = ''
                 or private.f1_norm(p.last_name) like split_part(private.f1_norm(v->>'corretor'), ' ', 2) || '%')
          having count(*) = 1;
      end if;

      v_extra := jsonb_strip_nulls(jsonb_build_object(
        'status_label', case when v_vstatus is null and v_status_raw is not null then v_status_raw end,
        'corretor', case when v_corr is null then nullif(v->>'corretor', '') end,
        'imovel', case when v_emp is null then nullif(v->>'imovel', '') end,
        'horario', case when private.f1_hora_br(v->>'horario') is null then nullif(v->>'horario', '') end,
        'follow up no show', case when nullif(v->>'follow up no show', '') !~ '^\d+$' then nullif(v->>'follow up no show', '') end,
        'ultima tentativa', nullif(v->>'ultima tentativa', ''),
        'data venda', case when private.f1_data_br(v->>'data venda') is null then nullif(v->>'data venda', '') end,
        'original', v));
      v_vstatus := coalesce(v_vstatus, 'agendada');

      insert into public.visitas (lead_id, corretor_id, empreendimento_id, data_visita, horario_visita, status,
        meeting_address, meeting_neighborhood, comentarios_lead, data_venda, tentativas_remarcar,
        intake_source, fase1, planilha_extra)
      values (v_lead_id, v_corr, v_emp, v_data, v_hora,
        case when v_vstatus = 'confirmada' then 'agendada' else v_vstatus end,
        nullif(v->>'local', ''), nullif(v->>'bairro', ''), nullif(v->>'follow up lucas', ''),
        private.f1_data_br(v->>'data venda'),
        case when coalesce(v->>'follow up no show', '') ~ '^\d+$' then (v->>'follow up no show')::int else 0 end,
        'planilha', v_data >= hoje and v_vstatus in ('aguardando_corretor','agendada','confirmada'), v_extra)
      returning id into v_visita;

      v_outcome := case v_vstatus when 'realizada' then 'held' when 'no_show' then 'not_held'
        when 'cancelada' then 'cancelled' when 'reagendada' then 'rescheduled' else 'pending' end;
      insert into public.visit_cycles (visita_id, scheduled_at, outcome, match_status, client_confirmed, broker_confirmed)
      values (v_visita, private.f1_inicio(v_data, v_hora), v_outcome,
        case when v_outcome <> 'pending' then 'closed' when v_corr is not null and v_vstatus <> 'aguardando_corretor' then 'accepted' else 'searching' end,
        case when v_vstatus = 'confirmada' then true end,
        case when v_vstatus = 'confirmada' or (v_corr is not null and v_vstatus = 'agendada') then true end);
      if v_vstatus = 'confirmada' then
        update public.visitas set status = 'confirmada' where id = v_visita;
      end if;
      perform private.f1_evento(v_visita, 'f1_importada', jsonb_build_object('linha', v_linha, 'status_planilha', v_status_raw), null);

      if v_data >= hoje and v_vstatus in ('agendada','confirmada') then
        perform private.f1_tarefas_confirmacao(v_visita);
      end if;

      res := res || jsonb_build_object('linha', v_linha, 'id', v_visita, 'acao', 'criado', 'lead_id', v_lead_id,
        'avisos', jsonb_strip_nulls(jsonb_build_object('corretor', v_extra->>'corretor', 'imovel', v_extra->>'imovel',
          'status', v_extra->>'status_label')));
    exception when others then
      res := res || jsonb_build_object('linha', v_linha, 'acao', 'erro', 'mensagem', left(sqlerrm, 300));
      insert into public.import_conflitos (aba, linha, telefone_chave, campo, valor_planilha, dados_planilha)
      values (p_aba, v_linha, v_chave, 'Erro na importação', left(sqlerrm, 500), v);
    end;
  end loop;
  return res;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.sheet_sync_execucao(text,integer,integer,text,jsonb,timestamptz)',
    'public.sheet_sync_enfileirar_todos(text,text)', 'public.sheet_sync_enfileirar_ids(text,uuid[],text)',
    'public.planilha_importar_lote(text,jsonb)', 'public.sheet_sync_claim(integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
;
