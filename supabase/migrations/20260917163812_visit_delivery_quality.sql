-- Independent sheet worker, contact revision, operational receipts and CRM projection.
CREATE FUNCTION private.visit_reminder_due(p_at timestamptz) RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT (CASE WHEN extract(hour FROM d)<7 THEN date_trunc('day',d)-interval '1 day'+interval '19 hours' WHEN extract(hour FROM d)>=20 THEN date_trunc('day',d)+interval '19 hours' ELSE d END) AT TIME ZONE 'America/Sao_Paulo' FROM (SELECT (p_at AT TIME ZONE 'America/Sao_Paulo')-interval '2 hours' AS d) s
$$;
REVOKE ALL ON FUNCTION private.visit_reminder_due(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.visit_reminder_due(timestamptz) TO service_role;
ALTER TABLE public.visit_intake_outbox ADD COLUMN notification_kind text NOT NULL DEFAULT 'result';
ALTER TABLE public.visit_intake_outbox DROP CONSTRAINT visit_intake_outbox_intake_id_revision_destination_key;
ALTER TABLE public.visit_intake_outbox ADD UNIQUE(intake_id,revision,destination,notification_kind);
CREATE OR REPLACE FUNCTION private.visit_intake_notify(p_id uuid,p_text text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.visit_intake;
BEGIN
 SELECT * INTO STRICT r FROM public.visit_intake WHERE id=p_id;
 INSERT INTO public.visit_intake_outbox(intake_id,revision,destination,body)
 SELECT r.id,r.revision,d,'Agendamento AG-'||r.protocol||' V'||r.revision||E'\n'||p_text FROM unnest(ARRAY['group','closer']) d
 ON CONFLICT(intake_id,revision,destination,notification_kind) DO NOTHING;
END $$;
CREATE FUNCTION private.visit_intake_ack() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.visit_intake_outbox(intake_id,revision,destination,notification_kind,body)
 SELECT NEW.id,NEW.revision,d,'ack','Pedido recebido: AG-'||NEW.protocol||' V'||NEW.revision||E'\nAguardando análise. Para corrigir ou cancelar, responda citando esta mensagem. O cadastro só estará concluído após a confirmação do sistema.' FROM unnest(ARRAY['group','closer']) d;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.visit_intake_ack() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER visit_intake_ack AFTER INSERT ON public.visit_intake FOR EACH ROW EXECUTE FUNCTION private.visit_intake_ack();

CREATE OR REPLACE FUNCTION public.visit_intake_delivery_claim() RETURNS SETOF public.visit_intake_outbox LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.visit_automation_config WHERE enabled AND intake_enabled) THEN RETURN; END IF;
 UPDATE public.visit_intake_outbox SET status='failed',delivery_state='unknown',leased_until=null,last_error='Execução interrompida; verificar entrega antes de reenviar' WHERE status='processing' AND leased_until<now();
 RETURN QUERY WITH next AS (SELECT id FROM public.visit_intake_outbox WHERE status='pending' AND available_at<=now() ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED)
 UPDATE public.visit_intake_outbox o SET status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes' FROM next WHERE o.id=next.id RETURNING o.*;
END $$;

CREATE OR REPLACE FUNCTION private.visit_contact_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v record;
BEGIN
 IF (to_jsonb(NEW)->>'telefone',to_jsonb(NEW)->>'whatsapp') IS NOT DISTINCT FROM (to_jsonb(OLD)->>'telefone',to_jsonb(OLD)->>'whatsapp') THEN RETURN NEW; END IF;
 FOR v IN SELECT cy.visita_id FROM public.visit_cycles cy JOIN public.visitas vi ON vi.id=cy.visita_id WHERE cy.outcome='pending' AND ((TG_TABLE_NAME='leads' AND vi.lead_id=NEW.id) OR (TG_TABLE_NAME='corretores' AND vi.corretor_id=NEW.id)) ORDER BY cy.visita_id FOR UPDATE OF vi LOOP
   UPDATE public.visit_cycles SET revision=revision+1,client_confirmed=null,broker_confirmed=null,confirmation_overdue=false,updated_at=now() WHERE visita_id=v.visita_id AND outcome='pending';
   IF NOT FOUND THEN CONTINUE; END IF;
   UPDATE public.visitas SET lead_confirmou=null,corretor_confirmou=null,status='agendada' WHERE id=v.visita_id;
   UPDATE public.visit_prompts SET expires_at=now() WHERE visita_id=v.visita_id AND answered_at IS NULL;
   UPDATE public.visit_outbox SET status='obsolete' WHERE visita_id=v.visita_id AND status='pending' AND destination IN ('client','broker');
   PERFORM private.visit_emit(v.visita_id,'changed',jsonb_build_object('source','contact_change'));
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.visit_contact_changed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER visit_contact_changed AFTER UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION private.visit_contact_changed();
CREATE TRIGGER visit_contact_changed AFTER UPDATE ON public.corretores FOR EACH ROW EXECUTE FUNCTION private.visit_contact_changed();

-- Project visit events into matching existing stages; never regress sales/documentation stages.
CREATE OR REPLACE FUNCTION private.visit_project_crm() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE stage_name text;
BEGIN
 IF NEW.kind IN ('scheduled','changed','client_confirmed','broker_confirmed') THEN stage_name:='Visita Agendada';
 ELSIF NEW.kind='held' THEN stage_name:='Visita Realizada';
 ELSIF NEW.kind IN ('not_held','cancelled','broker_declined','rescheduled') THEN stage_name:='Reagendando';
 ELSIF NEW.kind='withdrawn' THEN stage_name:='Bolsão'; ELSE RETURN NEW; END IF;
 IF to_regclass('public.crm_leads') IS NOT NULL THEN
 UPDATE public.crm_leads op SET stage_id=target.id,moved_at=now(),updated_at=now()
 FROM public.crm_stages target,public.crm_stages current_stage
 WHERE op.visita_id=NEW.visita_id AND target.pipeline_id=op.pipeline_id AND target.nome=stage_name AND current_stage.id=op.stage_id AND current_stage.nome IN ('Bolsão','Visita Agendada','Visita Realizada','Reagendando');
 END IF;
 IF NEW.kind IN ('scheduled','changed') THEN
 UPDATE public.leads SET status='visita_agendada' WHERE id=(SELECT lead_id FROM public.visitas WHERE id=NEW.visita_id) AND status::text IN ('novo','em_contato','em_conversa','interessado','visita_agendada','visita_confirmada');
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.visit_project_crm() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER visit_project_crm AFTER INSERT ON public.visit_events FOR EACH ROW EXECUTE FUNCTION private.visit_project_crm();

-- Apply direct-partition restrictions to present and future log partitions.
DO $$ DECLARE p record; definition text; BEGIN
 FOR p IN SELECT c.oid::regclass AS tbl FROM pg_inherits i JOIN pg_class c ON c.oid=i.inhrelid JOIN pg_class parent ON parent.oid=i.inhparent WHERE parent.relname IN ('audit_logs','integration_logs') AND parent.relnamespace='public'::regnamespace LOOP
 EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',p.tbl);
 EXECUTE format('REVOKE ALL ON %s FROM PUBLIC,anon,authenticated',p.tbl);
 END LOOP;
 IF to_regprocedure('public.ensure_monthly_log_partitions(integer)') IS NOT NULL THEN
 SELECT pg_get_functiondef('public.ensure_monthly_log_partitions(integer)'::regprocedure) INTO definition;
 IF position('REVOKE ALL' IN definition)=0 THEN
 definition:=replace(definition,'v_created := v_created + 1;',E'execute format(''ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY'', v_partition);\n        execute format(''REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated'', v_partition);\n        v_created := v_created + 1;');
 EXECUTE definition;
 END IF;
 END IF;
END $$;

DO $$ DECLARE command_text text; BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
 EXECUTE 'SELECT command FROM cron.job WHERE jobname=''memude-monitor-visits''' INTO command_text;
 IF command_text IS NOT NULL THEN PERFORM cron.schedule('memude-visit-sheets','* * * * *',replace(command_text,'/functions/v1/monitor-visits','/functions/v1/visit-sheets-worker')); END IF;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.visit_lifecycle_tick()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c record; local_now timestamp:=now() AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.visit_automation_config WHERE enabled) THEN RETURN; END IF;
  FOR c IN SELECT cy.*,v.corretor_id FROM public.visit_cycles cy JOIN public.visitas v ON v.id=cy.visita_id
    WHERE cy.outcome='pending' AND v.deleted_at IS NULL FOR UPDATE OF cy SKIP LOCKED LOOP
    IF c.scheduled_at>now() AND extract(hour FROM local_now)>=7 AND extract(hour FROM local_now)<20 THEN
      IF (c.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date=local_now::date+1 THEN
        PERFORM private.visit_prompt(c.visita_id,'eve','client'); PERFORM private.visit_prompt(c.visita_id,'eve','broker');
      END IF;
      IF now()>=private.visit_reminder_due(c.scheduled_at) THEN
        PERFORM private.visit_prompt(c.visita_id,'h2','client'); PERFORM private.visit_prompt(c.visita_id,'h2','broker');
      END IF;
    END IF;
    IF c.scheduled_at<=now()+interval '1 hour' AND NOT c.confirmation_overdue AND (c.client_confirmed IS DISTINCT FROM true OR c.broker_confirmed IS DISTINCT FROM true) THEN
      UPDATE public.visit_cycles SET confirmation_overdue=true WHERE visita_id=c.visita_id;
      PERFORM private.visit_emit(c.visita_id,'confirmation_overdue');
    END IF;
    IF c.scheduled_at<=now()-interval '1 hour' THEN PERFORM private.visit_prompt(c.visita_id,'attendance','broker'); END IF;
    IF c.scheduled_at<=now()-interval '2 hours' AND NOT c.attendance_overdue THEN
      UPDATE public.visit_cycles SET attendance_overdue=true WHERE visita_id=c.visita_id;
      PERFORM private.visit_emit(c.visita_id,'attendance_overdue');
    END IF;
  END LOOP;
END $$;
