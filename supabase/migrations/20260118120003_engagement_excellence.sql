-- =====================================================
-- Rich Media and Engagement Enhancement Migration
-- Phase 3: Engagement Excellence
-- =====================================================

-- =====================================================
-- Property Media Table for Rich Content
-- =====================================================
CREATE TABLE IF NOT EXISTS property_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empreendimento_id UUID REFERENCES empreendimentos(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'pdf', 'tour_360', 'brochure', 'floor_plan')),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size_bytes INTEGER,
  duration_seconds INTEGER, -- For videos
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Media Delivery Log
-- =====================================================
CREATE TABLE IF NOT EXISTS media_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE,
  media_id UUID REFERENCES property_media(id) ON DELETE SET NULL,
  empreendimento_id UUID REFERENCES empreendimentos(id) ON DELETE SET NULL,
  media_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  response_received BOOLEAN DEFAULT false
);

-- =====================================================
-- Objection Log for Analytics
-- =====================================================
CREATE TABLE IF NOT EXISTS objection_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  objection_type TEXT NOT NULL,
  confidence NUMERIC(3,2),
  response_given TEXT,
  was_resolved BOOLEAN,
  escalated_to_human BOOLEAN DEFAULT false,
  counter_points_used TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Human Handoff Log
-- =====================================================
CREATE TABLE IF NOT EXISTS human_handoff_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE,
  handoff_reason TEXT NOT NULL,
  urgency_level TEXT CHECK (urgency_level IN ('high', 'medium', 'low')),
  bant_score_at_handoff INTEGER,
  temperature_at_handoff TEXT,
  objections_at_handoff TEXT[],
  summary TEXT,
  recommended_actions TEXT[],
  assigned_to UUID REFERENCES profiles(id),
  accepted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Enhanced Follow-up Templates
-- =====================================================
ALTER TABLE agent_followups ADD COLUMN IF NOT EXISTS 
  template_variant TEXT DEFAULT 'default';
ALTER TABLE agent_followups ADD COLUMN IF NOT EXISTS 
  use_for_temperature TEXT[] DEFAULT ARRAY['hot', 'warm', 'cool', 'cold']::TEXT[];
ALTER TABLE agent_followups ADD COLUMN IF NOT EXISTS 
  use_after_objection TEXT;
ALTER TABLE agent_followups ADD COLUMN IF NOT EXISTS 
  include_property_reminder BOOLEAN DEFAULT false;
ALTER TABLE agent_followups ADD COLUMN IF NOT EXISTS 
  max_attempts INTEGER DEFAULT 3;

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_property_media_empreendimento ON property_media(empreendimento_id);
CREATE INDEX IF NOT EXISTS idx_property_media_type ON property_media(media_type);
CREATE INDEX IF NOT EXISTS idx_property_media_featured ON property_media(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_media_delivery_conversation ON media_delivery_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_objection_log_conversation ON objection_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_objection_log_type ON objection_log(objection_type);
CREATE INDEX IF NOT EXISTS idx_handoff_log_conversation ON human_handoff_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_handoff_log_unassigned ON human_handoff_log(assigned_to) WHERE assigned_to IS NULL;

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE property_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE objection_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_handoff_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage property_media" ON property_media 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage media_delivery_log" ON media_delivery_log 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage objection_log" ON objection_log 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage human_handoff_log" ON human_handoff_log 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Service role bypass
CREATE POLICY "Service role bypass property_media" ON property_media FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass media_delivery_log" ON media_delivery_log FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass objection_log" ON objection_log FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass human_handoff_log" ON human_handoff_log FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- Function: Get Media for Property
-- =====================================================
CREATE OR REPLACE FUNCTION get_property_media(
  p_empreendimento_id UUID,
  p_media_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  media_type TEXT,
  title TEXT,
  description TEXT,
  file_url TEXT,
  thumbnail_url TEXT,
  is_featured BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.id,
    pm.media_type,
    pm.title,
    pm.description,
    pm.file_url,
    pm.thumbnail_url,
    pm.is_featured
  FROM property_media pm
  WHERE pm.empreendimento_id = p_empreendimento_id
    AND pm.is_active = true
    AND (p_media_type IS NULL OR pm.media_type = p_media_type)
  ORDER BY pm.is_featured DESC, pm.display_order ASC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- Function: Get Objection Analytics
-- =====================================================
CREATE OR REPLACE FUNCTION get_objection_stats(
  p_agent_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  objection_type TEXT,
  total_count BIGINT,
  resolved_count BIGINT,
  escalated_count BIGINT,
  resolution_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ol.objection_type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE ol.was_resolved = true) as resolved_count,
    COUNT(*) FILTER (WHERE ol.escalated_to_human = true) as escalated_count,
    ROUND(
      (COUNT(*) FILTER (WHERE ol.was_resolved = true)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
      1
    ) as resolution_rate
  FROM objection_log ol
  JOIN agent_conversations c ON c.id = ol.conversation_id
  WHERE (p_agent_id IS NULL OR c.agent_id = p_agent_id)
    AND ol.created_at >= NOW() - (p_days || ' days')::interval
  GROUP BY ol.objection_type
  ORDER BY total_count DESC;
END;
$$;

-- =====================================================
-- Function: Get Pending Handoffs
-- =====================================================
CREATE OR REPLACE FUNCTION get_pending_handoffs(
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  phone_number TEXT,
  customer_name TEXT,
  handoff_reason TEXT,
  urgency_level TEXT,
  bant_score INTEGER,
  summary TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id,
    h.conversation_id,
    c.phone_number,
    c.customer_name,
    h.handoff_reason,
    h.urgency_level,
    h.bant_score_at_handoff,
    h.summary,
    h.created_at
  FROM human_handoff_log h
  JOIN agent_conversations c ON c.id = h.conversation_id
  WHERE h.assigned_to IS NULL
    AND h.resolved_at IS NULL
  ORDER BY 
    CASE h.urgency_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
    h.created_at ASC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE property_media IS 'Mídias ricas associadas a empreendimentos (imagens, vídeos, PDFs)';
COMMENT ON TABLE media_delivery_log IS 'Log de mídias enviadas nas conversas';
COMMENT ON TABLE objection_log IS 'Log de objeções detectadas e tratadas';
COMMENT ON TABLE human_handoff_log IS 'Log de transferências para atendimento humano';
