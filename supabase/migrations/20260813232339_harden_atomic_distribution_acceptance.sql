-- Make acceptance atomic, validate the broker/attempt relationship and use
-- only valid domain status values.
BEGIN;

CREATE OR REPLACE FUNCTION public.accept_lead_distribution(
  p_attempt_id uuid,
  p_corretor_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  queue_id uuid;
  lead_id uuid;
  queue_status text;
BEGIN
  SELECT attempt.queue_id, attempt.lead_id
  INTO queue_id, lead_id
  FROM public.distribution_attempts AS attempt
  WHERE attempt.id = p_attempt_id
    AND attempt.corretor_id = p_corretor_id
    AND attempt.status = 'pending'
  FOR UPDATE;

  IF queue_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT queue.status
  INTO queue_status
  FROM public.distribution_queue AS queue
  WHERE queue.id = queue_id
  FOR UPDATE;

  IF queue_status NOT IN ('pending', 'in_progress', 'processing') THEN
    RETURN false;
  END IF;

  UPDATE public.distribution_queue AS queue
  SET status = 'completed',
      assigned_corretor_id = p_corretor_id,
      completed_at = now()
  WHERE queue.id = queue_id;

  UPDATE public.distribution_attempts AS attempt
  SET status = 'responded',
      response_type = 'accepted',
      response_received_at = now()
  WHERE attempt.id = p_attempt_id;

  UPDATE public.leads AS lead
  SET corretor_designado_id = p_corretor_id,
      status = 'corretor_designado'::public.lead_status,
      updated_at = now()
  WHERE lead.id = lead_id;

  UPDATE public.distribution_attempts AS attempt
  SET status = 'timeout',
      response_type = 'timeout',
      response_message = 'Cancelado - lead aceito por outro corretor',
      response_received_at = COALESCE(attempt.response_received_at, now())
  WHERE attempt.lead_id = lead_id
    AND attempt.status = 'pending'
    AND attempt.id <> p_attempt_id;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_visit_distribution(
  p_attempt_id uuid,
  p_corretor_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  queue_id uuid;
  visit_id uuid;
  lead_id uuid;
  queue_status text;
BEGIN
  SELECT attempt.queue_id, attempt.visita_id
  INTO queue_id, visit_id
  FROM public.visit_distribution_attempts AS attempt
  WHERE attempt.id = p_attempt_id
    AND attempt.corretor_id = p_corretor_id
    AND attempt.status = 'pending'
  FOR UPDATE;

  IF queue_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT visit.lead_id
  INTO lead_id
  FROM public.visitas AS visit
  WHERE visit.id = visit_id;

  SELECT queue.status
  INTO queue_status
  FROM public.visit_distribution_queue AS queue
  WHERE queue.id = queue_id
  FOR UPDATE;

  IF queue_status NOT IN ('pending', 'in_progress', 'processing') THEN
    RETURN false;
  END IF;

  UPDATE public.visit_distribution_queue AS queue
  SET status = 'completed',
      assigned_corretor_id = p_corretor_id,
      completed_at = now()
  WHERE queue.id = queue_id;

  UPDATE public.visit_distribution_attempts AS attempt
  SET status = 'accepted',
      response_type = 'accepted',
      response_received_at = now()
  WHERE attempt.id = p_attempt_id;

  UPDATE public.visitas AS visit
  SET corretor_id = p_corretor_id,
      status = 'confirmada',
      updated_at = now()
  WHERE visit.id = visit_id;

  IF lead_id IS NOT NULL THEN
    UPDATE public.leads AS lead
    SET corretor_designado_id = p_corretor_id,
        status = 'visita_agendada'::public.lead_status,
        updated_at = now()
    WHERE lead.id = lead_id;
  END IF;

  UPDATE public.visit_distribution_attempts AS attempt
  SET status = 'timeout',
      response_type = 'cancelled',
      response_message = 'Cancelado - visita aceita por outro corretor',
      response_received_at = COALESCE(attempt.response_received_at, now())
  WHERE attempt.visita_id = visit_id
    AND attempt.status = 'pending'
    AND attempt.id <> p_attempt_id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_lead_distribution(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_visit_distribution(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_lead_distribution(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_visit_distribution(uuid, uuid)
  TO service_role;

COMMIT;
