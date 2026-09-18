-- Human visit codes share one transactional daily sequence across both intake channels.
CREATE TABLE private.visit_code_counters(day date PRIMARY KEY, last_number bigint NOT NULL CHECK(last_number>0));
CREATE TABLE private.visit_code_registry(code text PRIMARY KEY, day date NOT NULL, intake_id uuid, visita_id uuid UNIQUE);
REVOKE ALL ON private.visit_code_counters,private.visit_code_registry FROM PUBLIC,anon,authenticated;
ALTER TABLE private.visit_code_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.visit_code_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ADD COLUMN visit_code text UNIQUE;
ALTER TABLE public.visit_intake ADD COLUMN protocol_aliases text[] NOT NULL DEFAULT '{}';

CREATE FUNCTION private.allocate_visit_code(p_day date,p_intake uuid DEFAULT NULL,p_visit uuid DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n bigint; code text;
BEGIN
 IF p_day IS NULL THEN RAISE EXCEPTION 'Data obrigatória para gerar código'; END IF;
 INSERT INTO private.visit_code_counters(day,last_number) VALUES(p_day,1)
 ON CONFLICT(day) DO UPDATE SET last_number=private.visit_code_counters.last_number+1 RETURNING last_number INTO n;
 code:='AG-'||to_char(p_day,'DDMMYYYY')||'-V'||n;
 INSERT INTO private.visit_code_registry(code,day,intake_id,visita_id) VALUES(code,p_day,p_intake,p_visit);
 RETURN code;
END $$;
REVOKE ALL ON FUNCTION private.allocate_visit_code(date,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.allocate_visit_code(date,uuid,uuid) TO service_role;

CREATE FUNCTION private.intake_code_day(p_fields jsonb,p_text text) RETURNS date LANGUAGE plpgsql SET search_path='' AS $$
DECLARE raw text; matched text[]; d date;
BEGIN
 raw:=p_fields->>'date';
 IF raw IS NULL THEN
   matched:=regexp_match(p_text,'(?:^|\n)[ *]*(?:Data|Data da visita)[ *]*:[ *]*([0-9]{2}/[0-9]{2}/[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})[ *]*(?:\r?\n|$)','i');
   raw:=matched[1];
 END IF;
 IF raw ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN raw:=substr(raw,7,4)||'-'||substr(raw,4,2)||'-'||substr(raw,1,2); END IF;
 IF raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN NULL; END IF;
 d:=raw::date; RETURN d;
EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.intake_code_day(jsonb,text) FROM PUBLIC,anon,authenticated;

-- Existing records keep their UUIDs. Old request references remain valid as aliases.
DO $$ DECLARE r record; v_code text; BEGIN
 FOR r IN SELECT id,data_visita FROM public.visitas ORDER BY data_visita,id LOOP
   v_code:=private.allocate_visit_code(COALESCE(r.data_visita,(now() AT TIME ZONE 'America/Sao_Paulo')::date),null,r.id);
   UPDATE public.visitas SET visit_code=v_code WHERE id=r.id;
 END LOOP;
 FOR r IN SELECT i.*,v.visit_code existing_code FROM public.visit_intake i LEFT JOIN public.visitas v ON v.id=i.visita_id ORDER BY i.created_at,i.id LOOP
   v_code:=CASE WHEN r.status='created' THEN r.existing_code ELSE NULL END;
   IF v_code IS NULL THEN v_code:=private.allocate_visit_code(COALESCE(private.intake_code_day(r.fields,r.original_message),(r.created_at AT TIME ZONE 'America/Sao_Paulo')::date),r.id,null);
   ELSE UPDATE private.visit_code_registry SET intake_id=r.id WHERE visit_code_registry.code=v_code; END IF;
   UPDATE public.visit_intake SET protocol_aliases=array_append(protocol_aliases,protocol),protocol=substr(v_code,4) WHERE id=r.id;
 END LOOP;
END $$;

CREATE FUNCTION private.visit_intake_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d date; current_day date;
BEGIN
 IF TG_OP='UPDATE' AND NEW.visita_id IS NOT NULL THEN RETURN NEW; END IF;
 d:=private.intake_code_day(NEW.fields,NEW.original_message);
 IF TG_OP='INSERT' THEN
   -- An incomplete request uses reception day until its visit date is resolved.
   d:=COALESCE(d,(now() AT TIME ZONE 'America/Sao_Paulo')::date);
   NEW.protocol:=substr(private.allocate_visit_code(d,NEW.id,null),4);
 ELSE
   SELECT day INTO current_day FROM private.visit_code_registry WHERE code='AG-'||OLD.protocol;
   IF d IS NOT NULL AND d IS DISTINCT FROM current_day THEN
     NEW.protocol_aliases:=array_append(OLD.protocol_aliases,OLD.protocol);
     NEW.protocol:=substr(private.allocate_visit_code(d,NEW.id,null),4);
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.visit_intake_code() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER visit_intake_code BEFORE INSERT OR UPDATE OF fields ON public.visit_intake FOR EACH ROW EXECUTE FUNCTION private.visit_intake_code();

CREATE FUNCTION private.visit_assign_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE request_id uuid; request_code text;
BEGIN
 IF TG_OP='UPDATE' THEN NEW.visit_code:=OLD.visit_code; RETURN NEW; END IF;
 request_id:=NULLIF(current_setting('memude.visit_intake_id',true),'')::uuid;
 IF request_id IS NOT NULL THEN
   SELECT 'AG-'||protocol INTO request_code FROM public.visit_intake WHERE id=request_id AND status='processing' AND visita_id IS NULL;
   UPDATE private.visit_code_registry SET visita_id=NEW.id WHERE code=request_code AND intake_id=request_id AND visita_id IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'Reserva de código indisponível'; END IF;
   NEW.visit_code:=request_code;
 ELSE NEW.visit_code:=private.allocate_visit_code(NEW.data_visita,null,NEW.id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.visit_assign_code() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER visit_assign_code BEFORE INSERT OR UPDATE OF visit_code ON public.visitas FOR EACH ROW EXECUTE FUNCTION private.visit_assign_code();
-- Clients omit the value; the BEFORE trigger always replaces this placeholder.
ALTER TABLE public.visitas ALTER COLUMN visit_code SET DEFAULT '';
ALTER TABLE public.visitas ALTER COLUMN visit_code SET NOT NULL;

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
   SELECT * INTO r FROM public.visit_intake WHERE (protocol=p_protocol OR p_protocol=ANY(protocol_aliases)) AND group_jid=p_group AND instance_id=p_instance FOR UPDATE;
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
 UPDATE public.visit_intake SET fields=p_fields,choices=p_choices,leased_until=null,updated_at=now() WHERE id=p_id RETURNING * INTO r;
 IF p_questions<>'' THEN
   UPDATE public.visit_intake SET status='needs_input',resolution_note=p_questions WHERE id=p_id;
   PERFORM private.visit_intake_notify(p_id,p_questions||E'\nResponda citando esta mensagem e informe os campos solicitados. Ou copie: RESOLVER AG-'||r.protocol||' R'||r.revision);
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
   note:=COALESCE(note,'')||E'\nConflito na agenda do corretor (60 min de visita + 30 min de intervalo). Aguarda decisão do Closer. Para manter esse horário: LIBERAR AG-'||r.protocol||' R'||r.revision;
   UPDATE public.visit_intake SET status='needs_closer',conflict_ids=conflicts,resolution_note=note WHERE id=p_id;
   PERFORM private.visit_intake_notify(p_id,note); RETURN 'needs_closer';
 END IF;
 IF lid IS NULL THEN
   INSERT INTO public.leads(nome,telefone,origem,observacoes,status,empreendimento_id)
   VALUES(p_fields->>'client_name',p_fields->>'client_phone',NULLIF(p_fields->>'source',''),NULLIF(p_fields->>'profile',''),'visita_agendada',p_property) RETURNING id INTO lid;
 END IF;
 PERFORM set_config('memude.approved_conflicts',COALESCE(array_to_string(r.approved_conflicts,','),''),true);
 PERFORM set_config('memude.visit_intake_id',r.id::text,true);
 INSERT INTO public.visitas(lead_id,corretor_id,empreendimento_id,data_visita,horario_visita,status,meeting_address,meeting_neighborhood,customer_profile,intake_source)
 VALUES(lid,p_broker,p_property,(p_fields->>'date')::date,(p_fields->>'time')::time,'agendada',NULLIF(p_fields->>'address',''),NULLIF(p_fields->>'neighborhood',''),NULLIF(p_fields->>'profile',''),'whatsapp_group') RETURNING id INTO vid;
 PERFORM set_config('memude.approved_conflicts','',true);
 PERFORM set_config('memude.visit_intake_id','',true);
 UPDATE public.visit_intake SET status='created',visita_id=vid,resolution_note='Visita cadastrada automaticamente' WHERE id=p_id;
 -- Direct replies may run outside the reminder window. Replace only the duplicated group/Closer notices.
 UPDATE public.visit_outbox o SET status='obsolete' FROM public.visit_events e WHERE o.event_id=e.id AND e.visita_id=vid AND e.kind='scheduled' AND o.destination IN ('group','closer') AND o.status='pending';
 PERFORM private.visit_intake_notify(p_id,'Solicitação cadastrada; aguardando aceite do corretor.'||E'\nCliente: '||(p_fields->>'client_name')||E'\nData: '||(p_fields->>'date')||' às '||(p_fields->>'time')||E'\nEmpreendimento: '||COALESCE(p_fields->>'property_name','Empreendimento selecionado')||E'\nCorretor: '||COALESCE(p_fields->>'broker_name','Match em andamento')||E'\nLocal: '||(p_fields->>'address')||E'\nAcompanhamento automático iniciado. https://core.memudecore.com.br/visitas');
 RETURN 'created';
END $$;

CREATE OR REPLACE FUNCTION private.visit_intake_notify(p_id uuid,p_text text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.visit_intake;
BEGIN
 SELECT * INTO STRICT r FROM public.visit_intake WHERE id=p_id;
 INSERT INTO public.visit_intake_outbox(intake_id,revision,destination,body)
 SELECT r.id,r.revision,d,'Agendamento AG-'||r.protocol||' R'||r.revision||E'\n'||p_text FROM unnest(ARRAY['group','closer']) d
 ON CONFLICT(intake_id,revision,destination,notification_kind) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION private.visit_intake_ack() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.visit_intake_outbox(intake_id,revision,destination,notification_kind,body)
 SELECT NEW.id,NEW.revision,d,'ack','Pedido recebido: AG-'||NEW.protocol||' R'||NEW.revision||E'\nAguardando análise. Para corrigir ou cancelar, responda citando esta mensagem. O cadastro só estará concluído após a confirmação do sistema.' FROM unnest(ARRAY['group','closer']) d;
 RETURN NEW;
END $$;
