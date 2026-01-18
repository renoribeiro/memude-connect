-- =====================================================
-- Analytics and Optimization Migration
-- Phase 4: Analytics & Optimization
-- =====================================================

-- =====================================================
-- Agent Performance Metrics (Daily Aggregates)
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Conversation metrics
  total_conversations INTEGER DEFAULT 0,
  new_conversations INTEGER DEFAULT 0,
  active_conversations INTEGER DEFAULT 0,
  transferred_conversations INTEGER DEFAULT 0,
  completed_conversations INTEGER DEFAULT 0,
  
  -- Message metrics
  total_messages INTEGER DEFAULT 0,
  user_messages INTEGER DEFAULT 0,
  agent_messages INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  
  -- Qualification metrics
  leads_qualified INTEGER DEFAULT 0,
  hot_leads INTEGER DEFAULT 0,
  warm_leads INTEGER DEFAULT 0,
  cool_leads INTEGER DEFAULT 0,
  cold_leads INTEGER DEFAULT 0,
  avg_bant_score NUMERIC(5,2),
  
  -- Action metrics
  property_searches INTEGER DEFAULT 0,
  visits_scheduled INTEGER DEFAULT 0,
  human_transfers INTEGER DEFAULT 0,
  followups_sent INTEGER DEFAULT 0,
  
  -- Engagement metrics
  objections_detected INTEGER DEFAULT 0,
  objections_resolved INTEGER DEFAULT 0,
  media_sent INTEGER DEFAULT 0,
  
  -- Token/cost metrics
  total_tokens_used INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,4),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(agent_id, date)
);

-- =====================================================
-- Conversion Funnel Events
-- =====================================================
CREATE TABLE IF NOT EXISTS conversion_funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  
  event_type TEXT NOT NULL CHECK (event_type IN (
    'conversation_started',
    'first_response',
    'qualification_started',
    'property_searched',
    'property_presented',
    'interest_shown',
    'visit_requested',
    'visit_scheduled',
    'contact_shared',
    'transferred_to_human',
    'converted',
    'lost'
  )),
  
  event_data JSONB DEFAULT '{}',
  bant_score_at_event INTEGER,
  temperature_at_event TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- A/B Test Experiments
-- =====================================================
CREATE TABLE IF NOT EXISTS ab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  
  experiment_type TEXT NOT NULL CHECK (experiment_type IN (
    'prompt_variation',
    'greeting_message',
    'followup_timing',
    'response_style',
    'objection_handling',
    'qualification_order'
  )),
  
  -- Variants configuration
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Example: [{"id": "control", "weight": 50, "config": {...}}, {"id": "variant_a", "weight": 50, "config": {...}}]
  
  -- Success metric
  primary_metric TEXT NOT NULL DEFAULT 'conversion_rate',
  secondary_metrics TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Sample size
  target_sample_size INTEGER DEFAULT 100,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- A/B Test Assignments (Which variant each conversation got)
-- =====================================================
CREATE TABLE IF NOT EXISTS ab_experiment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  
  -- Outcome tracking
  converted BOOLEAN DEFAULT false,
  primary_metric_value NUMERIC,
  secondary_metrics JSONB DEFAULT '{}',
  
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  outcome_recorded_at TIMESTAMPTZ,
  
  UNIQUE(experiment_id, conversation_id)
);

