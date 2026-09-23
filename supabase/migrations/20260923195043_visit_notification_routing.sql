-- Group: one accepted-assignment announcement per visit revision. Operational events: Closer.
BEGIN;
CREATE OR REPLACE FUNCTION private.visit_emit(p_visit uuid,p_kind text,p_payload jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE eid uuid; rev integer; dest text;
BEGIN
 SELECT revision INTO STRICT rev FROM public.visit_cycles WHERE visita_id=p_visit FOR UPDATE;
 INSERT INTO public.visit_events(visita_id,revision,kind,payload) VALUES(p_visit,rev,p_kind,p_payload) RETURNING id INTO eid;

 FOREACH dest IN ARRAY ARRAY['closer','group','sheets'] LOOP
  IF dest='group' AND (p_kind<>'match_accepted' OR EXISTS (
    SELECT 1 FROM public.visit_outbox o JOIN public.visit_events e ON e.id=o.event_id
    WHERE o.visita_id=p_visit AND o.revision=rev AND o.destination='group' AND e.kind='match_accepted'
  )) THEN CONTINUE; END IF;
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
CREATE OR REPLACE FUNCTION private.visit_intake_notify(p_id uuid,p_text text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.visit_intake;
BEGIN
 SELECT * INTO STRICT r FROM public.visit_intake WHERE id=p_id;
 INSERT INTO public.visit_intake_outbox(intake_id,revision,destination,body)
 SELECT r.id,r.revision,d,'Agendamento AG-'||r.protocol||' R'||r.revision||E'\n'||p_text FROM unnest(ARRAY['closer']) d
 ON CONFLICT(intake_id,revision,destination,notification_kind) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION private.visit_intake_ack() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.visit_intake_outbox(intake_id,revision,destination,notification_kind,body)
 SELECT NEW.id,NEW.revision,d,'ack','Pedido recebido: AG-'||NEW.protocol||' R'||NEW.revision||E'\nAguardando análise. Para corrigir ou cancelar, responda citando esta mensagem. O cadastro só estará concluído após a confirmação do sistema.' FROM unnest(ARRAY['closer']) d;
 RETURN NEW;
END $$;

-- Preserve a safe pending private copy if an old group delivery has no counterpart.
INSERT INTO public.visit_outbox(visita_id,revision,event_id,destination,urgent)
SELECT o.visita_id,o.revision,o.event_id,'closer',o.urgent
FROM public.visit_outbox o JOIN public.visit_events e ON e.id=o.event_id
WHERE o.destination='group' AND e.kind<>'match_accepted' AND o.status IN ('pending','failed')
 AND o.provider_id IS NULL AND o.delivery_state IN ('queued','failed')
ON CONFLICT(event_id,destination) DO NOTHING;
INSERT INTO public.visit_intake_outbox(intake_id,revision,destination,notification_kind,body)
SELECT intake_id,revision,'closer',notification_kind,body FROM public.visit_intake_outbox
WHERE destination='group' AND status IN ('pending','failed') AND provider_id IS NULL AND delivery_state IN ('queued','failed')
ON CONFLICT(intake_id,revision,destination,notification_kind) DO NOTHING;
-- Keep sent history and ambiguous deliveries; do not replay historical confirmations.
UPDATE public.visit_outbox o SET status='obsolete',leased_until=null,last_error='Aviso operacional restrito ao Closer'
FROM public.visit_events e WHERE e.id=o.event_id AND o.destination='group' AND e.kind<>'match_accepted' AND o.status IN ('pending','failed','processing');
UPDATE public.visit_intake_outbox SET status='obsolete',leased_until=null,last_error='Aviso operacional restrito ao Closer'
WHERE destination='group' AND status IN ('pending','failed','processing');
REVOKE ALL ON FUNCTION private.visit_emit(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.visit_intake_notify(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.visit_intake_ack() FROM PUBLIC,anon,authenticated;
COMMIT;
