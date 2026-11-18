-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

insert into backup_20261117.function_defs (funcao, definicao, salvo_em)
select f, pg_get_functiondef(f::regproc), now()
from unnest(array['public.visit_lifecycle_tick','public.visit_lifecycle_tick_before_match']) f
where not exists (select 1 from backup_20261117.function_defs b where b.funcao = f);

-- Visitas importadas da planilha passam a ser do fluxo manual
set local session_replication_role = replica;
update public.visitas set fase1 = true where intake_source = 'planilha' and not fase1;
set local session_replication_role = origin;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.visit_lifecycle_tick'::regproc);
  d := replace(d, 'WHERE c.match_status=''searching'' AND c.outcome=''pending''', 'WHERE c.match_status=''searching'' AND c.outcome=''pending'' AND NOT v.fase1');
  if position('NOT v.fase1' in d) = 0 then raise exception 'tick não ajustado'; end if;
  execute d;

  d := pg_get_functiondef('public.visit_lifecycle_tick_before_match'::regproc);
  d := replace(d, 'WHERE cy.outcome=''pending'' AND v.deleted_at IS NULL', 'WHERE cy.outcome=''pending'' AND v.deleted_at IS NULL AND NOT v.fase1');
  if position('NOT v.fase1' in d) = 0 then raise exception 'tick_before_match não ajustado'; end if;
  execute d;

  d := pg_get_functiondef('private.visit_capture'::regproc);
  d := replace(d, 'IF NOT private.visit_bot_active() THEN RETURN NEW; END IF;', 'IF NOT private.visit_bot_active() OR NEW.fase1 THEN RETURN NEW; END IF;');
  if position('OR NEW.fase1' in d) = 0 then raise exception 'visit_capture não ajustado'; end if;
  execute d;

  d := pg_get_functiondef('private.visit_contact_changed'::regproc);
  d := replace(d, 'WHERE cy.outcome=''pending'' AND ((TG_TABLE_NAME', 'WHERE cy.outcome=''pending'' AND NOT vi.fase1 AND ((TG_TABLE_NAME');
  if position('NOT vi.fase1' in d) = 0 then raise exception 'visit_contact_changed não ajustado'; end if;
  execute d;
end $$;
;
