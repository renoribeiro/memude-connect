-- Add deleted_at column to visitas table
ALTER TABLE public.visitas 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for better performance on deleted_at queries
CREATE INDEX idx_visitas_deleted_at ON public.visitas(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_visitas_active ON public.visitas(corretor_id, data_visita) WHERE deleted_at IS NULL;

-- Update RLS policies to exclude soft-deleted visitas for corretores
DROP POLICY IF EXISTS "Corretores can view their own visitas" ON public.visitas;
DROP POLICY IF EXISTS "Corretores can update their own visitas" ON public.visitas;

CREATE POLICY "Corretores can view their own active visitas" 
ON public.visitas 
FOR SELECT 
USING (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN corretores c ON c.profile_id = p.id
    WHERE p.user_id = auth.uid() AND c.id = visitas.corretor_id
  )
);

CREATE POLICY "Corretores can update their own active visitas" 
ON public.visitas 
FOR UPDATE 
USING (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN corretores c ON c.profile_id = p.id
    WHERE p.user_id = auth.uid() AND c.id = visitas.corretor_id
  )
);

-- Admin can still see and manage everything (including deleted)
-- Keep existing admin policy as is

-- Function to soft delete a visita
CREATE OR REPLACE FUNCTION public.soft_delete_visita(visita_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.visitas
  SET deleted_at = NOW()
  WHERE id = visita_id AND deleted_at IS NULL;
  
  -- Update related lead status if needed
  UPDATE public.leads
  SET status = 'cancelado'
  WHERE id = (SELECT lead_id FROM visitas WHERE id = visita_id)
  AND status = 'visita_agendada';
END;
$$;

-- Function to restore a deleted visita
CREATE OR REPLACE FUNCTION public.restore_visita(visita_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.visitas
  SET deleted_at = NULL
  WHERE id = visita_id AND deleted_at IS NOT NULL;
  
  -- Update related lead status back to visita_agendada if it was cancelado
  UPDATE public.leads
  SET status = 'visita_agendada'
  WHERE id = (SELECT lead_id FROM visitas WHERE id = visita_id)
  AND status = 'cancelado';
END;
$$;

-- Function to hard delete a visita (permanent deletion)
CREATE OR REPLACE FUNCTION public.hard_delete_visita(visita_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete related distribution attempts
  DELETE FROM public.visit_distribution_attempts
  WHERE visita_id = visita_id;
  
  -- Delete from distribution queue
  DELETE FROM public.visit_distribution_queue
  WHERE visita_id = visita_id;
  
  -- Delete the visita
  DELETE FROM public.visitas
  WHERE id = visita_id;
END;
$$;

-- Function to cleanup old deleted visitas (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_deleted_visitas()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Hard delete visitas that have been in trash for more than 30 days
  DELETE FROM public.visit_distribution_attempts
  WHERE visita_id IN (
    SELECT id FROM public.visitas 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days'
  );
  
  DELETE FROM public.visit_distribution_queue
  WHERE visita_id IN (
    SELECT id FROM public.visitas 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days'
  );
  
  DELETE FROM public.visitas 
  WHERE deleted_at IS NOT NULL 
  AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$;