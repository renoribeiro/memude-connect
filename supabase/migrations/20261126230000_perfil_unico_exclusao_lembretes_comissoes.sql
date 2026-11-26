-- 1) Perfil único do cliente: o que a IA entende das conversas (com a SDR e com o corretor) fica no LEAD,
--    e todas as telas (Leads, CRM, visita, app do corretor) mostram o mesmo perfil.
-- 2) Visita excluída some de todos os lugares (conversa do corretor, funil/CRM, status do lead, convites e tarefas).
-- 3) Lembretes do corretor: ele cria a tarefa no app e recebe o aviso na hora marcada.
-- 4) Comissões do corretor: só o que o closer lançou na venda, sem campos internos da MeMude.

-- ========== 1) Perfil único ==========
alter table public.leads add column if not exists perfil_ia text;
alter table public.leads add column if not exists perfil_falta text;
alter table public.leads add column if not exists perfil_temperatura text;
alter table public.leads add column if not exists perfil_ia_em timestamptz;

create or replace function private.lead_perfil_da_conversa()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if NEW.lead_id is null or NEW.resumo_ia is null then return NEW; end if;
  if NEW.resumo_ia is not distinct from OLD.resumo_ia and NEW.ia_falta is not distinct from OLD.ia_falta
     and NEW.temperatura is not distinct from OLD.temperatura and NEW.lead_id is not distinct from OLD.lead_id then
    return NEW;
  end if;
  update public.leads set perfil_ia = NEW.resumo_ia, perfil_falta = NEW.ia_falta, perfil_temperatura = NEW.temperatura,
    perfil_ia_em = now()
  where id = NEW.lead_id;
  return NEW;
end $$;
drop trigger if exists lead_perfil_da_conversa on public.conversas;
create trigger lead_perfil_da_conversa after update of resumo_ia, ia_falta, temperatura, lead_id on public.conversas
  for each row execute function private.lead_perfil_da_conversa();

-- Preenche com a conversa mais recente de cada lead
update public.leads l set perfil_ia = x.resumo_ia, perfil_falta = x.ia_falta, perfil_temperatura = x.temperatura,
  perfil_ia_em = coalesce(x.ia_analisada_em, now())
from (select distinct on (lead_id) lead_id, resumo_ia, ia_falta, temperatura, ia_analisada_em
      from public.conversas where lead_id is not null and resumo_ia is not null
      order by lead_id, ia_analisada_em desc nulls last) x
where x.lead_id = l.id;

-- ========== 2) Visita excluída some de todos os lugares ==========
create or replace function private.visita_excluida_limpar(p_visita uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare v public.visitas; outra public.visitas; uid_corretor uuid; c record; bolsao uuid;
begin
  select * into v from public.visitas where id = p_visita;
  if not found or v.deleted_at is null then return; end if;
  perform set_config('memude.fase1', '1', true);

  -- Outra visita ativa do mesmo cliente (ela passa a valer no lugar da excluída)
  select * into outra from public.visitas o
  where o.lead_id = v.lead_id and o.id <> v.id and o.deleted_at is null
    and o.status in ('aguardando_corretor', 'agendada', 'confirmada', 'realizada')
  order by (o.status <> 'realizada') desc, o.data_visita desc limit 1;

  -- Convites e tarefas da visita
  update public.visita_convites set resposta = 'sem_resposta', respondido_em = now() where visita_id = v.id and resposta is null;
  perform private.f1_fechar_tarefas(v.id, null, 'cancelada', null, 'Visita excluída');

  -- CRM: card criado por esta visita é arquivado; card antigo volta para o Bolsão (ou passa para a outra visita)
  for c in select cl.id, cl.created_at, cl.pipeline_id from public.crm_leads cl
           where cl.visita_id = v.id and cl.archived_at is null and cl.completed_at is null and cl.venda_id is null loop
    if outra.id is not null and not exists (select 1 from public.crm_leads o where o.pipeline_id = c.pipeline_id and o.visita_id = outra.id) then
      update public.crm_leads set visita_id = outra.id, updated_at = now() where id = c.id;
    elsif c.created_at >= v.created_at - interval '2 minutes' then
      update public.crm_leads set archived_at = now(), visita_id = null, updated_at = now() where id = c.id;
    else
      select id into bolsao from public.crm_stages where pipeline_id = c.pipeline_id order by posicao limit 1;
      update public.crm_leads set visita_id = null, stage_id = coalesce(bolsao, stage_id), moved_at = now(), updated_at = now() where id = c.id;
    end if;
  end loop;

  if outra.id is null then
    -- Conversa: sai do app do corretor e volta para a SDR
    select p.user_id into uid_corretor from public.corretores co join public.profiles p on p.id = co.profile_id where co.id = v.corretor_id;
    for c in select id, dono_id, dono_papel, etapa from public.conversas where lead_id = v.lead_id loop
      if c.dono_papel = 'corretor' and (uid_corretor is null or c.dono_id = uid_corretor) then
        perform private.conv_trocar_dono(c.id, null, 'sdr', 'Visita excluída: volta para a SDR', null);
      end if;
      if c.etapa in ('visita_marcada', 'visitou') then
        update public.conversas set etapa = 'em_atendimento' where id = c.id;
      end if;
    end loop;
    -- Status do lead volta para antes da visita
    update public.leads set status_atendimento = 'INTERESSADO' where id = v.lead_id and status_atendimento = 'VISITA AGENDADA';
    update public.leads set status = 'follow_up'::public.lead_status where id = v.lead_id and status::text in ('visita_agendada', 'buscando_corretor', 'corretor_designado');
  end if;

  update public.conv_alertas set resolvido_em = now() where resolvido_em is null and tipo = 'confirmar_ia' and lead_id = v.lead_id and outra.id is null;
end $$;

create or replace function private.visita_excluida_gatilho()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if NEW.deleted_at is not null and OLD.deleted_at is null then
    perform private.visita_excluida_limpar(NEW.id);
  end if;
  return NEW;
exception when others then
  raise warning 'limpeza da visita excluída % falhou: %', NEW.id, sqlerrm;
  return NEW;
end $$;
drop trigger if exists visita_excluida_limpar on public.visitas;
create trigger visita_excluida_limpar after update of deleted_at on public.visitas
  for each row execute function private.visita_excluida_gatilho();

-- Visitas excluídas nos últimos 30 dias (testes): aplica a limpeza agora
select private.visita_excluida_limpar(v.id) from public.visitas v where v.deleted_at > now() - interval '30 days';

-- ========== 3) Lembretes do corretor ==========
alter table public.tarefas add column if not exists lembrete_push_em timestamptz;

