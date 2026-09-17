-- One persistent workflow for manual and WhatsApp appointments.
ALTER TABLE public.visit_automation_config ADD COLUMN match_max_attempts integer NOT NULL DEFAULT 5 CHECK(match_max_attempts BETWEEN 1 AND 20);
ALTER TABLE public.visit_cycles ADD COLUMN match_status text NOT NULL DEFAULT 'searching' CHECK(match_status IN ('searching','accepted','exhausted','closed')),
 ADD COLUMN match_round integer NOT NULL DEFAULT 1, ADD COLUMN summary_sent_at timestamptz, ADD COLUMN broker_feedback_at timestamptz, ADD COLUMN match_approved_conflicts uuid[] NOT NULL DEFAULT '{}';
-- Existing visits retain their assigned broker. New visits require an explicit acceptance.
UPDATE public.visit_cycles c SET match_status=CASE WHEN c.outcome<>'pending' THEN 'closed' WHEN v.corretor_id IS NOT NULL THEN 'accepted' ELSE 'searching' END FROM public.visitas v WHERE v.id=c.visita_id;
CREATE TABLE public.visit_match_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),visita_id uuid NOT NULL REFERENCES public.visit_cycles(visita_id) ON DELETE CASCADE,
 corretor_id uuid NOT NULL REFERENCES public.corretores(id),round integer NOT NULL,revision integer NOT NULL,
 prompt_id uuid UNIQUE REFERENCES public.visit_prompts(id),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','timeout','failed','obsolete')),
 ranking jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),answered_at timestamptz,
 UNIQUE(visita_id,round,corretor_id));
CREATE UNIQUE INDEX visit_match_one_pending ON public.visit_match_attempts(visita_id) WHERE status='pending';
ALTER TABLE public.visit_match_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visit_match_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.visit_match_attempts TO service_role;
ALTER TABLE public.visit_prompts DROP CONSTRAINT visit_prompts_kind_check;
ALTER TABLE public.visit_prompts ADD CHECK(kind IN ('eve','h2','attendance','reason','rating','assignment','feedback'));
ALTER TABLE public.visit_prompts DROP CONSTRAINT visit_prompts_visita_id_revision_kind_audience_key;
CREATE UNIQUE INDEX visit_prompts_regular_unique ON public.visit_prompts(visita_id,revision,kind,audience) WHERE kind<>'assignment';