-- =====================================================
-- Real-time Activity Log (for live monitoring)
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'message_received',
    'message_sent',
    'intent_detected',
    'objection_detected',
    'action_executed',
    'handoff_triggered',
    'error_occurred'
  )),
  
  activity_data JSONB DEFAULT '{}',
  duration_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_perf_metrics_agent_date ON agent_performance_metrics(agent_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_conv ON conversion_funnel_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_type ON conversion_funnel_events(event_type);
CREATE INDEX IF NOT EXISTS idx_funnel_events_time ON conversion_funnel_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiments_agent ON ab_experiments(agent_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON ab_experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_exp ON ab_experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_agent ON agent_activity_log(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_conv ON agent_activity_log(conversation_id);

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE agent_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage agent_performance_metrics" ON agent_performance_metrics 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage conversion_funnel_events" ON conversion_funnel_events 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage ab_experiments" ON ab_experiments 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage ab_experiment_assignments" ON ab_experiment_assignments 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage agent_activity_log" ON agent_activity_log 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Service role bypass
CREATE POLICY "Service role bypass agent_performance_metrics" ON agent_performance_metrics FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass conversion_funnel_events" ON conversion_funnel_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass ab_experiments" ON ab_experiments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass ab_experiment_assignments" ON ab_experiment_assignments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass agent_activity_log" ON agent_activity_log FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- Function: Get Conversion Funnel Stats
-- =====================================================
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
  -- Get total conversations started
  SELECT COUNT(DISTINCT conversation_id) INTO v_total
  FROM conversion_funnel_events
  WHERE event_type = 'conversation_started'
    AND (p_agent_id IS NULL OR agent_id = p_agent_id)
    AND created_at >= NOW() - (p_days || ' days')::interval;
  
  IF v_total = 0 THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH ordered_events AS (
    SELECT 
      cfe.event_type,
      cfe.conversation_id,
      cfe.created_at,
      first_value(cfe.created_at) OVER (
        PARTITION BY cfe.conversation_id 
        ORDER BY cfe.created_at
      ) as conv_start
    FROM conversion_funnel_events cfe
    WHERE (p_agent_id IS NULL OR cfe.agent_id = p_agent_id)
      AND cfe.created_at >= NOW() - (p_days || ' days')::interval
  )
  SELECT 
    oe.event_type,
    COUNT(DISTINCT oe.conversation_id),
    ROUND((COUNT(DISTINCT oe.conversation_id)::NUMERIC / v_total) * 100, 1),
    ROUND(AVG(EXTRACT(EPOCH FROM (oe.created_at - oe.conv_start)) / 3600)::NUMERIC, 2)
  FROM ordered_events oe
  GROUP BY oe.event_type
  ORDER BY 
    CASE oe.event_type
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

-- =====================================================
-- Function: Get Agent Dashboard Stats
-- =====================================================
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
      SUM(total_conversations) as conversations,
      SUM(leads_qualified) as qualified,
      SUM(hot_leads + warm_leads) as hot_warm,
      SUM(visits_scheduled) as visits,
      SUM(human_transfers) as transfers,
      AVG(avg_bant_score) as avg_bant,
      SUM(total_tokens_used) as tokens
    FROM agent_performance_metrics
    WHERE (p_agent_id IS NULL OR agent_id = p_agent_id)
      AND date >= CURRENT_DATE - p_days
  ),
  previous_period AS (
    SELECT
      SUM(total_conversations) as conversations,
      SUM(leads_qualified) as qualified,
      SUM(hot_leads + warm_leads) as hot_warm,
      SUM(visits_scheduled) as visits,
      SUM(human_transfers) as transfers,
      AVG(avg_bant_score) as avg_bant,
      SUM(total_tokens_used) as tokens
    FROM agent_performance_metrics
    WHERE (p_agent_id IS NULL OR agent_id = p_agent_id)
      AND date >= CURRENT_DATE - (p_days * 2)
      AND date < CURRENT_DATE - p_days
  )
  SELECT 'Conversas'::TEXT, c.conversations::NUMERIC, p.conversations::NUMERIC,
    CASE WHEN COALESCE(p.conversations, 0) = 0 THEN 0 
         ELSE ROUND(((c.conversations - p.conversations)::NUMERIC / p.conversations) * 100, 1) END
  FROM current_period c, previous_period p
  UNION ALL
  SELECT 'Leads Qualificados', c.qualified::NUMERIC, p.qualified::NUMERIC,
    CASE WHEN COALESCE(p.qualified, 0) = 0 THEN 0 
         ELSE ROUND(((c.qualified - p.qualified)::NUMERIC / p.qualified) * 100, 1) END
  FROM current_period c, previous_period p
  UNION ALL
  SELECT 'Leads Hot/Warm', c.hot_warm::NUMERIC, p.hot_warm::NUMERIC,
    CASE WHEN COALESCE(p.hot_warm, 0) = 0 THEN 0 
         ELSE ROUND(((c.hot_warm - p.hot_warm)::NUMERIC / p.hot_warm) * 100, 1) END
  FROM current_period c, previous_period p
  UNION ALL
  SELECT 'Visitas Agendadas', c.visits::NUMERIC, p.visits::NUMERIC,
    CASE WHEN COALESCE(p.visits, 0) = 0 THEN 0 
         ELSE ROUND(((c.visits - p.visits)::NUMERIC / p.visits) * 100, 1) END
  FROM current_period c, previous_period p
  UNION ALL
  SELECT 'BANT Score Médio', ROUND(c.avg_bant, 1), ROUND(p.avg_bant, 1),
    CASE WHEN COALESCE(p.avg_bant, 0) = 0 THEN 0 
         ELSE ROUND(((c.avg_bant - p.avg_bant) / p.avg_bant) * 100, 1) END
  FROM current_period c, previous_period p;
END;
$$;

-- =====================================================
-- Function: Get A/B Test Results
-- =====================================================
CREATE OR REPLACE FUNCTION get_ab_test_results(
  p_experiment_id UUID
)
RETURNS TABLE (
  variant_id TEXT,
  sample_size BIGINT,
  conversions BIGINT,
  conversion_rate NUMERIC,
  avg_metric_value NUMERIC,
  confidence_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aea.variant_id,
    COUNT(*) as sample_size,
    COUNT(*) FILTER (WHERE aea.converted = true) as conversions,
    ROUND((COUNT(*) FILTER (WHERE aea.converted = true)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2) as conversion_rate,
    ROUND(AVG(aea.primary_metric_value), 2) as avg_metric_value,
    CASE 
      WHEN COUNT(*) < 30 THEN 'Amostra insuficiente'
      WHEN COUNT(*) < 100 THEN 'Baixa confiança'
      ELSE 'Alta confiança'
    END as confidence_level
  FROM ab_experiment_assignments aea
  WHERE aea.experiment_id = p_experiment_id
  GROUP BY aea.variant_id
  ORDER BY conversion_rate DESC;
END;
$$;

-- =====================================================
-- Function: Assign Conversation to A/B Experiment
-- =====================================================
CREATE OR REPLACE FUNCTION assign_ab_experiment(
  p_conversation_id UUID,
  p_agent_id UUID
)
RETURNS TABLE (
  experiment_id UUID,
  variant_id TEXT,
  variant_config JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_experiment RECORD;
  v_variant RECORD;
  v_random NUMERIC;
  v_cumulative NUMERIC;
BEGIN
  -- Find active experiment for this agent
  FOR v_experiment IN 
    SELECT * FROM ab_experiments 
    WHERE agent_id = p_agent_id 
      AND status = 'running'
    ORDER BY created_at DESC
    LIMIT 1
  LOOP
    -- Check if already assigned
    IF EXISTS (
      SELECT 1 FROM ab_experiment_assignments 
      WHERE experiment_id = v_experiment.id 
        AND conversation_id = p_conversation_id
    ) THEN
      SELECT aea.variant_id, 
             (SELECT v->>'config' FROM jsonb_array_elements(v_experiment.variants) v 
              WHERE v->>'id' = aea.variant_id)::jsonb
      INTO variant_id, variant_config
      FROM ab_experiment_assignments aea
      WHERE aea.experiment_id = v_experiment.id 
        AND aea.conversation_id = p_conversation_id;
      
      experiment_id := v_experiment.id;
      RETURN NEXT;
      RETURN;
    END IF;
    
    -- Random assignment based on weights
    v_random := random() * 100;
    v_cumulative := 0;
    
    FOR v_variant IN 
      SELECT * FROM jsonb_array_elements(v_experiment.variants)
    LOOP
      v_cumulative := v_cumulative + (v_variant.value->>'weight')::NUMERIC;
      
      IF v_random <= v_cumulative THEN
        -- Assign this variant
        INSERT INTO ab_experiment_assignments (
          experiment_id, 
          conversation_id, 
          variant_id
        ) VALUES (
          v_experiment.id,
          p_conversation_id,
          v_variant.value->>'id'
        );
        
        experiment_id := v_experiment.id;
        variant_id := v_variant.value->>'id';
        variant_config := (v_variant.value->>'config')::jsonb;
        RETURN NEXT;
        RETURN;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN;
END;
$$;

-- =====================================================
-- Trigger: Update Daily Metrics
-- =====================================================
CREATE OR REPLACE FUNCTION update_daily_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent_id UUID;
  v_today DATE;
BEGIN
  v_today := CURRENT_DATE;
  
  -- Get agent_id from conversation
  SELECT agent_id INTO v_agent_id
  FROM agent_conversations
  WHERE id = NEW.conversation_id;
  
  IF v_agent_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Upsert metrics
  INSERT INTO agent_performance_metrics (agent_id, date)
  VALUES (v_agent_id, v_today)
  ON CONFLICT (agent_id, date) DO NOTHING;
  
  -- Update based on message role
  IF TG_TABLE_NAME = 'agent_messages' THEN
    UPDATE agent_performance_metrics
    SET 
      total_messages = total_messages + 1,
      user_messages = CASE WHEN NEW.role = 'user' THEN user_messages + 1 ELSE user_messages END,
      agent_messages = CASE WHEN NEW.role = 'assistant' THEN agent_messages + 1 ELSE agent_messages END,
      total_tokens_used = total_tokens_used + COALESCE(NEW.tokens_used, 0),
      updated_at = NOW()
    WHERE agent_id = v_agent_id AND date = v_today;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on agent_messages
DROP TRIGGER IF EXISTS trg_update_metrics_on_message ON agent_messages;
CREATE TRIGGER trg_update_metrics_on_message
  AFTER INSERT ON agent_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_metrics();

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE agent_performance_metrics IS 'Métricas diárias agregadas de performance dos agentes';
COMMENT ON TABLE conversion_funnel_events IS 'Eventos de funil de conversão para análise';
COMMENT ON TABLE ab_experiments IS 'Experimentos A/B configurados';
COMMENT ON TABLE ab_experiment_assignments IS 'Associação de conversas a variantes de experimentos';
COMMENT ON TABLE agent_activity_log IS 'Log de atividades em tempo real';
