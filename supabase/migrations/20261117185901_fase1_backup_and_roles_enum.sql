-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

-- Etapa 1 (Fase 1 Leads/Visitas): backup obrigatório antes de qualquer alteração
create schema if not exists backup_20261117;

create table if not exists backup_20261117.leads as select * from public.leads;
create table if not exists backup_20261117.visitas as select * from public.visitas;
create table if not exists backup_20261117.visit_cycles as select * from public.visit_cycles;
create table if not exists backup_20261117.corretores as select * from public.corretores;
create table if not exists backup_20261117.user_roles as select * from public.user_roles;
create table if not exists backup_20261117.visit_automation_config as select * from public.visit_automation_config;

-- Novos papéis (Decisão padrão): sdr e closer
alter type public.app_role add value if not exists 'sdr';
alter type public.app_role add value if not exists 'closer';
;
