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
 INSERT INTO public.visitas(lead_id,corretor_id,empreendimento_id,data_visita,horario_visita,status,meeting_address,meeting_neighborhood,customer_profile,intake_source)
 VALUES(lid,p_broker,p_property,(p_fields->>'date')::date,(p_fields->>'time')::time,'agendada',NULLIF(p_fields->>'address',''),NULLIF(p_fields->>'neighborhood',''),NULLIF(p_fields->>'profile',''),'whatsapp_group') RETURNING id INTO vid;
 UPDATE public.visit_intake SET status='created',visita_id=vid,resolution_note='Visita cadastrada automaticamente' WHERE id=p_id;
 -- Direct replies may run outside the reminder window. Replace only the duplicated group/Closer notices.
 UPDATE public.visit_outbox o SET status='obsolete' FROM public.visit_events e WHERE o.event_id=e.id AND e.visita_id=vid AND e.kind='scheduled' AND o.destination IN ('group','closer') AND o.status='pending';
 PERFORM private.visit_intake_notify(p_id,'Visita cadastrada.'||E'\nCliente: '||(p_fields->>'client_name')||E'\nData: '||(p_fields->>'date')||' às '||(p_fields->>'time')||E'\nEmpreendimento: '||(p_fields->>'property_name')||E'\nCorretor: '||(p_fields->>'broker_name')||E'\nLocal: '||(p_fields->>'address')||E'\nAcompanhamento automático iniciado. https://core.memudecore.com.br/visitas');
 RETURN 'created';
END $$;
