-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

create table if not exists backup_20261117.visitas_importadas_pre_ajuste as
select v.id, v.status, v.corretor_id, c.outcome, c.match_status
from public.visitas v join public.visit_cycles c on c.visita_id = v.id
where v.intake_source = 'planilha';

set local session_replication_role = replica;

-- 1) Resultado real a partir do status histórico (o texto original continua na planilha via status_label)
with m as (
  select v.id,
    case
      when private.f1_norm(v.planilha_extra->>'status_label') in ('lead furou','tentando remarcar','visita nao realizada') then 'no_show'
      when private.f1_norm(v.planilha_extra->>'status_label') in ('cancelado','desistiu') then 'cancelada'
      when private.f1_norm(v.planilha_extra->>'status_label') in ('comprou','vendemos','venda realizada','finalizado!','doc aprovada',
        'documentacao','negociacao','pendente comissao','aguardando assinatura','seguiu com outro imovel') then 'realizada'
    end as novo
  from public.visitas v
  where v.intake_source = 'planilha' and v.planilha_extra ? 'status_label'
)
update public.visitas v set status = m.novo, fase1 = false
from m where m.id = v.id and m.novo is not null;

update public.visit_cycles c set
  outcome = case v.status when 'realizada' then 'held' when 'no_show' then 'not_held' when 'cancelada' then 'cancelled' else c.outcome end,
  match_status = case when v.status in ('realizada','no_show','cancelada') then 'closed' else c.match_status end,
  updated_at = now()
from public.visitas v
where v.id = c.visita_id and v.intake_source = 'planilha' and v.status in ('realizada','no_show','cancelada')
  and c.outcome = 'pending';

-- Tarefas criadas para visitas que na verdade já estavam encerradas
update public.tarefas t set status = 'cancelada', concluida_em = now(), observacao = 'Ajuste da importação: visita já encerrada na planilha'
from public.visitas v
where v.id = t.visita_id and t.status = 'pendente' and v.intake_source = 'planilha' and v.status in ('realizada','no_show','cancelada');

-- 2) Corretor por palavras do nome (somente quando há um único corretor compatível)
with alvo as (
  select v.id, private.f1_norm(v.planilha_extra->>'corretor') as nome
  from public.visitas v
  where v.intake_source = 'planilha' and v.corretor_id is null and coalesce(v.planilha_extra->>'corretor', '') <> ''
), cand as (
  select a.id, c.id as corretor_id
  from alvo a
  join public.corretores c on c.deleted_at is null
  join public.profiles p on p.id = c.profile_id
  where length(a.nome) >= 4
    and not exists (
      select 1 from unnest(string_to_array(a.nome, ' ')) w
      where length(w) >= 2 and w not in ('de','da','do','dos','das','e')
        and not (' ' || private.f1_norm(p.first_name || ' ' || p.last_name) || ' ') like '% ' || w || ' %')
), unico as (
  select id, min(corretor_id::text)::uuid as corretor_id from cand group by id having count(*) = 1
)
update public.visitas v set corretor_id = u.corretor_id,
  planilha_extra = nullif(coalesce(v.planilha_extra, '{}'::jsonb) - 'corretor', '{}'::jsonb)
from unico u where u.id = v.id;

set local session_replication_role = origin;

-- Espelho: as visitas ajustadas voltam para a fila
insert into public.sheet_sync_queue (aba, registro_id, origem)
select 'VISITAS', id, 'ajuste_importacao' from public.visitas where intake_source = 'planilha'
on conflict (aba, registro_id) where status in ('pendente','erro') do nothing;
;
