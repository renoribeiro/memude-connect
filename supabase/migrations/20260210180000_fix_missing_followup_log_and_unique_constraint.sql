-- =====================================================
-- Fix: Create missing agent_followup_log table (BUG-04)
-- Fix: Replace UNIQUE constraint with conditional index (BUG-05)
-- =====================================================

-- BUG-04: The agent_followup_log table is referenced by
-- ai-agent-processor and ai-followup-checker but was never created.
-- This table logs each follow-up message sent to a lead.
CREATE TABLE IF NOT EXISTS agent_followup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  followup_id UUID,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  template_used TEXT,
  sent_message TEXT NOT NULL,
  lead_responded BOOLEAN DEFAULT false,
  response_received_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_followup_log_conversation ON agent_followup_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_followup_log_agent ON agent_followup_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_followup_log_sent ON agent_followup_log(sent_at DESC);

-- RLS
ALTER TABLE agent_followup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage agent_followup_log" ON agent_followup_log 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Service role bypass agent_followup_log" ON agent_followup_log 
  FOR ALL USING (auth.role() = 'service_role');

-- BUG-05: Replace the problematic UNIQUE(agent_id, phone_number) constraint
-- that prevents re-conversations. Use a conditional unique index instead
-- that only enforces uniqueness for ACTIVE conversations.
ALTER TABLE agent_conversations DROP CONSTRAINT IF EXISTS agent_conversations_agent_id_phone_number_key;

-- Only allow one active conversation per agent+phone at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_conversation 
  ON agent_conversations(agent_id, phone_number) 
  WHERE status = 'active';

-- Comments
COMMENT ON TABLE agent_followup_log IS 'Log de mensagens de follow-up enviadas aos leads';
