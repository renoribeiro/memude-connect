-- Fix for dashboard stats and funnel functions
-- Applied to production on 2026-01-18

-- Fix get_agent_dashboard_stats function to use correct column name (started_at instead of created_at)
CREATE OR REPLACE FUNCTION get_agent_dashboard_stats(
  p_agent_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  metric_name TEXT,
  current_value NUMERIC,
  previous_value NUMERIC,
  change_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH current_period AS (
    SELECT 
      COUNT(DISTINCT c.id) as conversations,
      COUNT(DISTINCT CASE WHEN q.id IS NOT NULL THEN c.id END) as qualified,
      COUNT(DISTINCT CASE 
        WHEN COALESCE(q.bant_budget_score,0) + COALESCE(q.bant_authority_score,0) + 
             COALESCE(q.bant_need_score,0) + COALESCE(q.bant_timeline_score,0) >= 60 
        THEN c.id END) as hot_warm,
      COUNT(DISTINCT CASE WHEN cfe.event_type = 'visit_scheduled' THEN c.id END) as visits,
      COALESCE(AVG(
        COALESCE(q.bant_budget_score,0) + COALESCE(q.bant_authority_score,0) + 
        COALESCE(q.bant_need_score,0) + COALESCE(q.bant_timeline_score,0)
      ), 0) as avg_bant
    FROM agent_conversations c
    LEFT JOIN ai_lead_qualification q ON q.conversation_id = c.id
    LEFT JOIN conversion_funnel_events cfe ON cfe.conversation_id = c.id
    WHERE (p_agent_id IS NULL OR c.agent_id = p_agent_id)
      AND c.started_at >= NOW() - (p_days || ' days')::interval
  ),
  previous_period AS (
    SELECT 
      COUNT(DISTINCT c.id) as conversations,
      COUNT(DISTINCT CASE WHEN q.id IS NOT NULL THEN c.id END) as qualified,
      COUNT(DISTINCT CASE 
        WHEN COALESCE(q.bant_budget_score,0) + COALESCE(q.bant_authority_score,0) + 
             COALESCE(q.bant_need_score,0) + COALESCE(q.bant_timeline_score,0) >= 60 
        THEN c.id END) as hot_warm,
      COUNT(DISTINCT CASE WHEN cfe.event_type = 'visit_scheduled' THEN c.id END) as visits,
      COALESCE(AVG(
        COALESCE(q.bant_budget_score,0) + COALESCE(q.bant_authority_score,0) + 
        COALESCE(q.bant_need_score,0) + COALESCE(q.bant_timeline_score,0)
      ), 0) as avg_bant
    FROM agent_conversations c
    LEFT JOIN ai_lead_qualification q ON q.conversation_id = c.id
    LEFT JOIN conversion_funnel_events cfe ON cfe.conversation_id = c.id
    WHERE (p_agent_id IS NULL OR c.agent_id = p_agent_id)
      AND c.started_at >= NOW() - (p_days * 2 || ' days')::interval
      AND c.started_at < NOW() - (p_days || ' days')::interval
  )
  SELECT 'Conversas', cur.conversations::NUMERIC, prev.conversations::NUMERIC,
         CASE WHEN prev.conversations = 0 THEN 0 
              ELSE ROUND(((cur.conversations - prev.conversations)::NUMERIC / prev.conversations) * 100, 1) END
  FROM current_period cur, previous_period prev
  UNION ALL
  SELECT 'Leads Qualificados', cur.qualified::NUMERIC, prev.qualified::NUMERIC,
         CASE WHEN prev.qualified = 0 THEN 0 
              ELSE ROUND(((cur.qualified - prev.qualified)::NUMERIC / prev.qualified) * 100, 1) END
  FROM current_period cur, previous_period prev
  UNION ALL
  SELECT 'Leads Hot/Warm', cur.hot_warm::NUMERIC, prev.hot_warm::NUMERIC,
         CASE WHEN prev.hot_warm = 0 THEN 0 
              ELSE ROUND(((cur.hot_warm - prev.hot_warm)::NUMERIC / prev.hot_warm) * 100, 1) END
  FROM current_period cur, previous_period prev
  UNION ALL
  SELECT 'Visitas Agendadas', cur.visits::NUMERIC, prev.visits::NUMERIC,
         CASE WHEN prev.visits = 0 THEN 0 
              ELSE ROUND(((cur.visits - prev.visits)::NUMERIC / prev.visits) * 100, 1) END
  FROM current_period cur, previous_period prev
  UNION ALL
  SELECT 'BANT Score Médio', ROUND(cur.avg_bant, 1), ROUND(prev.avg_bant, 1),
         CASE WHEN prev.avg_bant = 0 THEN 0 
              ELSE ROUND(((cur.avg_bant - prev.avg_bant) / prev.avg_bant) * 100, 1) END
  FROM current_period cur, previous_period prev;
END;
$$;

-- Fix get_conversion_funnel function - disambiguate column references
CREATE OR REPLACE FUNCTION get_conversion_funnel(
  p_agent_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  event_type TEXT,
  count BIGINT,
  percentage NUMERIC,
  avg_time_to_event_hours NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  SELECT COUNT(DISTINCT cfe.conversation_id) INTO v_total
  FROM conversion_funnel_events cfe
  WHERE (p_agent_id IS NULL OR cfe.agent_id = p_agent_id)
    AND cfe.created_at >= NOW() - (p_days || ' days')::interval
    AND cfe.event_type = 'conversation_started';
  
  IF v_total = 0 THEN
    v_total := 1;
  END IF;
  
  RETURN QUERY
  SELECT 
    cfe.event_type,
    COUNT(DISTINCT cfe.conversation_id) as count,
    ROUND((COUNT(DISTINCT cfe.conversation_id)::NUMERIC / v_total) * 100, 1) as percentage,
    ROUND(AVG(EXTRACT(EPOCH FROM (cfe.created_at - first_event.first_created_at)) / 3600)::NUMERIC, 1) as avg_time
  FROM conversion_funnel_events cfe
  LEFT JOIN LATERAL (
    SELECT fe.created_at as first_created_at
    FROM conversion_funnel_events fe
    WHERE fe.conversation_id = cfe.conversation_id
      AND fe.event_type = 'conversation_started'
    ORDER BY fe.created_at
    LIMIT 1
  ) first_event ON true
  WHERE (p_agent_id IS NULL OR cfe.agent_id = p_agent_id)
    AND cfe.created_at >= NOW() - (p_days || ' days')::interval
  GROUP BY cfe.event_type
  ORDER BY 
    CASE cfe.event_type
      WHEN 'conversation_started' THEN 1
      WHEN 'first_response' THEN 2
      WHEN 'qualification_started' THEN 3
      WHEN 'property_searched' THEN 4
      WHEN 'property_presented' THEN 5
      WHEN 'interest_shown' THEN 6
      WHEN 'visit_requested' THEN 7
      WHEN 'visit_scheduled' THEN 8
      WHEN 'converted' THEN 9
      ELSE 10
    END;
END;
$$;

-- Update write_audit_log to work with existing audit_logs schema
CREATE OR REPLACE FUNCTION write_audit_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL,
  p_previous_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Use existing audit_logs schema (table_name instead of entity_type)
  INSERT INTO audit_logs (
    user_id, action, table_name, record_id,
    old_values, new_values
  ) VALUES (
    p_user_id, p_action, p_entity_type, 
    CASE WHEN p_entity_id IS NOT NULL THEN p_entity_id::UUID ELSE NULL END,
    p_previous_value, p_new_value
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
