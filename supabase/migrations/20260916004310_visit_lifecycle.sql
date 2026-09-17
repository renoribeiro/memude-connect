-- Persistent visit workflow. Disabled until an administrator completes setup.
GRANT USAGE ON SCHEMA private TO service_role;
CREATE TABLE public.visit_automation_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  closer_phone text NOT NULL DEFAULT '',
  group_jid text NOT NULL DEFAULT '',
  instance_id uuid REFERENCES public.evolution_instances(id),
  spreadsheet_id text NOT NULL DEFAULT '1Oycr_RxrO0syRw0n4IdNWfmPVfJPVfXkqbI8eKjmapI',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.visit_automation_config(id) VALUES (true);

CREATE TABLE public.visit_cycles (
  visita_id uuid PRIMARY KEY REFERENCES public.visitas(id) ON DELETE CASCADE,
  previous_visita_id uuid UNIQUE REFERENCES public.visitas(id),
  revision integer NOT NULL DEFAULT 1,
  scheduled_at timestamptz NOT NULL,
  client_confirmed boolean,
  broker_confirmed boolean,
  outcome text NOT NULL DEFAULT 'pending' CHECK(outcome IN ('pending','held','not_held','cancelled','rescheduled','withdrawn')),
  reason text,
  rating smallint CHECK(rating BETWEEN 0 AND 10),
  recovery_open boolean NOT NULL DEFAULT false,
  attendance_overdue boolean NOT NULL DEFAULT false,
  confirmation_overdue boolean NOT NULL DEFAULT false,
  feedback jsonb,
  feedback_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visit_cycles_pending ON public.visit_cycles(scheduled_at) WHERE outcome='pending';
CREATE TABLE public.visit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL REFERENCES public.visit_cycles(visita_id) ON DELETE CASCADE,
  revision integer NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visit_events_visit ON public.visit_events(visita_id,created_at);
CREATE TABLE public.visit_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL REFERENCES public.visit_cycles(visita_id) ON DELETE CASCADE,
  revision integer NOT NULL,
  kind text NOT NULL CHECK(kind IN ('eve','h2','attendance','reason','rating')),
  audience text NOT NULL CHECK(audience IN ('client','broker')),
  phone text NOT NULL,
  answered_at timestamptz,
  sent_at timestamptz,
  expires_at timestamptz NOT NULL,
  UNIQUE(visita_id,revision,kind,audience)
);
CREATE TABLE public.visit_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL REFERENCES public.visit_cycles(visita_id) ON DELETE CASCADE,
  revision integer NOT NULL,
  event_id uuid REFERENCES public.visit_events(id) ON DELETE CASCADE,
  prompt_id uuid REFERENCES public.visit_prompts(id) ON DELETE CASCADE,
  destination text NOT NULL CHECK(destination IN ('client','broker','closer','group','sheets')),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed','obsolete')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  leased_until timestamptz,
  last_error text,
  provider_id text,
  sent_at timestamptz,
  urgent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id,destination), UNIQUE(prompt_id,destination)
);
CREATE INDEX visit_outbox_due ON public.visit_outbox(available_at) WHERE status IN ('pending','processing');
CREATE INDEX visit_outbox_visit ON public.visit_outbox(visita_id,created_at DESC);
CREATE INDEX visit_prompts_recipient ON public.visit_prompts(phone,expires_at) WHERE answered_at IS NULL;
CREATE TABLE public.visit_inbound_receipts (
  message_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only server RPCs write workflow data. UI reads through an authorized Edge Function.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['visit_automation_config','visit_cycles','visit_events','visit_prompts','visit_outbox','visit_inbound_receipts'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.visit_emit(p_visit uuid,p_kind text,p_payload jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE eid uuid; rev integer; dest text;
BEGIN
  SELECT revision INTO STRICT rev FROM public.visit_cycles WHERE visita_id=p_visit;
  INSERT INTO public.visit_events(visita_id,revision,kind,payload) VALUES(p_visit,rev,p_kind,p_payload) RETURNING id INTO eid;
  FOREACH dest IN ARRAY ARRAY['closer','group','sheets'] LOOP
    INSERT INTO public.visit_outbox(visita_id,revision,event_id,destination,urgent)
    VALUES(p_visit,rev,eid,dest,p_kind IN ('not_held','cancelled','broker_declined','attendance_overdue','confirmation_overdue','reason','withdrawn','rescheduled','missing_broker'));
  END LOOP;
  IF p_kind IN ('scheduled','changed','client_confirmed','broker_confirmed','cancelled','rescheduled') THEN
    FOREACH dest IN ARRAY ARRAY['client','broker'] LOOP
      INSERT INTO public.visit_outbox(visita_id,revision,event_id,destination,urgent)
        VALUES(p_visit,rev,eid,dest,p_kind IN ('cancelled','rescheduled'));
    END LOOP;
  END IF;
  RETURN eid;
END $$;

CREATE OR REPLACE FUNCTION private.visit_prompt(p_visit uuid,p_kind text,p_audience text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.visit_cycles; ph text; pid uuid;
BEGIN
  SELECT * INTO STRICT c FROM public.visit_cycles WHERE visita_id=p_visit;
  SELECT CASE WHEN p_audience='client' THEN l.telefone ELSE b.whatsapp END INTO ph
    FROM public.visitas v JOIN public.leads l ON l.id=v.lead_id LEFT JOIN public.corretores b ON b.id=v.corretor_id WHERE v.id=p_visit;
  IF left(btrim(COALESCE(ph,'')),1)<>'+' AND length(regexp_replace(ph,'\D','','g')) IN (10,11) THEN ph:='55'||ph; END IF;
  ph:=regexp_replace(COALESCE(ph,''),'\D','','g');
  IF ph='' THEN RETURN; END IF;
  INSERT INTO public.visit_prompts(visita_id,revision,kind,audience,phone,expires_at)
    VALUES(p_visit,c.revision,p_kind,p_audience,ph,CASE WHEN p_kind IN ('eve','h2') THEN c.scheduled_at ELSE greatest(c.scheduled_at,now())+interval '7 days' END)
    ON CONFLICT DO NOTHING RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO public.visit_outbox(visita_id,revision,prompt_id,destination,urgent)
      VALUES(p_visit,c.revision,pid,p_audience,p_kind='attendance');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.visit_capture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.visit_cycles; at_time timestamptz; enabled_now boolean;
BEGIN
  SELECT enabled INTO enabled_now FROM public.visit_automation_config WHERE id;
  at_time:=(NEW.data_visita+NEW.horario_visita) AT TIME ZONE 'America/Sao_Paulo';
  SELECT * INTO c FROM public.visit_cycles WHERE visita_id=NEW.id FOR UPDATE;
  IF NOT FOUND THEN
    IF NOT COALESCE(enabled_now,false) OR NEW.deleted_at IS NOT NULL OR at_time<=now() OR NEW.status NOT IN ('agendada','confirmada','reagendada') THEN RETURN NEW; END IF;
    INSERT INTO public.visit_cycles(visita_id,scheduled_at) VALUES(NEW.id,at_time);
    PERFORM private.visit_emit(NEW.id,'scheduled');
    IF NEW.corretor_id IS NULL THEN PERFORM private.visit_emit(NEW.id,'missing_broker'); END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND c.recovery_open AND
    ((NEW.data_visita,NEW.horario_visita,NEW.corretor_id,NEW.lead_id,NEW.empreendimento_id)
      IS DISTINCT FROM (OLD.data_visita,OLD.horario_visita,OLD.corretor_id,OLD.lead_id,OLD.empreendimento_id)
      OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status<>'cancelada')) THEN
    RAISE EXCEPTION 'Use Reagendar no acompanhamento para preservar a visita anterior';
  END IF;
  IF NEW.deleted_at IS NOT NULL OR NEW.status='cancelada' THEN
    IF c.outcome='pending' THEN
      UPDATE public.visit_cycles SET outcome='cancelled',recovery_open=true,updated_at=now() WHERE visita_id=NEW.id;
      PERFORM private.visit_emit(NEW.id,'cancelled');
    END IF;
    UPDATE public.visit_prompts SET expires_at=now() WHERE visita_id=NEW.id AND answered_at IS NULL;
    UPDATE public.visit_outbox SET status='obsolete' WHERE visita_id=NEW.id AND prompt_id IS NOT NULL AND status='pending';
  ELSIF TG_OP='UPDATE' AND (NEW.data_visita,NEW.horario_visita,NEW.corretor_id,NEW.lead_id,NEW.empreendimento_id)
    IS DISTINCT FROM (OLD.data_visita,OLD.horario_visita,OLD.corretor_id,OLD.lead_id,OLD.empreendimento_id) THEN
    IF c.recovery_open THEN RAISE EXCEPTION 'Use Reagendar no acompanhamento para preservar a visita anterior'; END IF;
    UPDATE public.visit_prompts SET expires_at=now() WHERE visita_id=NEW.id AND answered_at IS NULL;
    UPDATE public.visit_outbox SET status='obsolete' WHERE visita_id=NEW.id AND status='pending' AND destination IN ('client','broker');
    UPDATE public.visit_cycles SET revision=revision+1,scheduled_at=at_time,client_confirmed=null,broker_confirmed=null,
      outcome='pending',attendance_overdue=false,confirmation_overdue=false,rating=null,feedback=null,feedback_at=null,reason=null,updated_at=now() WHERE visita_id=NEW.id;
    PERFORM private.visit_emit(NEW.id,'changed');
  ELSIF NEW.status='realizada' AND c.outcome='pending' THEN
    UPDATE public.visit_cycles SET outcome='held',attendance_overdue=false,confirmation_overdue=false,updated_at=now() WHERE visita_id=NEW.id;
    PERFORM private.visit_emit(NEW.id,'held');
    PERFORM private.visit_prompt(NEW.id,'rating','client');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER visit_lifecycle_capture AFTER INSERT OR UPDATE ON public.visitas FOR EACH ROW EXECUTE FUNCTION private.visit_capture();

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
      ELSIF c.scheduled_at<=now()+interval '2 hours' THEN
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

-- Replies carry an unguessable prompt ID and must match the original recipient.
CREATE OR REPLACE FUNCTION public.visit_lifecycle_reply(p_prompt uuid,p_phone text,p_answer text,p_message text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE pr public.visit_prompts; c public.visit_cycles; answer text:=lower(btrim(p_answer));
BEGIN
  SELECT * INTO pr FROM public.visit_prompts WHERE id=p_prompt;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO c FROM public.visit_cycles WHERE visita_id=pr.visita_id FOR UPDATE;
  SELECT * INTO pr FROM public.visit_prompts WHERE id=p_prompt FOR UPDATE;
  IF pr.phone<>p_phone OR pr.revision<>c.revision OR pr.expires_at<now() OR pr.answered_at IS NOT NULL THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.visitas WHERE id=c.visita_id AND deleted_at IS NOT NULL) THEN RETURN false; END IF;
  IF pr.kind IN ('eve','h2','attendance') AND answer NOT IN ('sim','nao') THEN RETURN false; END IF;
  IF pr.kind='rating' AND (answer !~ '^(10|[0-9])$' OR c.outcome<>'held') THEN RETURN false; END IF;
  IF pr.kind='reason' AND (length(answer)<3 OR length(answer)>2000 OR NOT c.recovery_open) THEN RETURN false; END IF;
  IF pr.kind IN ('eve','h2','attendance') AND c.outcome<>'pending' THEN RETURN false; END IF;
  INSERT INTO public.visit_inbound_receipts(message_id) VALUES(p_message) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.visit_prompts SET answered_at=now() WHERE id=p_prompt;
  IF pr.kind IN ('eve','h2') THEN
    UPDATE public.visit_cycles SET
      client_confirmed=CASE WHEN pr.audience='client' THEN answer='sim' ELSE client_confirmed END,
      broker_confirmed=CASE WHEN pr.audience='broker' THEN answer='sim' ELSE broker_confirmed END,
      recovery_open=recovery_open OR answer='nao',updated_at=now() WHERE visita_id=c.visita_id;
    UPDATE public.visitas SET
      lead_confirmou=CASE WHEN pr.audience='client' THEN answer='sim' ELSE lead_confirmou END,
      corretor_confirmou=CASE WHEN pr.audience='broker' THEN answer='sim' ELSE corretor_confirmou END WHERE id=c.visita_id;
    IF answer='nao' AND pr.audience='client' THEN
      UPDATE public.visitas SET status='cancelada' WHERE id=c.visita_id;
      PERFORM private.visit_prompt(c.visita_id,'reason','client');
    ELSE
      PERFORM private.visit_emit(c.visita_id,CASE WHEN answer='nao' THEN 'broker_declined' ELSE pr.audience||'_confirmed' END);
    END IF;
    UPDATE public.visit_cycles SET confirmation_overdue=false WHERE visita_id=c.visita_id AND client_confirmed AND broker_confirmed;
    UPDATE public.visitas SET status='confirmada' WHERE id=c.visita_id AND EXISTS(
      SELECT 1 FROM public.visit_cycles WHERE visita_id=c.visita_id AND client_confirmed AND broker_confirmed AND outcome='pending');
  ELSIF pr.kind='attendance' THEN
    UPDATE public.visit_cycles SET outcome=CASE WHEN answer='sim' THEN 'held' ELSE 'not_held' END,
      attendance_overdue=false,confirmation_overdue=false,recovery_open=answer='nao',updated_at=now() WHERE visita_id=c.visita_id;
    UPDATE public.visitas SET status=CASE WHEN answer='sim' THEN 'realizada' ELSE 'cancelada' END WHERE id=c.visita_id;
    PERFORM private.visit_emit(c.visita_id,CASE WHEN answer='sim' THEN 'held' ELSE 'not_held' END);
    PERFORM private.visit_prompt(c.visita_id,CASE WHEN answer='sim' THEN 'rating' ELSE 'reason' END,CASE WHEN answer='sim' THEN 'client' ELSE 'broker' END);
  ELSIF pr.kind='rating' THEN
    UPDATE public.visit_cycles SET rating=answer::smallint,updated_at=now() WHERE visita_id=c.visita_id;
    PERFORM private.visit_emit(c.visita_id,'rating',jsonb_build_object('rating',answer::integer));
  ELSE
    UPDATE public.visit_cycles SET reason=p_answer,updated_at=now() WHERE visita_id=c.visita_id;
    PERFORM private.visit_emit(c.visita_id,'reason',jsonb_build_object('reason',p_answer));
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.visit_lifecycle_action(p_visit uuid,p_action text,p_data jsonb,p_actor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.visit_cycles; v public.visitas; new_id uuid; new_at timestamptz;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  SELECT * INTO STRICT v FROM public.visitas WHERE id=p_visit FOR UPDATE;
  SELECT * INTO STRICT c FROM public.visit_cycles WHERE visita_id=p_visit FOR UPDATE;
  IF p_action='feedback' THEN
    IF c.outcome<>'held' OR length(COALESCE(p_data->>'next_step',''))<3 OR NULLIF(p_data->>'return_at','') IS NULL THEN RAISE EXCEPTION 'Informe próximo passo e prazo para uma visita realizada'; END IF;
    PERFORM (p_data->>'return_at')::date;
    UPDATE public.visit_cycles SET feedback=p_data,feedback_at=now(),updated_at=now() WHERE visita_id=p_visit;
    UPDATE public.visitas SET interesse=(p_data->>'interest')::boolean,
      feedback_corretor=concat('Interesse: ',p_data->>'interest',E'\nObjeções: ',p_data->>'objections',E'\nPróximo passo: ',p_data->>'next_step',E'\nRetorno: ',p_data->>'return_at') WHERE id=p_visit;
    PERFORM private.visit_emit(p_visit,'feedback',jsonb_build_object('actor',p_actor));
  ELSIF p_action='withdraw' THEN
    IF NOT c.recovery_open OR length(btrim(COALESCE(p_data->>'reason','')))<3 THEN RAISE EXCEPTION 'Informe o motivo da desistência'; END IF;
    UPDATE public.visit_cycles SET outcome='withdrawn',reason=p_data->>'reason',recovery_open=false,attendance_overdue=false,confirmation_overdue=false,updated_at=now() WHERE visita_id=p_visit;
    UPDATE public.visit_prompts SET expires_at=now() WHERE visita_id=p_visit AND answered_at IS NULL;
    PERFORM private.visit_emit(p_visit,'withdrawn',jsonb_build_object('actor',p_actor));
  ELSIF p_action='reschedule' THEN
    IF NOT c.recovery_open THEN RAISE EXCEPTION 'Esta visita não tem recuperação pendente'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.visit_automation_config WHERE enabled) THEN RAISE EXCEPTION 'Ative a automação antes de reagendar'; END IF;
    new_at:=((p_data->>'date')::date+(p_data->>'time')::time) AT TIME ZONE 'America/Sao_Paulo';
    IF new_at IS NULL OR new_at<=now() THEN RAISE EXCEPTION 'Informe uma data futura'; END IF;
    INSERT INTO public.visitas(lead_id,corretor_id,empreendimento_id,data_visita,horario_visita,status)
      VALUES(v.lead_id,COALESCE(NULLIF(p_data->>'broker_id','')::uuid,v.corretor_id),v.empreendimento_id,(p_data->>'date')::date,(p_data->>'time')::time,'agendada') RETURNING id INTO new_id;
    UPDATE public.visit_cycles SET previous_visita_id=p_visit WHERE visita_id=new_id;
    UPDATE public.visit_cycles SET outcome='rescheduled',recovery_open=false,attendance_overdue=false,confirmation_overdue=false,updated_at=now() WHERE visita_id=p_visit;
    UPDATE public.visitas SET status='reagendada' WHERE id=p_visit;
    UPDATE public.visit_prompts SET expires_at=now() WHERE visita_id=p_visit AND answered_at IS NULL;
    PERFORM private.visit_emit(p_visit,'rescheduled',jsonb_build_object('new_visit',new_id,'actor',p_actor));
    RETURN new_id;
  ELSIF p_action='replace_broker' THEN
    IF c.outcome<>'pending' OR c.broker_confirmed IS DISTINCT FROM false OR c.scheduled_at<=now() THEN RAISE EXCEPTION 'Substituição disponível somente antes da visita, quando o corretor recusou'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.corretores WHERE id=(p_data->>'broker_id')::uuid AND status='ativo') THEN RAISE EXCEPTION 'Selecione um corretor ativo'; END IF;
    IF v.corretor_id=(p_data->>'broker_id')::uuid THEN RAISE EXCEPTION 'Selecione outro corretor'; END IF;
    UPDATE public.visit_cycles SET recovery_open=false WHERE visita_id=p_visit;
    UPDATE public.visitas SET corretor_id=(p_data->>'broker_id')::uuid,lead_confirmou=null,corretor_confirmou=null WHERE id=p_visit;
  ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
  RETURN p_visit;
END $$;

-- Keep the existing authenticated cron command; only improve its cadence.
DO $$ DECLARE j record; BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOR j IN EXECUTE 'SELECT jobname,command FROM cron.job WHERE jobname=''memude-monitor-visits''' LOOP
      PERFORM cron.schedule(j.jobname,'* * * * *',j.command);
    END LOOP;
  END IF;
END $$;

-- One leased batch globally: prevents concurrent spreadsheet append operations.
CREATE OR REPLACE FUNCTION public.visit_lifecycle_claim(p_limit integer DEFAULT 10)
RETURNS SETOF public.visit_outbox LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE hour_now integer:=extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo');
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.visit_automation_config WHERE enabled) THEN RETURN; END IF;
  IF NOT pg_try_advisory_xact_lock(81742619) THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.visit_outbox WHERE status='processing' AND leased_until>now()) THEN RETURN; END IF;
  RETURN QUERY WITH batch AS (
    SELECT id FROM public.visit_outbox WHERE
      ((status='pending' AND available_at<=now()) OR (status='processing' AND leased_until<=now()))
      AND (urgent OR destination='sheets' OR hour_now BETWEEN 7 AND 19)
      ORDER BY urgent DESC,created_at LIMIT least(greatest(p_limit,1),10) FOR UPDATE SKIP LOCKED
  ) UPDATE public.visit_outbox o SET status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),leased_until=now()+interval '10 minutes'
    FROM batch WHERE o.id=batch.id RETURNING o.*;
