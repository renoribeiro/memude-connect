-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

create or replace function private.f1_dono_agendamento(p_criado_por uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select case
    when p_criado_por is not null and p_criado_por is distinct from c.closer_user_id then p_criado_por
    else coalesce(c.responsaveis[1], p_criado_por)
  end
  from public.fase1_config c where c.id;
$$;

do $$
declare d text;
begin
  d := pg_get_functiondef('private.f1_tarefas_confirmacao'::regproc);
  d := replace(d, 'agenda := coalesce(v.criado_por, (select auth.uid()), cfg.responsaveis[1]);',
                  'agenda := coalesce(private.f1_dono_agendamento(coalesce(v.criado_por, (select auth.uid()))), cfg.responsaveis[1]);');
  if position('f1_dono_agendamento' in d) = 0 then raise exception 'confirmacao não ajustada'; end if;
  execute d;

  d := pg_get_functiondef('public.visita_escalar(uuid,text)'::regprocedure);
  d := replace(d, 'dono := coalesce(v.criado_por, cfg.responsaveis[1], ator);',
                  'dono := coalesce(private.f1_dono_agendamento(v.criado_por), cfg.responsaveis[1], ator);');
  if position('f1_dono_agendamento' in d) = 0 then raise exception 'escalar não ajustado'; end if;
  execute d;
end $$;
;