create or replace function public.minha_atividade_criar(p_titulo text, p_quando timestamptz, p_lead uuid default null, p_conversa uuid default null)
returns uuid language plpgsql security definer set search_path to '' as $$
declare u uuid := auth.uid(); t text := btrim(coalesce(p_titulo, '')); v_lead uuid := p_lead; v_id uuid;
begin
  if u is null then raise exception 'Faça login' using errcode = '42501'; end if;
  if length(t) < 3 or length(t) > 200 then raise exception 'Escreva o que precisa fazer (3 a 200 caracteres)' using errcode = '22023'; end if;
  if p_quando is null or p_quando < now() - interval '5 minutes' or p_quando > now() + interval '365 days' then
    raise exception 'Escolha uma data e um horário no futuro' using errcode = '22023';
  end if;
  if p_conversa is not null then
    perform private.conv_exigir_ver(p_conversa);
    select coalesce(v_lead, lead_id) into v_lead from public.conversas where id = p_conversa;
  end if;
  -- Corretor só cria lembrete de cliente dele
  if v_lead is not null and not private.is_comercial() and not exists (
      select 1 from public.conversas c where c.lead_id = v_lead and c.dono_id = u) and not exists (
      select 1 from public.visitas v where v.lead_id = v_lead and v.deleted_at is null and v.corretor_id = private.conv_user_corretor(u)) then
    raise exception 'Você só pode criar lembretes dos seus clientes' using errcode = '42501';
  end if;
  insert into public.tarefas (tipo, titulo, lead_id, dono_id, disponivel_em, vence_em, status, observacao)
  values ('atividade', t, v_lead, u, p_quando, p_quando + interval '1 hour', 'pendente', 'Lembrete criado no app')
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.minha_atividade_criar(text, timestamptz, uuid, uuid) from public, anon;
grant execute on function public.minha_atividade_criar(text, timestamptz, uuid, uuid) to authenticated;

-- Aviso no celular na hora do lembrete
create or replace function private.lembretes_tick()
returns integer language plpgsql security definer set search_path to '' as $$
declare r record; n int := 0;
begin
  for r in
    update public.tarefas t set lembrete_push_em = now()
    where t.id in (select id from public.tarefas where tipo = 'atividade' and status = 'pendente' and lembrete_push_em is null
                   and dono_id is not null and disponivel_em <= now() and disponivel_em > now() - interval '2 hours'
                   for update skip locked)
    returning t.id, t.titulo, t.dono_id, t.lead_id
  loop
    perform private.conv_push(array[r.dono_id], 'Lembrete', left(r.titulo || coalesce(' · ' || (select nome from public.leads where id = r.lead_id), ''), 200),
      '/app/agenda', 'lembrete-' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

do $do$
begin
  perform cron.unschedule('lembretes-corretor') where exists (select 1 from cron.job where jobname = 'lembretes-corretor');
  perform cron.schedule('lembretes-corretor', '*/5 * * * *', $cron$select private.lembretes_tick()$cron$);
end $do$;

-- ========== 4) Comissões do corretor ==========
create or replace function public.corretor_minhas_comissoes()
returns table(venda_id uuid, cliente text, empreendimento text, imagem text, data_venda date, valor_imovel numeric,
  comissao_percentual numeric, imposto_percentual numeric, valor_comissao_bruta numeric, valor_imposto numeric,
  valor_corretor numeric, status text, data_pagamento date, observacoes text, tem_comprovante boolean, atualizado_em timestamptz)
language plpgsql stable security definer set search_path to '' as $$
declare cid uuid := private.conv_user_corretor(auth.uid());
begin
  if cid is null then raise exception 'Acesso do corretor não encontrado' using errcode = '42501'; end if;
  return query
  select s.id, l.nome, e.nome, e.imagem_url, s.data_venda, s.valor_imovel, s.comissao_percentual, s.imposto_percentual,
    s.valor_comissao_bruta, s.valor_imposto, s.valor_corretor, s.status::text, s.data_pagamento, s.observacoes,
    coalesce(cardinality(s.comprovantes), 0) > 0, s.updated_at
  from public.vendas s
  left join public.leads l on l.id = s.lead_id
  left join public.empreendimentos e on e.id = s.empreendimento_id
  where s.corretor_id = cid
  order by s.data_venda desc nulls last, s.created_at desc;
end $$;
revoke all on function public.corretor_minhas_comissoes() from public, anon;
grant execute on function public.corretor_minhas_comissoes() to authenticated;
