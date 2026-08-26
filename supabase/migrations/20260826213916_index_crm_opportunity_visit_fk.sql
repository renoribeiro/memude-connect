-- A FK precisa de um indice iniciado por visita_id para exclusoes/updates eficientes.
CREATE INDEX idx_crm_opportunities_visita
  ON public.crm_leads (visita_id)
  WHERE visita_id IS NOT NULL;
