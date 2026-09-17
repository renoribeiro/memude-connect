-- WhatsApp intake is independently gated. Existing reminder configuration is preserved.
ALTER TABLE public.visit_automation_config ADD COLUMN intake_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.visitas ADD COLUMN meeting_address text, ADD COLUMN meeting_neighborhood text,
  ADD COLUMN customer_profile text, ADD COLUMN intake_source text,
  ADD COLUMN duration_minutes integer NOT NULL DEFAULT 60 CHECK(duration_minutes BETWEEN 15 AND 480),
  ADD COLUMN buffer_minutes integer NOT NULL DEFAULT 30 CHECK(buffer_minutes BETWEEN 0 AND 240);

CREATE TABLE public.visit_intake (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 protocol text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
 group_jid text NOT NULL, instance_id uuid NOT NULL REFERENCES public.evolution_instances(id),
 author_jid text NOT NULL, author_phone text NOT NULL DEFAULT '',
 original_message text NOT NULL, input_text text NOT NULL,
 revision integer NOT NULL DEFAULT 1, fields jsonb NOT NULL DEFAULT '{}', choices jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','needs_input','needs_closer','created','duplicate','cancelled','failed')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid, leased_until timestamptz, last_error text, resolution_note text,
 approved_conflicts uuid[], conflict_ids uuid[],
 visita_id uuid REFERENCES public.visitas(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visit_intake_queue ON public.visit_intake(available_at) WHERE status IN ('queued','processing');
CREATE INDEX visit_intake_pending ON public.visit_intake(updated_at) WHERE status IN ('needs_input','needs_closer','failed');
CREATE TABLE public.visit_intake_messages (
 message_key text PRIMARY KEY, intake_id uuid REFERENCES public.visit_intake(id),
 author_jid text NOT NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.visit_intake_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), intake_id uuid NOT NULL REFERENCES public.visit_intake(id), revision integer NOT NULL,
 destination text NOT NULL CHECK(destination IN ('group','closer')), body text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed','obsolete')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid, leased_until timestamptz, last_error text, provider_id text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(intake_id,revision,destination)
);
CREATE INDEX visit_intake_outbox_due ON public.visit_intake_outbox(available_at) WHERE status IN ('pending','processing');
CREATE FUNCTION private.visit_intake_phone(p_raw text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN left(btrim(p_raw),1)<>'+' AND length(regexp_replace(p_raw,'\D','','g')) IN (10,11) THEN '55' ELSE '' END || regexp_replace(p_raw,'\D','','g')
$$;
REVOKE ALL ON FUNCTION private.visit_intake_phone(text) FROM PUBLIC,anon,authenticated;
-- Pure normalizer is also evaluated by the index on ordinary lead inserts.
GRANT EXECUTE ON FUNCTION private.visit_intake_phone(text) TO service_role,authenticated,anon;
CREATE INDEX leads_intake_phone ON public.leads(private.visit_intake_phone(telefone)) WHERE deleted_at IS NULL;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['visit_intake','visit_intake_messages','visit_intake_outbox'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;

CREATE FUNCTION private.visit_intake_notify(p_id uuid,p_text text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.visit_intake; BEGIN
 SELECT * INTO STRICT r FROM public.visit_intake WHERE id=p_id;
 INSERT INTO public.visit_intake_outbox(intake_id,revision,destination,body)
 SELECT r.id,r.revision,d,'Agendamento AG-'||r.protocol||' V'||r.revision||E'\n'||p_text FROM unnest(ARRAY['group','closer']) d
 ON CONFLICT(intake_id,revision,destination) DO NOTHING;
END $$;

-- Called only by the authenticated webhook or an admin server action.
CREATE FUNCTION public.visit_intake_receive(p_message text,p_group text,p_instance uuid,p_author text,p_phone text,p_text text,
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
   IF p_revision<>r.revision OR p_revision IS NULL OR r.status NOT IN ('needs_input','needs_closer','failed') THEN RETURN NULL; END IF;
   IF NOT can_resolve AND r.author_jid<>p_author AND NOT (p_phone<>'' AND p_phone=r.author_phone) THEN RETURN NULL; END IF;
   IF p_action='approve' AND (NOT can_resolve OR r.status<>'needs_closer' OR r.conflict_ids IS NULL) THEN RETURN NULL; END IF;
   IF p_action NOT IN ('correct','approve','cancel') THEN RETURN NULL; END IF;
   UPDATE public.visit_intake SET input_text=CASE WHEN p_action='correct' THEN p_text ELSE '' END,
     approved_conflicts=CASE WHEN p_action='approve' THEN conflict_ids ELSE NULL END,
     revision=revision+1,status=CASE WHEN p_action='cancel' THEN 'cancelled' ELSE 'queued' END,
     attempts=0,available_at=now(),lease_token=null,leased_until=null,updated_at=now(),last_error=null WHERE id=iid;
   IF p_action='cancel' THEN PERFORM private.visit_intake_notify(iid,'Solicitação cancelada. Nenhuma visita foi criada.'); END IF;
 END IF;
 UPDATE public.visit_intake_messages SET intake_id=iid WHERE message_key=p_message;
 RETURN iid;
END $$;

CREATE FUNCTION public.visit_intake_claim() RETURNS SETOF public.visit_intake LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE overdue record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.visit_automation_config WHERE enabled AND intake_enabled) THEN RETURN; END IF;
 FOR overdue IN SELECT id FROM public.visit_intake WHERE status='needs_input' AND updated_at<now()-interval '2 hours' FOR UPDATE SKIP LOCKED LOOP
   UPDATE public.visit_intake SET status='needs_closer',revision=revision+1,conflict_ids=null,updated_at=now(),resolution_note='Sem esclarecimento há mais de 2 horas. Closer deve revisar os campos pendentes.' WHERE id=overdue.id;
   PERFORM private.visit_intake_notify(overdue.id,'Solicitação sem esclarecimento há mais de 2 horas. Closer: revise em https://core.memudecore.com.br/visitas');
 END LOOP;
 RETURN QUERY WITH next AS (SELECT id FROM public.visit_intake WHERE (status='queued' AND available_at<=now()) OR (status='processing' AND leased_until<now()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
 UPDATE public.visit_intake r SET status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes'
 FROM next WHERE r.id=next.id RETURNING r.*;
END $$;

-- Final validation and creation are atomic; the LLM cannot write the database.
CREATE FUNCTION public.visit_intake_finish(p_id uuid,p_lease uuid,p_fields jsonb,p_choices jsonb,p_questions text,p_broker uuid DEFAULT NULL,p_property uuid DEFAULT NULL)
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
 WHERE v.deleted_at IS NULL AND v.status IN ('agendada','confirmada','reagendada') AND v.empreendimento_id=p_property
 AND v.data_visita=(p_fields->>'date')::date AND v.horario_visita=(p_fields->>'time')::time AND private.visit_intake_phone(l.telefone)=p_fields->>'client_phone' LIMIT 1;
 IF vid IS NOT NULL THEN
   UPDATE public.visit_intake SET status='duplicate',visita_id=vid,resolution_note='Visita já cadastrada' WHERE id=p_id;
   PERFORM private.visit_intake_notify(p_id,'Esta visita já está cadastrada. Consulte o acompanhamento no sistema.'); RETURN 'duplicate';
 END IF;
 SELECT array_agg(v.id ORDER BY v.id) INTO conflicts FROM public.visitas v WHERE v.corretor_id=p_broker AND v.deleted_at IS NULL AND v.status IN ('agendada','confirmada','reagendada')
 AND start_at < ((v.data_visita+v.horario_visita) AT TIME ZONE 'America/Sao_Paulo')+(v.duration_minutes+v.buffer_minutes)*interval '1 minute'
 AND start_at+interval '90 minutes' > ((v.data_visita+v.horario_visita) AT TIME ZONE 'America/Sao_Paulo');
 IF conflicts IS NOT NULL AND (r.approved_conflicts IS NULL OR NOT conflicts <@ r.approved_conflicts) THEN
   note:='Conflito na agenda do corretor (60 min de visita + 30 min de intervalo). Aguarda decisão do Closer. Para manter esse horário: LIBERAR AG-'||r.protocol||' V'||r.revision;
   UPDATE public.visit_intake SET status='needs_closer',conflict_ids=conflicts,resolution_note=note WHERE id=p_id;
   PERFORM private.visit_intake_notify(p_id,note); RETURN 'needs_closer';
 END IF;
 IF lid IS NULL THEN
   INSERT INTO public.leads(nome,telefone,origem,observacoes,status,empreendimento_id)
   VALUES(p_fields->>'client_name',p_fields->>'client_phone',NULLIF(p_fields->>'source',''),NULLIF(p_fields->>'profile',''),'visita_agendada',p_property) RETURNING id INTO lid;
 END IF;
 INSERT INTO public.visitas(lead_id,corretor_id,empreendimento_id,data_visita,horario_visita,status,meeting_address,meeting_neighborhood,customer_profile,intake_source)
 VALUES(lid,p_broker,p_property,(p_fields->>'date')::date,(p_fields->>'time')::time,'agendada',NULLIF(p_fields->>'address',''),NULLIF(p_fields->>'neighborhood',''),NULLIF(p_fields->>'profile',''),'whatsapp_group') RETURNING id INTO vid;
 UPDATE public.visit_intake SET status='created',visita_id=vid,resolution_note='Visita cadastrada automaticamente' WHERE id=p_id;
 -- Direct replies may run outside the reminder window. Replace only the duplicated group/Closer notices.
 UPDATE public.visit_outbox o SET status='obsolete' FROM public.visit_events e WHERE o.event_id=e.id AND e.visita_id=vid AND e.kind='scheduled' AND o.destination IN ('group','closer') AND o.status='pending';
 PERFORM private.visit_intake_notify(p_id,'Visita cadastrada.'||E'\nCliente: '||(p_fields->>'client_name')||E'\nData: '||(p_fields->>'date')||' às '||(p_fields->>'time')||E'\nEmpreendimento: '||(p_fields->>'property_name')||E'\nCorretor: '||(p_fields->>'broker_name')||E'\nLocal: '||(p_fields->>'address')||E'\nAcompanhamento automático iniciado. https://core.memudecore.com.br/visitas');
 RETURN 'created';
END $$;

CREATE FUNCTION public.visit_intake_fail(p_id uuid,p_lease uuid,p_error text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.visit_intake; BEGIN
 UPDATE public.visit_intake SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,
 available_at=now()+interval '2 minutes',leased_until=null,last_error=left(p_error,500),updated_at=now()
 WHERE id=p_id AND lease_token=p_lease AND status='processing' RETURNING * INTO r;
 IF FOUND AND r.status='failed' THEN PERFORM private.visit_intake_notify(p_id,'Não foi possível concluir. O Closer deve revisar a solicitação no sistema.'); END IF;
END $$;

CREATE FUNCTION public.visit_intake_find_leads(p_phone text) RETURNS TABLE(id uuid,nome text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT id,nome FROM public.leads WHERE deleted_at IS NULL AND private.visit_intake_phone(telefone)=p_phone LIMIT 2
$$;

CREATE FUNCTION public.visit_intake_delivery_claim() RETURNS SETOF public.visit_intake_outbox LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.visit_automation_config WHERE enabled AND intake_enabled) THEN RETURN; END IF;
 RETURN QUERY WITH next AS (SELECT id FROM public.visit_intake_outbox WHERE (status='pending' AND available_at<=now()) OR (status='processing' AND leased_until<now()) ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED)
 UPDATE public.visit_intake_outbox o SET status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes' FROM next WHERE o.id=next.id RETURNING o.*;
END $$;
CREATE FUNCTION public.visit_intake_delivery_finish(p_id uuid,p_lease uuid,p_error text DEFAULT NULL,p_provider text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE public.visit_intake_outbox SET status=CASE WHEN p_error IS NULL THEN 'sent' WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,
 available_at=now()+interval '2 minutes',leased_until=null,last_error=left(p_error,500),provider_id=p_provider
 WHERE id=p_id AND lease_token=p_lease AND status='processing';
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'visit_intake_%' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.visit_intake_notify(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.visit_intake_notify(uuid,text) TO service_role;

CREATE FUNCTION private.visit_lock_broker() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.corretor_id IS NOT NULL THEN PERFORM 1 FROM public.corretores WHERE id=NEW.corretor_id FOR UPDATE; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.visit_lock_broker() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER visit_lock_broker BEFORE INSERT OR UPDATE OF corretor_id,data_visita,horario_visita ON public.visitas FOR EACH ROW EXECUTE FUNCTION private.visit_lock_broker();

CREATE FUNCTION private.visit_copy_meeting() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.previous_visita_id IS NOT NULL AND OLD.previous_visita_id IS DISTINCT FROM NEW.previous_visita_id THEN
 UPDATE public.visitas n SET meeting_address=p.meeting_address,meeting_neighborhood=p.meeting_neighborhood,customer_profile=p.customer_profile,intake_source=p.intake_source,duration_minutes=p.duration_minutes,buffer_minutes=p.buffer_minutes
 FROM public.visitas p WHERE n.id=NEW.visita_id AND p.id=NEW.previous_visita_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.visit_copy_meeting() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER visit_copy_meeting AFTER UPDATE OF previous_visita_id ON public.visit_cycles FOR EACH ROW EXECUTE FUNCTION private.visit_copy_meeting();

-- A slow AI call must not delay the existing visit reminder worker.
DO $$ DECLARE command_text text; BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
   EXECUTE 'SELECT command FROM cron.job WHERE jobname=''memude-monitor-visits''' INTO command_text;
   IF command_text IS NOT NULL AND position('/functions/v1/monitor-visits' IN command_text)>0 THEN
     PERFORM cron.schedule('memude-visit-intake','* * * * *',replace(command_text,'/functions/v1/monitor-visits','/functions/v1/visit-intake-worker'));
   END IF;
 END IF;
END $$;
