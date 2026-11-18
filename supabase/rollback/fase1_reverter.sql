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
