-- Reduz a frequência de crons sem atividade recente (fila de mensagens e distribuição paradas desde 10/09/2026,
-- nenhum follow-up de IA em 30 dias, nenhum agendamento em scheduled_reports). Nada é apagado.
-- Valores anteriores: crm-archive '* * * * *', message-queue '* * * * *', distribution-timeouts '*/2 * * * *',
-- ai-followups '*/5 * * * *', scheduled-reports '0 * * * *' (ativo).

-- Arquiva cards concluídos antes do mês atual: uma vez por dia às 00h05 (Brasília) basta.
select cron.alter_job((select jobid from cron.job where jobname = 'crm-archive-completed-monthly'), schedule := '5 3 * * *');
-- Fila de envio da Evolution (agentes de IA): a cada 5 min. Voltar para 1 min se os agentes passarem a conversar com leads.
select cron.alter_job((select jobid from cron.job where jobname = 'memude-message-queue'), schedule := '*/5 * * * *');
-- Prazo de aceite da distribuição automática de leads: a cada 10 min.
select cron.alter_job((select jobid from cron.job where jobname = 'memude-distribution-timeouts'), schedule := '*/10 * * * *');
-- Follow-ups de IA: a cada 30 min.
select cron.alter_job((select jobid from cron.job where jobname = 'memude-ai-followups'), schedule := '*/30 * * * *');
-- Relatórios agendados antigos: não há agendamentos e a função não envia e-mail (substituída por relatorio-diario/semanal).
select cron.alter_job((select jobid from cron.job where jobname = 'memude-scheduled-reports'), active := false);
