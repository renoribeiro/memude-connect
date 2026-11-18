-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

grant select on public.visit_cycles, public.visit_events to authenticated;

revoke all on public.visita_convites, public.tarefas, public.lead_eventos, public.fase1_config, public.import_conflitos,
  public.sheet_sync_queue, public.sheet_sync_execucoes, public.leads_duplicados from anon;

revoke insert, update, delete, truncate, references, trigger on public.visita_convites, public.tarefas, public.lead_eventos,
  public.import_conflitos, public.sheet_sync_queue, public.sheet_sync_execucoes from authenticated;
revoke insert, delete, truncate, references, trigger on public.fase1_config from authenticated;
grant select on public.visita_convites, public.tarefas, public.lead_eventos, public.import_conflitos,
  public.sheet_sync_queue, public.sheet_sync_execucoes, public.leads_duplicados, public.fase1_config to authenticated;
grant update on public.fase1_config to authenticated;

revoke usage, select on sequence public.sheet_sync_queue_id_seq, public.sheet_sync_execucoes_id_seq from anon, authenticated;
;
