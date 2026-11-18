-- Fase 2: reduz a carga do banco (espelho diário às 17h30, robô pausado, faxina diária).
-- Reversão: supabase/rollback/fase1_reverter.sql (seção "Fase 2").

-- Crons do robô em stand-by: pausados (não apagados). A chave do robô religa os quatro.
select cron.alter_job(jobid, active := false) from cron.job
where jobname in ('memude-visit-sheets','memude-monitor-visits','memude-visit-intake','memude-visit-distribution-timeouts');

-- Espelho da planilha: uma vez por dia às 17h30 (Fortaleza = 20h30 UTC) + repescagem às 17h45 se sobrar fila
select cron.alter_job((select jobid from cron.job where jobname = 'fase1-planilha-espelho'), schedule := '30,45 20 * * *');
-- Correção automática noturna pausada: a equipe ainda edita a planilha enquanto a extensão não migra
select cron.alter_job((select jobid from cron.job where jobname = 'fase1-planilha-conferencia'), active := false);
-- Rotinas leves com frequência menor
select cron.alter_job((select jobid from cron.job where jobname = 'fase1-prazos'), schedule := '*/15 * * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'fase1-corretor-metricas'), schedule := '7 * * * *');

create or replace function public.fase1_robo_definir(p_ativo boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ator uuid := (select auth.uid());
begin
  if not private.has_role(ator, 'admin'::public.app_role) then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  update public.visit_automation_config set enabled = p_ativo, intake_enabled = p_ativo, updated_at = now() where id;
  perform cron.alter_job(j.jobid, active := p_ativo) from cron.job j
  where j.jobname in ('memude-visit-sheets','memude-monitor-visits','memude-visit-intake','memude-visit-distribution-timeouts');
  return jsonb_build_object('ativo', p_ativo);
end $$;
revoke all on function public.fase1_robo_definir(boolean) from public, anon;
grant execute on function public.fase1_robo_definir(boolean) to authenticated;

-- Faxina diária das tabelas operacionais da Fase 1
create or replace function private.fase1_limpeza()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a bigint; b bigint;
begin
  delete from public.sheet_sync_queue where status = 'enviado' and enviado_em < now() - interval '15 days';
  get diagnostics a = row_count;
  delete from public.sheet_sync_execucoes where iniciado_em < now() - interval '90 days';
  get diagnostics b = row_count;
  return jsonb_build_object('fila_enviados', a, 'execucoes', b);
end $$;
revoke all on function private.fase1_limpeza() from public, anon, authenticated;
select cron.schedule('fase1-limpeza', '10 6 * * *', 'select private.fase1_limpeza();');

-- Respostas HTTP temporárias do pg_net (expiram sozinhas; a tabela estava inchada)
truncate net._http_response;