-- Specialty: exact type and construction company. Region: exact registered bairro,
-- then a registered bairro in the same city/state. No fuzzy geography guesses.
CREATE FUNCTION private.visit_match_candidates(p_visit uuid)
RETURNS TABLE(corretor_id uuid,specialty integer,region integer,rating numeric,visits bigint,phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT b.id,
  (CASE WHEN e.tipo_imovel IS NOT NULL AND (b.tipo_imovel=e.tipo_imovel OR b.tipo_imovel::text='todos') THEN 1 ELSE 0 END)+
  (CASE WHEN EXISTS(SELECT 1 FROM public.corretor_construtoras cc WHERE cc.corretor_id=b.id AND cc.construtora_id=e.construtora_id) THEN 1 ELSE 0 END),
  CASE WHEN EXISTS(SELECT 1 FROM public.corretor_bairros cb WHERE cb.corretor_id=b.id AND cb.bairro_id=e.bairro_id) THEN 2
   WHEN EXISTS(SELECT 1 FROM public.corretor_bairros cb JOIN public.bairros bb ON bb.id=cb.bairro_id JOIN public.bairros eb ON eb.id=e.bairro_id WHERE cb.corretor_id=b.id AND lower(bb.cidade)=lower(eb.cidade) AND bb.estado=eb.estado) THEN 1 ELSE 0 END,
  COALESCE((SELECT avg(COALESCE(cy.rating::numeric,vi.avaliacao_lead::numeric*2)) FROM public.visitas vi LEFT JOIN public.visit_cycles cy ON cy.visita_id=vi.id
   WHERE vi.corretor_id=b.id AND vi.deleted_at IS NULL AND (cy.rating IS NOT NULL OR vi.avaliacao_lead BETWEEN 1 AND 5)),least(greatest(COALESCE(b.nota_media,0)*2,0),10)),
  (SELECT count(*) FROM public.visitas vi WHERE vi.corretor_id=b.id AND vi.deleted_at IS NULL AND vi.status='realizada'),
  private.visit_intake_phone(COALESCE(NULLIF(b.whatsapp,''),b.telefone,''))
 FROM public.visitas v LEFT JOIN public.empreendimentos e ON e.id=v.empreendimento_id CROSS JOIN public.corretores b
 WHERE v.id=p_visit AND b.status='ativo' AND b.deleted_at IS NULL
 AND private.visit_intake_phone(COALESCE(NULLIF(b.whatsapp,''),b.telefone,'')) ~ '^[1-9][0-9]{9,14}$'
 AND private.visit_intake_phone(COALESCE(NULLIF(b.whatsapp,''),b.telefone,'')) !~ '([0-9])\1{7}$'
 AND NOT EXISTS(SELECT 1 FROM public.visitas other WHERE other.id<>v.id AND other.corretor_id=b.id AND other.deleted_at IS NULL
  AND NOT (b.id=v.corretor_id AND EXISTS(SELECT 1 FROM public.visit_cycles authorized WHERE authorized.visita_id=v.id AND other.id=ANY(authorized.match_approved_conflicts)))
  AND other.status IN ('agendada','confirmada','reagendada') AND NOT EXISTS(SELECT 1 FROM public.visit_cycles oc WHERE oc.visita_id=other.id AND oc.outcome<>'pending')
  AND v.data_visita+v.horario_visita < other.data_visita+other.horario_visita+(other.duration_minutes+other.buffer_minutes)*interval '1 minute'
  AND v.data_visita+v.horario_visita+(v.duration_minutes+v.buffer_minutes)*interval '1 minute' > other.data_visita+other.horario_visita)
$$;
REVOKE ALL ON FUNCTION private.visit_match_candidates(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.visit_match_candidates(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.visit_emit(p_visit uuid,p_kind text,p_payload jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE eid uuid; rev integer; dest text;
BEGIN
 SELECT revision INTO STRICT rev FROM public.visit_cycles WHERE visita_id=p_visit;
 INSERT INTO public.visit_events(visita_id,revision,kind,payload) VALUES(p_visit,rev,p_kind,p_payload) RETURNING id INTO eid;
 IF p_kind='missing_broker' THEN RETURN eid; END IF;
 FOREACH dest IN ARRAY ARRAY['closer','group','sheets'] LOOP
  -- Partial post-visit results persist immediately, but only the complete summary is broadcast.
  IF dest<>'sheets' AND p_kind IN ('rating','feedback') THEN CONTINUE; END IF;
  INSERT INTO public.visit_outbox(visita_id,revision,event_id,destination,urgent) VALUES(p_visit,rev,eid,dest,p_kind NOT IN ('prompt_sent','client_confirmed','broker_confirmed'));
 END LOOP;
 IF p_kind IN ('scheduled','changed','match_accepted','cancelled','rescheduled') THEN
  FOREACH dest IN ARRAY ARRAY['client','broker'] LOOP
   IF dest='broker' AND p_kind IN ('scheduled','changed') THEN CONTINUE; END IF;
   INSERT INTO public.visit_outbox(visita_id,revision,event_id,destination,urgent) VALUES(p_visit,rev,eid,dest,true);
  END LOOP;
 END IF;
 RETURN eid;
END $$;

CREATE FUNCTION private.visit_match_advance(p_visit uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.visit_cycles; v public.visitas; candidate record; pid uuid; limit_attempts integer; n integer;
BEGIN
 SELECT * INTO STRICT v FROM public.visitas WHERE id=p_visit FOR UPDATE;
 SELECT * INTO STRICT c FROM public.visit_cycles WHERE visita_id=p_visit FOR UPDATE;
 SELECT match_max_attempts INTO limit_attempts FROM public.visit_automation_config WHERE enabled;
 IF limit_attempts IS NULL OR c.outcome<>'pending' OR c.match_status<>'searching' OR v.deleted_at IS NOT NULL THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.visit_match_attempts WHERE visita_id=p_visit AND status='pending') THEN RETURN; END IF;
 SELECT null::uuid AS corretor_id INTO candidate;
 SELECT count(*) INTO n FROM public.visit_match_attempts WHERE visita_id=p_visit AND round=c.match_round;
 IF n<limit_attempts AND c.scheduled_at>now() THEN
  SELECT r.* INTO candidate FROM private.visit_match_candidates(p_visit) r
   WHERE NOT EXISTS(SELECT 1 FROM public.visit_match_attempts a WHERE a.visita_id=p_visit AND a.round=c.match_round AND a.corretor_id=r.corretor_id)
   AND NOT (c.broker_confirmed IS FALSE AND r.corretor_id=v.corretor_id)
   ORDER BY (r.corretor_id=v.corretor_id) DESC NULLS LAST,r.specialty DESC,r.region DESC,r.rating DESC,r.visits ASC,r.corretor_id LIMIT 1;
 END IF;
 IF candidate.corretor_id IS NULL THEN
  UPDATE public.visit_cycles SET match_status='exhausted',recovery_open=true,updated_at=now() WHERE visita_id=p_visit;
  PERFORM private.visit_emit(p_visit,'match_exhausted',jsonb_build_object('attempts',n)); RETURN;
 END IF;
 INSERT INTO public.visit_prompts(visita_id,revision,kind,audience,phone,expires_at) VALUES(p_visit,c.revision,'assignment','broker',candidate.phone,c.scheduled_at) RETURNING id INTO pid;
 INSERT INTO public.visit_match_attempts(visita_id,corretor_id,round,revision,prompt_id,ranking) VALUES(p_visit,candidate.corretor_id,c.match_round,c.revision,pid,to_jsonb(candidate)-'phone');
 INSERT INTO public.visit_outbox(visita_id,revision,prompt_id,destination,urgent) VALUES(p_visit,c.revision,pid,'broker',true);
 PERFORM private.visit_emit(p_visit,'match_consulting',jsonb_build_object('broker_id',candidate.corretor_id,'attempt',n+1));
END $$;
REVOKE ALL ON FUNCTION private.visit_match_advance(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.visit_match_advance(uuid) TO service_role;

-- Gate reminders to the assigned broker; assignment acceptance is a distinct state.
ALTER FUNCTION private.visit_prompt(uuid,text,text) RENAME TO visit_prompt_before_match;
CREATE FUNCTION private.visit_prompt(p_visit uuid,p_kind text,p_audience text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_audience='broker' AND p_kind IN ('eve','h2','attendance') AND NOT EXISTS(SELECT 1 FROM public.visit_cycles WHERE visita_id=p_visit AND match_status='accepted') THEN RETURN; END IF;
 PERFORM private.visit_prompt_before_match(p_visit,p_kind,p_audience);
END $$;
REVOKE ALL ON FUNCTION private.visit_prompt(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.visit_prompt(uuid,text,text) TO service_role;

CREATE FUNCTION private.visit_match_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.visit_cycles;
BEGIN
 IF NEW.kind IN ('scheduled','changed') AND COALESCE(current_setting('memude.match_assigning',true),'')<>'1' THEN
  IF NEW.kind='scheduled' THEN UPDATE public.visit_cycles SET match_approved_conflicts=COALESCE(string_to_array(NULLIF(current_setting('memude.approved_conflicts',true),''),',')::uuid[],'{}') WHERE visita_id=NEW.visita_id; END IF;
  UPDATE public.visit_match_attempts SET status='obsolete' WHERE visita_id=NEW.visita_id AND status='pending';
  UPDATE public.visit_prompts SET expires_at=now() WHERE visita_id=NEW.visita_id AND kind='assignment' AND answered_at IS NULL;
  UPDATE public.visit_cycles SET match_status='searching',match_round=match_round+CASE WHEN NEW.kind='changed' THEN 1 ELSE 0 END WHERE visita_id=NEW.visita_id;
  PERFORM private.visit_match_advance(NEW.visita_id);
 ELSIF NEW.kind='broker_declined' THEN
  UPDATE public.visit_cycles SET match_status='searching',match_round=match_round+1,recovery_open=false WHERE visita_id=NEW.visita_id;
  PERFORM private.visit_match_advance(NEW.visita_id);
 ELSIF NEW.kind='held' THEN
  PERFORM private.visit_prompt(NEW.visita_id,'feedback','broker');
 ELSIF NEW.kind IN ('cancelled','not_held','withdrawn','rescheduled') THEN
  UPDATE public.visit_cycles SET match_status='closed' WHERE visita_id=NEW.visita_id;
  UPDATE public.visit_prompts SET expires_at=now() WHERE visita_id=NEW.visita_id AND kind='assignment';
  UPDATE public.visit_match_attempts SET status='obsolete' WHERE visita_id=NEW.visita_id AND status='pending';
 ELSIF NEW.kind IN ('rating','feedback') THEN
  SELECT * INTO c FROM public.visit_cycles WHERE visita_id=NEW.visita_id FOR UPDATE;
  IF c.rating IS NOT NULL AND c.broker_feedback_at IS NOT NULL AND c.summary_sent_at IS NULL THEN
   UPDATE public.visit_cycles SET summary_sent_at=now() WHERE visita_id=NEW.visita_id;
   PERFORM private.visit_emit(NEW.visita_id,'post_visit_summary',jsonb_build_object('rating',c.rating,'feedback',c.feedback));
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.visit_match_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER visit_match_event AFTER INSERT ON public.visit_events FOR EACH ROW EXECUTE FUNCTION private.visit_match_event();

CREATE FUNCTION private.visit_match_sent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.kind='assignment' AND OLD.sent_at IS NULL AND NEW.sent_at IS NOT NULL THEN
  NEW.expires_at:=least(NEW.expires_at,NEW.sent_at+interval '15 minutes');
 END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.visit_match_sent() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER visit_match_sent BEFORE UPDATE ON public.visit_prompts FOR EACH ROW EXECUTE FUNCTION private.visit_match_sent();

ALTER FUNCTION public.visit_lifecycle_reply(uuid,text,text,text) RENAME TO visit_lifecycle_reply_before_match;
CREATE FUNCTION public.visit_lifecycle_reply(p_prompt uuid,p_phone text,p_answer text,p_message text) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE pr public.visit_prompts; c public.visit_cycles; a public.visit_match_attempts; answer text:=lower(btrim(p_answer)); previous_confirm boolean;
BEGIN
 SELECT * INTO pr FROM public.visit_prompts WHERE id=p_prompt;
 IF NOT FOUND THEN RETURN false; END IF;
 IF pr.kind NOT IN ('assignment','feedback') THEN RETURN public.visit_lifecycle_reply_before_match(p_prompt,p_phone,p_answer,p_message); END IF;
 PERFORM 1 FROM public.visitas WHERE id=pr.visita_id FOR UPDATE;
 SELECT * INTO c FROM public.visit_cycles WHERE visita_id=pr.visita_id FOR UPDATE;
 SELECT * INTO pr FROM public.visit_prompts WHERE id=p_prompt FOR UPDATE;
 IF pr.phone<>p_phone OR pr.revision<>c.revision OR pr.expires_at<=now() OR pr.answered_at IS NOT NULL
  OR EXISTS(SELECT 1 FROM public.visitas WHERE id=pr.visita_id AND deleted_at IS NOT NULL) THEN RETURN false; END IF;
 IF pr.kind='assignment' THEN
  SELECT * INTO a FROM public.visit_match_attempts WHERE prompt_id=p_prompt AND status='pending' FOR UPDATE;
  IF NOT FOUND OR c.outcome<>'pending' OR c.match_status<>'searching' OR answer NOT IN ('sim','nao') THEN RETURN false; END IF;
 ELSE
  IF c.outcome<>'held' OR length(btrim(p_answer))<10 OR length(p_answer)>2000 THEN RETURN false; END IF;
 END IF;
 INSERT INTO public.visit_inbound_receipts(message_id) VALUES(p_message) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.visit_prompts SET answered_at=now() WHERE id=p_prompt;
 IF pr.kind='feedback' THEN
  UPDATE public.visit_cycles SET feedback=COALESCE(feedback,'{}')||jsonb_build_object('text',btrim(p_answer),'source','broker_whatsapp'),feedback_at=now(),broker_feedback_at=now(),updated_at=now() WHERE visita_id=c.visita_id;
  UPDATE public.visitas SET feedback_corretor=btrim(p_answer) WHERE id=c.visita_id;
  PERFORM private.visit_emit(c.visita_id,'feedback'); RETURN true;
 END IF;
 IF answer='nao' THEN
  UPDATE public.visit_match_attempts SET status='declined',answered_at=now() WHERE id=a.id;
  PERFORM private.visit_emit(c.visita_id,'match_declined',jsonb_build_object('broker_id',a.corretor_id));
  PERFORM private.visit_match_advance(c.visita_id); RETURN true;
 END IF;
 -- Recheck availability under broker lock: two visits cannot win the same slot.
 PERFORM 1 FROM public.corretores WHERE id=a.corretor_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM private.visit_match_candidates(c.visita_id) WHERE corretor_id=a.corretor_id) THEN
  UPDATE public.visit_match_attempts SET status='failed',answered_at=now() WHERE id=a.id;
  PERFORM private.visit_emit(c.visita_id,'match_unavailable',jsonb_build_object('broker_id',a.corretor_id));
  PERFORM private.visit_match_advance(c.visita_id); RETURN true;
 END IF;
 PERFORM set_config('memude.match_assigning','1',true);
 UPDATE public.visit_cycles SET recovery_open=false,match_status='accepted' WHERE visita_id=c.visita_id;
 UPDATE public.visitas SET corretor_id=a.corretor_id WHERE id=c.visita_id;
 PERFORM set_config('memude.match_assigning','',true);
 UPDATE public.visit_match_attempts SET status='accepted',answered_at=now() WHERE id=a.id;
 UPDATE public.visit_cycles SET match_status='accepted',recovery_open=false,client_confirmed=c.client_confirmed,broker_confirmed=null WHERE visita_id=c.visita_id;
 UPDATE public.visitas SET lead_confirmou=c.client_confirmed,corretor_confirmou=null,status='agendada' WHERE id=c.visita_id;
 PERFORM private.visit_emit(c.visita_id,'match_accepted',jsonb_build_object('broker_id',a.corretor_id));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.visit_lifecycle_reply(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.visit_lifecycle_reply(uuid,text,text,text) TO service_role;

ALTER FUNCTION public.visit_lifecycle_tick() RENAME TO visit_lifecycle_tick_before_match;
CREATE FUNCTION public.visit_lifecycle_tick() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE row record; a record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.visit_automation_config WHERE enabled) THEN RETURN; END IF;
 FOR row IN SELECT v.id FROM public.visitas v JOIN public.visit_cycles c ON c.visita_id=v.id WHERE c.match_status='searching' AND c.outcome='pending' ORDER BY v.id FOR UPDATE OF v SKIP LOCKED LOOP
  FOR a IN SELECT m.id,m.prompt_id,p.expires_at,o.status FROM public.visit_match_attempts m JOIN public.visit_prompts p ON p.id=m.prompt_id JOIN public.visit_outbox o ON o.prompt_id=p.id WHERE m.visita_id=row.id AND m.status='pending' AND (p.expires_at<=now() OR o.status IN ('failed','obsolete')) LOOP
   UPDATE public.visit_match_attempts SET status=CASE WHEN a.expires_at<=now() THEN 'timeout' ELSE 'failed' END,answered_at=now() WHERE id=a.id;
   UPDATE public.visit_prompts SET expires_at=now() WHERE id=a.prompt_id;
   PERFORM private.visit_emit(row.id,'match_timeout');
  END LOOP;
  PERFORM private.visit_match_advance(row.id);
 END LOOP;
 PERFORM public.visit_lifecycle_tick_before_match();
END $$;
REVOKE ALL ON FUNCTION public.visit_lifecycle_tick() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.visit_lifecycle_tick() TO service_role;

CREATE FUNCTION public.visit_match_manual(p_visit uuid,p_broker uuid,p_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 PERFORM 1 FROM public.visitas WHERE id=p_visit FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.visit_cycles WHERE visita_id=p_visit AND outcome='pending' AND match_status='exhausted' AND scheduled_at>now()) THEN RAISE EXCEPTION 'Selecione uma solicitação pendente futura'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.visit_match_candidates(p_visit) WHERE corretor_id=p_broker) THEN RAISE EXCEPTION 'Corretor indisponível ou com conflito de agenda'; END IF;
 UPDATE public.visit_prompts SET expires_at=now() WHERE visita_id=p_visit AND answered_at IS NULL;
 UPDATE public.visit_cycles SET revision=revision+1,recovery_open=false,match_status='searching',match_round=match_round+1,broker_confirmed=null WHERE visita_id=p_visit;
 UPDATE public.visitas SET corretor_id=p_broker WHERE id=p_visit;
 PERFORM private.visit_match_advance(p_visit);
 PERFORM private.visit_emit(p_visit,'match_manual',jsonb_build_object('actor',p_actor,'broker_id',p_broker));
END $$;
REVOKE ALL ON FUNCTION public.visit_match_manual(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.visit_match_manual(uuid,uuid,uuid) TO service_role;

-- Trigger wakes the worker after commit; cron remains the durable recovery path.
CREATE FUNCTION private.visit_wake_worker() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE secret text;
BEGIN
 IF NOT NEW.urgent OR NEW.destination='sheets' OR NOT EXISTS(SELECT 1 FROM public.visit_automation_config WHERE enabled) THEN RETURN NEW; END IF;
 IF current_setting('memude.visit_wake_queued',true)=txid_current()::text THEN RETURN NEW; END IF;
 IF to_regclass('vault.decrypted_secrets') IS NULL THEN RETURN NEW; END IF;
 EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=''internal_function_secret'' LIMIT 1' INTO secret;
 IF secret IS NOT NULL THEN
  PERFORM net.http_post(url:='https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/monitor-visits',headers:=jsonb_build_object('Content-Type','application/json','x-internal-secret',secret),body:='{}'::jsonb,timeout_milliseconds:=45000);
  PERFORM set_config('memude.visit_wake_queued',txid_current()::text,true);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.visit_wake_worker() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER visit_wake_worker AFTER INSERT ON public.visit_outbox FOR EACH ROW EXECUTE FUNCTION private.visit_wake_worker();

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
 IF p_property IS NULL OR (p_broker IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.corretores WHERE id=p_broker AND status='ativo' AND deleted_at IS NULL))
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
 PERFORM private.visit_intake_notify(p_id,'Solicitação cadastrada; aguardando aceite do corretor.'||E'\nCliente: '||(p_fields->>'client_name')||E'\nData: '||(p_fields->>'date')||' às '||(p_fields->>'time')||E'\nEmpreendimento: '||COALESCE(p_fields->>'property_name','Empreendimento selecionado')||E'\nCorretor: '||COALESCE(p_fields->>'broker_name','Match em andamento')||E'\nLocal: '||(p_fields->>'address')||E'\nAcompanhamento automático iniciado. https://core.memudecore.com.br/visitas');
 RETURN 'created';
END $$;

CREATE OR REPLACE FUNCTION public.visit_lifecycle_claim(p_limit integer DEFAULT 10,p_channel text DEFAULT 'whatsapp') RETURNS SETOF public.visit_outbox LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
 ORDER BY urgent DESC,CASE WHEN destination='client' THEN 0 WHEN prompt_id IS NOT NULL THEN 1 ELSE 2 END,created_at LIMIT CASE WHEN p_channel='sheets' THEN 1 ELSE least(greatest(p_limit,1),5) END FOR UPDATE SKIP LOCKED
 ) UPDATE public.visit_outbox o SET status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes' FROM batch WHERE o.id=batch.id RETURNING o.*;
END $$;
