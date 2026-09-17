-- Quality hardening. Existing event history is retained.
ALTER TABLE public.visit_outbox ADD COLUMN delivery_state text NOT NULL DEFAULT 'queued' CHECK(delivery_state IN ('queued','accepted','delivered','read','failed','unknown'));
ALTER TABLE public.visit_intake_outbox ADD COLUMN delivery_state text NOT NULL DEFAULT 'queued' CHECK(delivery_state IN ('queued','accepted','delivered','read','failed','unknown'));
CREATE INDEX visit_outbox_provider ON public.visit_outbox(provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX visit_intake_outbox_provider ON public.visit_intake_outbox(provider_id) WHERE provider_id IS NOT NULL;
CREATE TABLE public.visit_worker_health(name text PRIMARY KEY,last_started timestamptz,last_completed timestamptz,last_error text);
CREATE TABLE public.visit_ai_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now(),kind text NOT NULL,model text NOT NULL,latency_ms integer,tokens integer,status text NOT NULL);
ALTER TABLE public.visit_ai_runs ADD COLUMN trace_id text,ADD COLUMN prompt_version text NOT NULL DEFAULT 'visit-intake-v2',ADD COLUMN evidence jsonb NOT NULL DEFAULT '{}';
CREATE TABLE public.visit_delivery_receipts(provider_id text PRIMARY KEY,state text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.visit_delivery_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visit_delivery_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.visit_delivery_receipts TO service_role;
ALTER TABLE public.visit_worker_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_ai_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visit_worker_health,public.visit_ai_runs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.visit_worker_health,public.visit_ai_runs TO service_role;

CREATE FUNCTION public.visit_delivery_receipt(p_provider text,p_state text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t text;
BEGIN
 IF p_state NOT IN ('accepted','delivered','read','failed') OR COALESCE(p_provider,'')='' THEN RETURN; END IF;
 INSERT INTO public.visit_delivery_receipts(provider_id,state) VALUES(p_provider,p_state) ON CONFLICT(provider_id) DO UPDATE SET state=EXCLUDED.state,updated_at=now() WHERE visit_delivery_receipts.state<>'read' AND NOT(visit_delivery_receipts.state='delivered' AND EXCLUDED.state IN ('accepted','failed'));
 SELECT state INTO p_state FROM public.visit_delivery_receipts WHERE provider_id=p_provider;
 FOREACH t IN ARRAY ARRAY['visit_outbox','visit_intake_outbox'] LOOP
   EXECUTE format('UPDATE public.%I SET delivery_state=$1,status=CASE WHEN $1=''failed'' THEN ''failed'' ELSE ''sent'' END,last_error=CASE WHEN $1=''failed'' THEN ''Provedor informou falha de entrega; revisar destino antes de reenviar'' ELSE null END WHERE provider_id=$2 AND delivery_state<>''read'' AND NOT (delivery_state=''delivered'' AND $1 IN (''accepted'',''failed''))',t) USING p_state,p_provider;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.visit_delivery_receipt(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.visit_delivery_receipt(text,text) TO service_role;
CREATE FUNCTION private.visit_apply_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE state text; BEGIN
 IF NEW.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN
 SELECT r.state INTO state FROM public.visit_delivery_receipts r WHERE r.provider_id=NEW.provider_id;
 IF state IS NOT NULL THEN PERFORM public.visit_delivery_receipt(NEW.provider_id,state); END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.visit_apply_receipt() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER visit_apply_receipt AFTER UPDATE OF provider_id ON public.visit_outbox FOR EACH ROW EXECUTE FUNCTION private.visit_apply_receipt();
CREATE TRIGGER visit_apply_receipt AFTER UPDATE OF provider_id ON public.visit_intake_outbox FOR EACH ROW EXECUTE FUNCTION private.visit_apply_receipt();

DROP FUNCTION public.visit_lifecycle_claim(integer);
CREATE FUNCTION public.visit_lifecycle_claim(p_limit integer DEFAULT 10,p_channel text DEFAULT 'whatsapp') RETURNS SETOF public.visit_outbox LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE hour_now integer:=extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo');
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.visit_automation_config WHERE enabled) THEN RETURN; END IF;
 IF p_channel NOT IN ('whatsapp','sheets') THEN RAISE EXCEPTION 'Canal inválido'; END IF;
 IF NOT pg_try_advisory_xact_lock(CASE WHEN p_channel='sheets' THEN 81742619 ELSE 81742620 END) THEN RETURN; END IF;
 UPDATE public.visit_outbox SET status='failed',delivery_state='unknown',last_error='Execução interrompida; verificar entrega antes de reenviar',leased_until=null WHERE status='processing' AND leased_until<=now() AND destination<>'sheets';
 IF p_channel='sheets' AND EXISTS(SELECT 1 FROM public.visit_outbox WHERE destination='sheets' AND status='processing' AND leased_until>now()) THEN RETURN; END IF;
 RETURN QUERY WITH batch AS (
 SELECT id FROM public.visit_outbox WHERE ((status='pending' AND available_at<=now()) OR (status='processing' AND leased_until<=now() AND destination='sheets'))
 AND ((p_channel='sheets')=(destination='sheets')) AND (urgent OR destination='sheets' OR hour_now BETWEEN 7 AND 19)
 ORDER BY urgent DESC,created_at LIMIT CASE WHEN p_channel='sheets' THEN 1 ELSE least(greatest(p_limit,1),5) END FOR UPDATE SKIP LOCKED
 ) UPDATE public.visit_outbox o SET status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes' FROM batch WHERE o.id=batch.id RETURNING o.*;
END $$;
REVOKE ALL ON FUNCTION public.visit_lifecycle_claim(integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.visit_lifecycle_claim(integer,text) TO service_role;
CREATE OR REPLACE FUNCTION private.visit_validate_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.visit_cycles; conflicts uuid[]; approved uuid[]; changed boolean;
BEGIN
  SELECT * INTO c FROM public.visit_cycles WHERE visita_id=NEW.id;
  changed:=TG_OP='INSERT';
  IF TG_OP='UPDATE' THEN
    changed:=(NEW.data_visita,NEW.horario_visita,NEW.corretor_id,NEW.lead_id,NEW.empreendimento_id,NEW.meeting_address,NEW.meeting_neighborhood,NEW.customer_profile,NEW.duration_minutes,NEW.buffer_minutes) IS DISTINCT FROM (OLD.data_visita,OLD.horario_visita,OLD.corretor_id,OLD.lead_id,OLD.empreendimento_id,OLD.meeting_address,OLD.meeting_neighborhood,OLD.customer_profile,OLD.duration_minutes,OLD.buffer_minutes);
    IF c.outcome IN ('held','not_held','cancelled','withdrawn','rescheduled') AND (changed OR (NEW.status IN ('agendada','confirmada') AND NEW.status IS DISTINCT FROM OLD.status)) THEN RAISE EXCEPTION 'Visita encerrada: crie um reagendamento vinculado no acompanhamento'; END IF;
    IF changed THEN NEW.lead_confirmou:=null; NEW.corretor_confirmou:=null; IF NEW.status='confirmada' THEN NEW.status:='agendada'; END IF; END IF;
  END IF;
  IF NOT changed AND c.visita_id IS NOT NULL THEN NEW.lead_confirmou:=c.client_confirmed; NEW.corretor_confirmou:=c.broker_confirmed; END IF;
  IF NEW.status='confirmada' AND (c.client_confirmed IS DISTINCT FROM true OR c.broker_confirmed IS DISTINCT FROM true) THEN RAISE EXCEPTION 'A confirmação exige resposta das duas partes no acompanhamento'; END IF;
  IF NEW.deleted_at IS NULL AND NEW.status IN ('agendada','confirmada','reagendada') AND NEW.corretor_id IS NOT NULL AND (changed OR (TG_OP='UPDATE' AND OLD.deleted_at IS NOT NULL)) THEN
    PERFORM 1 FROM public.corretores WHERE id=NEW.corretor_id FOR UPDATE;
    SELECT array_agg(v.id ORDER BY v.id) INTO conflicts FROM public.visitas v WHERE v.id<>NEW.id AND v.corretor_id=NEW.corretor_id AND v.deleted_at IS NULL AND v.status IN ('agendada','confirmada','reagendada') AND NOT EXISTS(SELECT 1 FROM public.visit_cycles cy WHERE cy.visita_id=v.id AND cy.outcome<>'pending')
      AND (NEW.data_visita+NEW.horario_visita)<(v.data_visita+v.horario_visita)+(v.duration_minutes+v.buffer_minutes)*interval '1 minute'
      AND (NEW.data_visita+NEW.horario_visita)+(NEW.duration_minutes+NEW.buffer_minutes)*interval '1 minute'>(v.data_visita+v.horario_visita);
    IF current_setting('role',true) IN ('service_role','none') THEN approved:=string_to_array(NULLIF(current_setting('memude.approved_conflicts',true),''),',')::uuid[]; END IF;
    IF conflicts IS NOT NULL AND (approved IS NULL OR NOT conflicts <@ approved) THEN RAISE EXCEPTION 'Conflito de agenda: reserve 60 minutos + 30 de intervalo. Escolha outro horário ou solicite liberação ao Closer pelo agendamento do grupo.'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.visit_validate_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER visit_validate_change BEFORE INSERT OR UPDATE ON public.visitas FOR EACH ROW EXECUTE FUNCTION private.visit_validate_change();
CREATE OR REPLACE FUNCTION private.visit_capture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.visit_cycles; at_time timestamptz; enabled_now boolean;
BEGIN
  SELECT enabled INTO enabled_now FROM public.visit_automation_config WHERE id;
  at_time:=(NEW.data_visita+NEW.horario_visita) AT TIME ZONE 'America/Sao_Paulo';
  SELECT * INTO c FROM public.visit_cycles WHERE visita_id=NEW.id FOR UPDATE;
  IF NOT FOUND THEN
    IF NEW.deleted_at IS NOT NULL OR at_time<=now() OR NEW.status NOT IN ('agendada','confirmada','reagendada') THEN RETURN NEW; END IF;
    INSERT INTO public.visit_cycles(visita_id,scheduled_at) VALUES(NEW.id,at_time);
    PERFORM private.visit_emit(NEW.id,'scheduled');
    IF NEW.corretor_id IS NULL THEN PERFORM private.visit_emit(NEW.id,'missing_broker'); END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND c.recovery_open AND
    ((NEW.data_visita,NEW.horario_visita,NEW.corretor_id,NEW.lead_id,NEW.empreendimento_id,NEW.meeting_address,NEW.meeting_neighborhood,NEW.customer_profile,NEW.duration_minutes,NEW.buffer_minutes)
      IS DISTINCT FROM (OLD.data_visita,OLD.horario_visita,OLD.corretor_id,OLD.lead_id,OLD.empreendimento_id,OLD.meeting_address,OLD.meeting_neighborhood,OLD.customer_profile,OLD.duration_minutes,OLD.buffer_minutes)
       OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status<>'cancelada' AND NOT(c.outcome='pending' AND NEW.status='agendada'))) THEN
    RAISE EXCEPTION 'Use Reagendar no acompanhamento para preservar a visita anterior';
  END IF;
  IF NEW.deleted_at IS NOT NULL OR NEW.status='cancelada' THEN
    IF c.outcome='pending' THEN
      UPDATE public.visit_cycles SET outcome='cancelled',recovery_open=true,updated_at=now() WHERE visita_id=NEW.id;
      PERFORM private.visit_emit(NEW.id,'cancelled');
    END IF;
    UPDATE public.visit_prompts SET expires_at=now() WHERE visita_id=NEW.id AND answered_at IS NULL;
    UPDATE public.visit_outbox SET status='obsolete' WHERE visita_id=NEW.id AND prompt_id IS NOT NULL AND status='pending';
  ELSIF TG_OP='UPDATE' AND (NEW.data_visita,NEW.horario_visita,NEW.corretor_id,NEW.lead_id,NEW.empreendimento_id,NEW.meeting_address,NEW.meeting_neighborhood,NEW.customer_profile,NEW.duration_minutes,NEW.buffer_minutes)
    IS DISTINCT FROM (OLD.data_visita,OLD.horario_visita,OLD.corretor_id,OLD.lead_id,OLD.empreendimento_id,OLD.meeting_address,OLD.meeting_neighborhood,OLD.customer_profile,OLD.duration_minutes,OLD.buffer_minutes) THEN
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
CREATE OR REPLACE FUNCTION private.visit_prompt(p_visit uuid,p_kind text,p_audience text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.visit_cycles; ph text; pid uuid;
BEGIN
  SELECT * INTO STRICT c FROM public.visit_cycles WHERE visita_id=p_visit;
  SELECT CASE WHEN p_audience='client' THEN l.telefone ELSE COALESCE(NULLIF(b.whatsapp,''),b.telefone) END INTO ph
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
CREATE OR REPLACE FUNCTION public.visit_lifecycle_reply(p_prompt uuid,p_phone text,p_answer text,p_message text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE pr public.visit_prompts; c public.visit_cycles; answer text:=lower(btrim(p_answer));
BEGIN
  SELECT * INTO pr FROM public.visit_prompts WHERE id=p_prompt;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM public.visitas WHERE id=pr.visita_id FOR UPDATE;
  SELECT * INTO c FROM public.visit_cycles WHERE visita_id=pr.visita_id FOR UPDATE;
  SELECT * INTO pr FROM public.visit_prompts WHERE id=p_prompt FOR UPDATE;
  IF pr.phone<>p_phone OR pr.revision<>c.revision OR pr.expires_at<=now() OR pr.answered_at IS NOT NULL THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.visitas WHERE id=c.visita_id AND deleted_at IS NOT NULL) THEN RETURN false; END IF;
  IF pr.kind IN ('eve','h2','attendance') AND answer NOT IN ('sim','nao') THEN RETURN false; END IF;
  IF pr.kind='rating' AND (answer !~ '^(10|[0-9])$' OR c.outcome<>'held') THEN RETURN false; END IF;
  IF pr.kind='reason' AND (length(answer)<3 OR length(answer)>2000 OR NOT c.recovery_open) THEN RETURN false; END IF;
  IF pr.kind IN ('eve','h2','attendance') AND c.outcome<>'pending' THEN RETURN false; END IF;
  INSERT INTO public.visit_inbound_receipts(message_id) VALUES(p_message) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.visit_prompts SET answered_at=now() WHERE id=p_prompt;
  IF pr.kind IN ('eve','h2') THEN
    UPDATE public.visit_prompts SET expires_at=now() WHERE visita_id=pr.visita_id AND revision=pr.revision AND audience=pr.audience AND kind IN ('eve','h2') AND id<>pr.id AND answered_at IS NULL;
  END IF;
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
    UPDATE public.visitas SET status='agendada' WHERE id=c.visita_id AND EXISTS(SELECT 1 FROM public.visit_cycles WHERE visita_id=c.visita_id AND outcome='pending' AND (client_confirmed IS DISTINCT FROM true OR broker_confirmed IS DISTINCT FROM true));
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
  IF p_action='attendance' THEN
    IF c.outcome<>'pending' OR c.scheduled_at>now() OR length(btrim(COALESCE(p_data->>'reason','')))<3 OR p_data->>'held' NOT IN ('true','false') THEN RAISE EXCEPTION 'Informe o resultado apurado e sua justificativa após o horário da visita'; END IF;
    UPDATE public.visit_cycles SET outcome=CASE WHEN (p_data->>'held')::boolean THEN 'held' ELSE 'not_held' END,recovery_open=NOT (p_data->>'held')::boolean,attendance_overdue=false,confirmation_overdue=false,reason=p_data->>'reason',updated_at=now() WHERE visita_id=p_visit;
    UPDATE public.visitas SET status=CASE WHEN (p_data->>'held')::boolean THEN 'realizada' ELSE 'cancelada' END WHERE id=p_visit;
    UPDATE public.visit_prompts SET expires_at=now() WHERE visita_id=p_visit AND answered_at IS NULL;
    PERFORM private.visit_emit(p_visit,CASE WHEN (p_data->>'held')::boolean THEN 'held' ELSE 'not_held' END,jsonb_build_object('actor',p_actor,'source','closer','reason',p_data->>'reason'));
    PERFORM private.visit_prompt(p_visit,CASE WHEN (p_data->>'held')::boolean THEN 'rating' ELSE 'reason' END,CASE WHEN (p_data->>'held')::boolean THEN 'client' ELSE 'broker' END);
  ELSIF p_action='feedback' THEN
    IF c.outcome<>'held' OR length(COALESCE(p_data->>'next_step',''))<3 OR NULLIF(p_data->>'return_at','') IS NULL THEN RAISE EXCEPTION 'Informe próximo passo e prazo para uma visita realizada'; END IF;
    PERFORM (p_data->>'return_at')::date;
    UPDATE public.visit_cycles SET feedback=p_data,feedback_at=now(),updated_at=now() WHERE visita_id=p_visit;
    UPDATE public.visitas SET interesse=(p_data->>'interest')::boolean,
      feedback_corretor=concat('Interesse: ',p_data->>'interest',E'\nObjeções: ',p_data->>'objections',E'\nPróximo passo: ',p_data->>'next_step',E'\nRetorno: ',p_data->>'return_at') WHERE id=p_visit;
    PERFORM private.visit_emit(p_visit,'feedback',jsonb_build_object('actor',p_actor));
  ELSIF p_action='withdraw' THEN
    IF NOT c.recovery_open OR length(btrim(COALESCE(p_data->>'reason','')))<3 THEN RAISE EXCEPTION 'Informe o motivo da desistência'; END IF;
    UPDATE public.visit_cycles SET outcome='withdrawn',reason=p_data->>'reason',recovery_open=false,attendance_overdue=false,confirmation_overdue=false,updated_at=now() WHERE visita_id=p_visit;
    UPDATE public.visitas SET status='cancelada' WHERE id=p_visit;
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
CREATE OR REPLACE FUNCTION public.visit_intake_receive(p_message text,p_group text,p_instance uuid,p_author text,p_phone text,p_text text,
 p_protocol text DEFAULT NULL,p_revision integer DEFAULT NULL,p_action text DEFAULT 'create',p_admin uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE cfg public.visit_automation_config; r public.visit_intake; iid uuid; can_resolve boolean;
BEGIN
 SELECT * INTO STRICT cfg FROM public.visit_automation_config WHERE id;
 IF NOT cfg.enabled OR NOT cfg.intake_enabled OR p_group<>cfg.group_jid OR p_instance<>cfg.instance_id THEN RETURN NULL; END IF;
 IF length(p_text)>8000 OR length(p_text)<1 OR p_author='' OR p_message='' THEN RETURN NULL; END IF;
 IF p_admin IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_admin AND role='admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 INSERT INTO public.visit_intake_messages(message_key,author_jid,body) VALUES(p_message,p_author,p_text) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN (SELECT intake_id FROM public.visit_intake_messages WHERE message_key=p_message); END IF;
 IF p_action='create' THEN
   IF (SELECT count(*) FROM public.visit_intake WHERE group_jid=p_group AND created_at>now()-interval '1 hour')>=100 THEN RAISE EXCEPTION 'Limite de solicitações por hora atingido'; END IF;
   INSERT INTO public.visit_intake(group_jid,instance_id,author_jid,author_phone,original_message,input_text)
   VALUES(p_group,p_instance,p_author,p_phone,p_text,p_text) RETURNING id INTO iid;
 ELSE
   SELECT * INTO r FROM public.visit_intake WHERE protocol=p_protocol AND group_jid=p_group AND instance_id=p_instance FOR UPDATE;
   IF NOT FOUND THEN RETURN NULL; END IF;
   iid:=r.id;
   can_resolve:=p_admin IS NOT NULL OR (p_phone<>'' AND p_phone=cfg.closer_phone);
   IF p_revision<>r.revision OR p_revision IS NULL OR r.status NOT IN ('queued','processing','needs_input','needs_closer','failed') THEN RETURN NULL; END IF;
   IF NOT can_resolve AND r.author_jid<>p_author AND NOT (p_phone<>'' AND p_phone=r.author_phone) THEN RETURN NULL; END IF;
   IF p_action='approve' AND (NOT can_resolve OR r.status<>'needs_closer' OR r.conflict_ids IS NULL) THEN RETURN NULL; END IF;
   IF p_action NOT IN ('correct','approve','cancel') THEN RETURN NULL; END IF;
   UPDATE public.visit_intake SET input_text=CASE WHEN p_action='correct' AND r.status IN ('queued','processing') THEN r.input_text||E'\n'||p_text WHEN p_action='correct' THEN p_text ELSE '' END,
     approved_conflicts=CASE WHEN p_action='approve' THEN conflict_ids ELSE NULL END,
     revision=revision+1,status=CASE WHEN p_action='cancel' THEN 'cancelled' ELSE 'queued' END,
     attempts=0,available_at=now(),lease_token=null,leased_until=null,updated_at=now(),last_error=null WHERE id=iid;
   IF p_action='cancel' THEN PERFORM private.visit_intake_notify(iid,'Solicitação cancelada. Nenhuma visita foi criada.'); END IF;
 END IF;
 UPDATE public.visit_intake_messages SET intake_id=iid WHERE message_key=p_message;
 RETURN iid;
END $$;
CREATE OR REPLACE FUNCTION public.visit_intake_finish(p_id uuid,p_lease uuid,p_fields jsonb,p_choices jsonb,p_questions text,p_broker uuid DEFAULT NULL,p_property uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.visit_intake; lid uuid; vid uuid; n integer; start_at timestamptz; conflicts uuid[]; note text;
BEGIN
 SELECT * INTO r FROM public.visit_intake WHERE id=p_id AND lease_token=p_lease AND status='processing' FOR UPDATE;
 IF NOT FOUND THEN RETURN 'stale'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.visit_automation_config WHERE enabled AND intake_enabled) THEN
   UPDATE public.visit_intake SET status='queued',leased_until=null WHERE id=p_id; RETURN 'paused';
 END IF;
 UPDATE public.visit_intake SET fields=p_fields,choices=p_choices,leased_until=null,updated_at=now() WHERE id=p_id;
 IF p_questions<>'' THEN
   UPDATE public.visit_intake SET status='needs_input',resolution_note=p_questions WHERE id=p_id;
   PERFORM private.visit_intake_notify(p_id,p_questions||E'\nResponda citando esta mensagem e informe os campos solicitados. Ou copie: RESOLVER AG-'||r.protocol||' V'||r.revision);
   RETURN 'needs_input';
 END IF;
 IF p_broker IS NULL OR p_property IS NULL OR NOT EXISTS(SELECT 1 FROM public.corretores WHERE id=p_broker AND status='ativo' AND deleted_at IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.empreendimentos WHERE id=p_property AND ativo) THEN RAISE EXCEPTION 'Cadastro selecionado não está ativo'; END IF;
 IF length(btrim(COALESCE(p_fields->>'client_name','')))<2 OR (p_fields->>'client_phone') !~ '^\+?[1-9][0-9]{9,14}$' OR COALESCE(p_fields->>'client_phone','')='' THEN RAISE EXCEPTION 'Cliente inválido'; END IF;
 start_at:=((p_fields->>'date')::date+(p_fields->>'time')::time) AT TIME ZONE 'America/Sao_Paulo';
 IF start_at IS NULL OR start_at<=now() THEN RAISE EXCEPTION 'Informe data e horário futuros'; END IF;
 -- Serialize intake creation and manual agenda changes using the broker row.
 PERFORM pg_advisory_xact_lock(hashtextextended('visit-intake-phone:'||(p_fields->>'client_phone'),0));
 PERFORM 1 FROM public.corretores WHERE id=p_broker FOR UPDATE;
 SELECT count(*),(array_agg(id))[1] INTO n,lid FROM public.leads WHERE deleted_at IS NULL AND private.visit_intake_phone(telefone)=p_fields->>'client_phone';
 IF n>1 THEN
   note:='Há mais de um cliente com esse telefone. O Closer precisa corrigir a duplicidade no CRM.';
   UPDATE public.visit_intake SET status='needs_closer',resolution_note=note,conflict_ids=null WHERE id=p_id;
   PERFORM private.visit_intake_notify(p_id,note); RETURN 'needs_closer';
 END IF;
 IF n=1 AND NOT EXISTS(SELECT 1 FROM public.leads WHERE id=lid AND lower(btrim(nome))=lower(btrim(p_fields->>'client_name'))) THEN RAISE EXCEPTION 'O nome do cliente mudou; revise o cadastro existente'; END IF;
 SELECT v.id INTO vid FROM public.visitas v JOIN public.leads l ON l.id=v.lead_id
 WHERE v.deleted_at IS NULL AND v.status IN ('agendada','confirmada','reagendada') AND NOT EXISTS(SELECT 1 FROM public.visit_cycles c WHERE c.visita_id=v.id AND c.outcome<>'pending') AND v.empreendimento_id=p_property
 AND v.data_visita=(p_fields->>'date')::date AND v.horario_visita=(p_fields->>'time')::time AND private.visit_intake_phone(l.telefone)=p_fields->>'client_phone' LIMIT 1;
 IF vid IS NOT NULL THEN
   UPDATE public.visit_intake SET status='duplicate',visita_id=vid,resolution_note='Visita já cadastrada' WHERE id=p_id;
   PERFORM private.visit_intake_notify(p_id,'Esta visita já está cadastrada. Consulte o acompanhamento no sistema.'); RETURN 'duplicate';
 END IF;
 SELECT array_agg(v.id ORDER BY v.id) INTO conflicts FROM public.visitas v WHERE v.corretor_id=p_broker AND v.deleted_at IS NULL AND v.status IN ('agendada','confirmada','reagendada') AND NOT EXISTS(SELECT 1 FROM public.visit_cycles c WHERE c.visita_id=v.id AND c.outcome<>'pending')
 AND start_at < ((v.data_visita+v.horario_visita) AT TIME ZONE 'America/Sao_Paulo')+(v.duration_minutes+v.buffer_minutes)*interval '1 minute'
 AND start_at+interval '90 minutes' > ((v.data_visita+v.horario_visita) AT TIME ZONE 'America/Sao_Paulo');
 IF conflicts IS NOT NULL AND (r.approved_conflicts IS NULL OR NOT conflicts <@ r.approved_conflicts) THEN
   SELECT string_agg(to_char(v.data_visita,'DD/MM/YYYY')||' às '||to_char(v.horario_visita,'HH24:MI')||' — '||COALESCE(l.nome,'Cliente'), E'\n' ORDER BY v.data_visita,v.horario_visita) INTO note FROM public.visitas v LEFT JOIN public.leads l ON l.id=v.lead_id WHERE v.id=ANY(conflicts);
   note:=COALESCE(note,'')||E'\nConflito na agenda do corretor (60 min de visita + 30 min de intervalo). Aguarda decisão do Closer. Para manter esse horário: LIBERAR AG-'||r.protocol||' V'||r.revision;
   UPDATE public.visit_intake SET status='needs_closer',conflict_ids=conflicts,resolution_note=note WHERE id=p_id;
   PERFORM private.visit_intake_notify(p_id,note); RETURN 'needs_closer';
 END IF;
 IF lid IS NULL THEN
   INSERT INTO public.leads(nome,telefone,origem,observacoes,status,empreendimento_id)
   VALUES(p_fields->>'client_name',p_fields->>'client_phone',NULLIF(p_fields->>'source',''),NULLIF(p_fields->>'profile',''),'visita_agendada',p_property) RETURNING id INTO lid;
 END IF;
 PERFORM set_config('memude.approved_conflicts',COALESCE(array_to_string(r.approved_conflicts,','),''),true);
 INSERT INTO public.visitas(lead_id,corretor_id,empreendimento_id,data_visita,horario_visita,status,meeting_address,meeting_neighborhood,customer_profile,intake_source)
 VALUES(lid,p_broker,p_property,(p_fields->>'date')::date,(p_fields->>'time')::time,'agendada',NULLIF(p_fields->>'address',''),NULLIF(p_fields->>'neighborhood',''),NULLIF(p_fields->>'profile',''),'whatsapp_group') RETURNING id INTO vid;
 PERFORM set_config('memude.approved_conflicts','',true);
 UPDATE public.visit_intake SET status='created',visita_id=vid,resolution_note='Visita cadastrada automaticamente' WHERE id=p_id;
 -- Direct replies may run outside the reminder window. Replace only the duplicated group/Closer notices.
 UPDATE public.visit_outbox o SET status='obsolete' FROM public.visit_events e WHERE o.event_id=e.id AND e.visita_id=vid AND e.kind='scheduled' AND o.destination IN ('group','closer') AND o.status='pending';
 PERFORM private.visit_intake_notify(p_id,'Visita cadastrada.'||E'\nCliente: '||(p_fields->>'client_name')||E'\nData: '||(p_fields->>'date')||' às '||(p_fields->>'time')||E'\nEmpreendimento: '||(p_fields->>'property_name')||E'\nCorretor: '||(p_fields->>'broker_name')||E'\nLocal: '||(p_fields->>'address')||E'\nAcompanhamento automático iniciado. https://core.memudecore.com.br/visitas');
 RETURN 'created';
END $$;
