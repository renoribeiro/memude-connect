-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

alter function public.normalize_phone_canonical(text) set search_path = '';
alter function public.normalize_phone_key(text) set search_path = '';
alter function public.normalize_phone_display(text) set search_path = '';
alter function public.normalize_phone(text) set search_path = '';
alter function public.fonte_from_origem(text) set search_path = '';
alter function public.sheet_status_visita(text) set search_path = '';
alter function private.f1_num(numeric, integer) set search_path = '';
alter function private.f1_inicio(date, time) set search_path = '';
alter function private.f1_norm(text) set search_path = '';
alter function private.f1_data_br(text) set search_path = '';
alter function private.f1_hora_br(text) set search_path = '';
;