END $$;

CREATE OR REPLACE FUNCTION public.visit_lifecycle_finish(p_id uuid,p_lease uuid,p_status text,p_error text DEFAULT NULL,p_provider text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.visit_outbox; pr public.visit_prompts;
BEGIN
  SELECT * INTO o FROM public.visit_outbox WHERE id=p_id AND lease_token=p_lease AND status='processing' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF p_status NOT IN ('sent','failed','obsolete') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  UPDATE public.visit_outbox SET status=CASE WHEN p_status='failed' AND attempts<5 THEN 'pending' ELSE p_status END,
    available_at=now()+least(attempts*attempts,60)*interval '1 minute',leased_until=null,
    last_error=left(p_error,500),provider_id=p_provider,sent_at=CASE WHEN p_status='sent' THEN now() ELSE null END WHERE id=p_id;
  IF p_status='sent' AND o.prompt_id IS NOT NULL THEN
    UPDATE public.visit_prompts SET sent_at=COALESCE(sent_at,now()) WHERE id=o.prompt_id RETURNING * INTO pr;
    PERFORM private.visit_emit(o.visita_id,'prompt_sent',jsonb_build_object('kind',pr.kind,'audience',pr.audience));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.visit_lifecycle_remind(p_visit uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.visit_cycles;
BEGIN
  SELECT * INTO STRICT c FROM public.visit_cycles WHERE visita_id=p_visit FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.visit_automation_config WHERE enabled) THEN RAISE EXCEPTION 'Automação pausada'; END IF;
  IF c.outcome<>'pending' OR c.scheduled_at<=now() THEN RAISE EXCEPTION 'Visita não permite lembrete'; END IF;
  PERFORM private.visit_prompt(p_visit,'h2','client');
  PERFORM private.visit_prompt(p_visit,'h2','broker');
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'visit_lifecycle_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
  FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='private'::regnamespace AND proname IN ('visit_emit','visit_prompt','visit_capture') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
END $$;
