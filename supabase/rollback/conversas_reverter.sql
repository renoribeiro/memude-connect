-- ============================================================
-- MeMude Conversas — desligar sem perder dados (rodar só se for preciso voltar atrás)
-- Para os gatilhos que tocam tabelas antigas (convites, visitas, leads) e os crons.
-- As tabelas novas (conversas, mensagens…) e o histórico ficam intactos.
-- ============================================================
select cron.unschedule('conversas-alertas') where exists (select 1 from cron.job where jobname = 'conversas-alertas');
select cron.unschedule('conversas-ia') where exists (select 1 from cron.job where jobname = 'conversas-ia');

drop trigger if exists conv_dono_por_convite on public.visita_convites;
drop trigger if exists conv_push_convite on public.visita_convites;
drop trigger if exists conv_dono_por_visita on public.visitas;
drop trigger if exists conv_push_alerta on public.conv_alertas;

drop policy if exists "Conversas: corretor vê seus convites" on public.visita_convites;
drop policy if exists "Conversas: dono da conversa vê o lead" on public.leads;

-- Os números "conversas-*" continuam conectados na Evolution; para parar de receber,
-- desconecte-os em Conversas → Números (ou desative-os ali).

-- Chamados automáticos (26/11): para o reaviso e a passagem automática ao próximo corretor.
select cron.unschedule('chamados-corretor') where exists (select 1 from cron.job where jobname = 'chamados-corretor');
update public.fase1_config set chamado_automatico = false;
