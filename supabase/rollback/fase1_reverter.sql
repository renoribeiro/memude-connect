-- Reversão da Fase 1 (Leads e Visitas) — executar só se for preciso voltar ao fluxo anterior.
-- Nada foi apagado na Fase 1: dados antigos estão em backup_20261117.* e as definições originais
-- das funções alteradas estão em backup_20261117.function_defs.

-- 1) Parar o espelho novo e as rotinas da Fase 1 (os crons antigos nunca foram removidos)
select cron.unschedule('fase1-planilha-espelho');
select cron.unschedule('fase1-planilha-conferencia');
select cron.unschedule('fase1-prazos');
select cron.unschedule('fase1-corretor-metricas');

-- 2) Restaurar as funções do robô/CRM exatamente como estavam antes de 17/11/2026
do $$
declare f record;
begin
  for f in select funcao, definicao from backup_20261117.function_defs loop
    execute f.definicao;
  end loop;
end $$;

-- 3) Remover os gatilhos novos (as tabelas e colunas novas podem ficar: são aditivas)
drop trigger if exists leads_fase1_before on public.leads;
drop trigger if exists leads_fase1_historico on public.leads;
drop trigger if exists sheet_sync_lead on public.leads;
drop trigger if exists sheet_sync_visita on public.visitas;

-- 4) Religar o robô de visitas (envia WhatsApp automático novamente)
update public.visit_automation_config set enabled = true, intake_enabled = true, updated_at = now() where id;
select cron.alter_job(jobid, active := true) from cron.job
where jobname in ('memude-visit-sheets','memude-monitor-visits','memude-visit-intake','memude-visit-distribution-timeouts');

-- 5) (Opcional) Leads e visitas importados da planilha em 17/11/2026:
--    leads: origem = 'planilha'; visitas: intake_source = 'planilha'.
--    Não há remoção automática: decida manualmente o que manter.

-- ===== Fase 2 (18/11/2026) =====
-- 6) Relatórios automáticos: pausar os envios do Connect (religue os fluxos no n8n se for voltar a ele)
select cron.alter_job(jobid, active := false) from cron.job where jobname in ('relatorio-diario', 'relatorio-semanal');
-- 7) Espelho da planilha a cada minuto e conferência noturna, como na Fase 1
select cron.alter_job((select jobid from cron.job where jobname = 'fase1-planilha-espelho'), schedule := '* * * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'fase1-planilha-conferencia'), active := true);
-- 8) Faxina diária (opcional manter): select cron.unschedule('fase1-limpeza');
-- 9) Crons antigos com a frequência original (antes de 18/11/2026)
select cron.alter_job((select jobid from cron.job where jobname = 'crm-archive-completed-monthly'), schedule := '* * * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'memude-message-queue'), schedule := '* * * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'memude-distribution-timeouts'), schedule := '*/2 * * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'memude-ai-followups'), schedule := '*/5 * * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'memude-scheduled-reports'), active := true);
-- 10) Telas de SDR/closer: voltar a ser só do admin (remove apenas as políticas criadas em 18/11/2026)
drop policy if exists "Equipe comercial vê vendas" on public.vendas;
drop policy if exists "Equipe comercial lança vendas" on public.vendas;
drop policy if exists "Equipe comercial edita vendas" on public.vendas;
drop policy if exists "Equipe comercial cria visitas" on public.visitas;
drop policy if exists "Equipe comercial edita visitas" on public.visitas;
drop policy if exists "Equipe comercial cria cards do CRM" on public.crm_leads;
drop policy if exists "Equipe comercial move cards do CRM" on public.crm_leads;
drop policy if exists "Equipe comercial tira cards do CRM" on public.crm_leads;
drop policy if exists "Equipe comercial lê automações do CRM" on public.crm_automations;
drop policy if exists "Equipe comercial edita corretores" on public.corretores;
-- 11) Kanban acompanhando a visita (18/11/2026): desliga o movimento automático de cards
drop trigger if exists crm_kanban_status_visita on public.visitas;
-- e devolve a criação de card por visita no primeiro estágio (comportamento anterior):
create or replace function public.auto_add_lead_to_crm()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pipeline_id uuid; v_first_stage_id uuid; v_position integer;
begin
  if coalesce(current_setting('memude.reagendamento', true), '') = '1' then return NEW; end if;
  select id into v_pipeline_id from public.crm_pipelines where is_default = true and auto_add_visits = true order by created_at, id limit 1;
  if v_pipeline_id is null then return NEW; end if;
  select id into v_first_stage_id from public.crm_stages where pipeline_id = v_pipeline_id order by posicao, created_at, id limit 1;
  if v_first_stage_id is null then return NEW; end if;
  select coalesce(max(posicao) + 1, 0) into v_position from public.crm_leads where pipeline_id = v_pipeline_id and stage_id = v_first_stage_id;
  insert into public.crm_leads (lead_id, pipeline_id, stage_id, empreendimento_id, visita_id, posicao)
  values (NEW.lead_id, v_pipeline_id, v_first_stage_id, NEW.empreendimento_id, NEW.id, v_position)
  on conflict (pipeline_id, visita_id) where visita_id is not null do nothing;
  return NEW;
end $$;
-- 12) Status puxados da planilha em 18/11/2026: backup em backup_20261118.visitas_pre_puxar / leads_pre_puxar
-- 13) Ajustes de 18/11/2026 (migração 20261118220000):
--   a) Etiqueta do mês no Kanban: desliga a troca automática e devolve as etiquetas anteriores
drop trigger if exists crm_kanban_data_visita on public.visitas;
-- (para parar de etiquetar ao agendar, recrie private.crm_mover_por_visita sem o bloco "Etiqueta do mês")
-- update public.crm_leads c set tag = b.tag, tag_cor = b.tag_cor
--   from backup_20261118.crm_leads_etiqueta b where b.id = c.id;
--   b) Próximo passo como atividade: as tarefas tipo 'atividade' podem ficar (aparecem na Agenda);
--      para voltar o retorno sem obrigatoriedade, recrie public.visita_registrar_retorno da migração 20261118165556.
--   c) Notas no histórico: drop function if exists public.lead_adicionar_nota(uuid, text);
--   d) Apresentação: drop function if exists public.painel_apresentacao(date, date);
-- 14) Ajustes de 23/11/2026 (migração 20261123130000):
--   a) drop trigger if exists tarefas_status_visita on public.visitas;
--   b) drop function if exists public.leads_excluir(uuid[]), public.leads_restaurar(uuid[]), public.leads_em_massa(uuid[], jsonb);
--      (leads excluídos ficam com deleted_at; para trazer de volta: update public.leads set deleted_at = null where id in (...))
--   c) drop trigger if exists import_conflito_sem_repetir on public.import_conflitos;
--   d) cron 'fase1-planilha-espelho' voltar ao corpo {"modo":"enviar"} (só CRM → planilha).
-- 15) Botão "Sincronizar planilha" (migração 20261124130000):
--   drop function if exists public.planilha_sincronizar_agora(); drop table if exists private.planilha_sync_disparos;
--   (a trava pg_advisory_xact_lock em planilha_importar_lote pode ficar: só serializa os lotes)
