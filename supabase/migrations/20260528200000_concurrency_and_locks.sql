-- =====================================================
-- Migration: Onda 2 - Concurrency & Resiliency (P1)
-- Date: 2026-05-28
-- Description:
-- 1. Create atomic lead acceptance logic (accept_lead_distribution) using Row Lock.
-- 2. Create atomic visit acceptance logic (accept_visit_distribution) using Row Lock.
-- 3. Create high-performance WhatsApp queue dequeuer (dequeue_pending_messages) using FOR UPDATE SKIP LOCKED.
-- =====================================================

-- 1. Atomic Lead Acceptance function
CREATE OR REPLACE FUNCTION public.accept_lead_distribution(
  p_attempt_id UUID,
  p_corretor_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_queue_id UUID;
  v_lead_id UUID;
  v_queue_status TEXT;
BEGIN
  -- 1. Get queue_id and lead_id for the attempt
  SELECT queue_id, lead_id INTO v_queue_id, v_lead_id
  FROM public.distribution_attempts
  WHERE id = p_attempt_id;

  IF v_queue_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Lock the distribution queue row exclusively
  SELECT status INTO v_queue_status
  FROM public.distribution_queue
  WHERE id = v_queue_id
  FOR UPDATE;

  -- 3. If it's already completed or failed, return FALSE
  IF v_queue_status = 'completed' THEN
    RETURN FALSE;
  END IF;

  -- 4. Mark queue row as completed
  UPDATE public.distribution_queue
  SET 
    status = 'completed',
    assigned_corretor_id = p_corretor_id,
    completed_at = NOW()
  WHERE id = v_queue_id;

  -- 5. Mark attempt row as responded/accepted
  UPDATE public.distribution_attempts
  SET 
    status = 'responded',
    response_type = 'accepted',
    response_received_at = NOW()
  WHERE id = p_attempt_id;

  -- 6. Assign lead to the winning broker
  UPDATE public.leads
  SET 
    corretor_designado_id = p_corretor_id,
    status = 'em_contato'
  WHERE id = v_lead_id;

  -- 7. Cancel other pending attempts for this lead
  UPDATE public.distribution_attempts
  SET 
    status = 'timeout',
    response_type = 'cancelled',
    response_message = 'Cancelado - lead aceito por outro corretor'
  WHERE lead_id = v_lead_id 
    AND status = 'pending' 
    AND id <> p_attempt_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Atomic Visit Acceptance function
CREATE OR REPLACE FUNCTION public.accept_visit_distribution(
  p_attempt_id UUID,
  p_corretor_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_queue_id UUID;
  v_visit_id UUID;
  v_lead_id UUID;
  v_queue_status TEXT;
BEGIN
  -- 1. Get queue_id and visita_id for the attempt
  SELECT queue_id, visita_id INTO v_queue_id, v_visit_id
  FROM public.visit_distribution_attempts
  WHERE id = p_attempt_id;

  IF v_queue_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Get lead_id from the visits table
  SELECT lead_id INTO v_lead_id
  FROM public.visitas
  WHERE id = v_visit_id;

  -- 3. Lock the visit queue row exclusively
  SELECT status INTO v_queue_status
  FROM public.visit_distribution_queue
  WHERE id = v_queue_id
  FOR UPDATE;

  -- 4. If it's already completed or failed, return FALSE
  IF v_queue_status = 'completed' THEN
    RETURN FALSE;
  END IF;

  -- 5. Mark visit queue row as completed
  UPDATE public.visit_distribution_queue
  SET 
    status = 'completed',
    assigned_corretor_id = p_corretor_id,
    completed_at = NOW()
  WHERE id = v_queue_id;

  -- 6. Mark attempt row as responded/accepted
  UPDATE public.visit_distribution_attempts
  SET 
    status = 'responded',
    response_type = 'accepted',
    response_received_at = NOW()
  WHERE id = p_attempt_id;

  -- 7. Assign broker and confirm visit
  UPDATE public.visitas
  SET 
    corretor_id = p_corretor_id,
    status = 'confirmada'
  WHERE id = v_visit_id;

  -- 8. Assign broker to lead and update lead status
  IF v_lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET 
      corretor_designado_id = p_corretor_id,
      status = 'visita_agendada'
    WHERE id = v_lead_id;
  END IF;

  -- 9. Cancel other pending attempts for this visit
  UPDATE public.visit_distribution_attempts
  SET 
    status = 'timeout',
    response_type = 'cancelled',
    response_message = 'Cancelado - visita aceita por outro corretor'
  WHERE visita_id = v_visit_id 
    AND status = 'pending' 
    AND id <> p_attempt_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Atomic WhatsApp Message Queue Dequeuer (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.dequeue_pending_messages(p_limit INT)
RETURNS TABLE (
  id UUID,
  instance_id UUID,
  phone_number VARCHAR(20),
  message_body JSONB,
  priority INT,
  attempts INT
) AS $$
BEGIN
  RETURN QUERY
  UPDATE public.message_queue mq
  SET 
    status = 'processing', 
    last_attempt = NOW(),
    attempts = mq.attempts + 1
  WHERE mq.id IN (
    SELECT m.id 
    FROM public.message_queue m
    WHERE m.status = 'pending'
    ORDER BY m.priority DESC, m.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING mq.id, mq.instance_id, mq.phone_number, mq.message_body, mq.priority, mq.attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
