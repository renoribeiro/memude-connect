-- CRM Kanban Tables
-- Módulo de CRM com funis personalizáveis e automações

-- 1. Funis de vendas personalizáveis
CREATE TABLE crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    is_default BOOLEAN DEFAULT false,
    auto_add_visits BOOLEAN DEFAULT false,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Etapas do funil
CREATE TABLE crm_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE CASCADE NOT NULL,
    nome TEXT NOT NULL,
    cor TEXT DEFAULT '#6366f1',
    posicao INTEGER NOT NULL,
    is_final BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Leads no pipeline (bridge table)
CREATE TABLE crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
    pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE CASCADE NOT NULL,
    stage_id UUID REFERENCES crm_stages(id) ON DELETE SET NULL,
    posicao INTEGER DEFAULT 0,
    valor_estimado DECIMAL(15,2),
    notas TEXT,
    moved_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lead_id, pipeline_id)
);

-- 4. Regras de automação
CREATE TABLE crm_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE CASCADE NOT NULL,
    nome TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_value TEXT,
    action_type TEXT NOT NULL DEFAULT 'move_to_stage',
    target_stage_id UUID REFERENCES crm_stages(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_automations ENABLE ROW LEVEL SECURITY;

-- RLS: Admins full access
CREATE POLICY "Admins can manage crm_pipelines" ON crm_pipelines
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage crm_stages" ON crm_stages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage crm_leads" ON crm_leads
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage crm_automations" ON crm_automations
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- RLS: Corretores can read CRM data
CREATE POLICY "Corretores can view crm_pipelines" ON crm_pipelines
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Corretores can view crm_stages" ON crm_stages
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Corretores can view their crm_leads" ON crm_leads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM leads l
            JOIN corretores c ON c.id = l.corretor_designado_id
            JOIN profiles p ON p.id = c.profile_id
            WHERE p.user_id = auth.uid() AND l.id = crm_leads.lead_id
        )
        OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Indexes
CREATE INDEX idx_crm_stages_pipeline ON crm_stages(pipeline_id);
CREATE INDEX idx_crm_stages_posicao ON crm_stages(pipeline_id, posicao);
CREATE INDEX idx_crm_leads_pipeline ON crm_leads(pipeline_id);
CREATE INDEX idx_crm_leads_stage ON crm_leads(stage_id);
CREATE INDEX idx_crm_leads_lead ON crm_leads(lead_id);
CREATE INDEX idx_crm_automations_pipeline ON crm_automations(pipeline_id);
CREATE INDEX idx_crm_automations_trigger ON crm_automations(trigger_type);

-- Updated_at triggers
CREATE TRIGGER update_crm_pipelines_updated_at BEFORE UPDATE ON crm_pipelines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_stages_updated_at BEFORE UPDATE ON crm_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON crm_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_automations_updated_at BEFORE UPDATE ON crm_automations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Automation trigger: when visita status changes, process CRM automations
CREATE OR REPLACE FUNCTION process_crm_visit_automations()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        UPDATE crm_leads cl
        SET stage_id = ca.target_stage_id,
            moved_at = NOW(),
            updated_at = NOW()
        FROM crm_automations ca
        WHERE ca.pipeline_id = cl.pipeline_id
        AND ca.trigger_type = 'visit_status_change'
        AND ca.trigger_value = NEW.status
        AND ca.is_active = true
        AND cl.lead_id = NEW.lead_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER crm_visit_automation_trigger
    AFTER UPDATE ON visitas
    FOR EACH ROW EXECUTE FUNCTION process_crm_visit_automations();

-- Auto-add trigger: when a visita is created, add lead to default pipeline first stage
CREATE OR REPLACE FUNCTION auto_add_lead_to_crm()
RETURNS TRIGGER AS $$
DECLARE
    v_pipeline_id UUID;
    v_first_stage_id UUID;
BEGIN
    -- Find default pipeline with auto_add_visits enabled
    SELECT id INTO v_pipeline_id
    FROM crm_pipelines
    WHERE is_default = true AND auto_add_visits = true
    LIMIT 1;

    IF v_pipeline_id IS NOT NULL THEN
        -- Get first stage
        SELECT id INTO v_first_stage_id
        FROM crm_stages
        WHERE pipeline_id = v_pipeline_id
        ORDER BY posicao ASC
        LIMIT 1;

        IF v_first_stage_id IS NOT NULL THEN
            -- Insert if not already in pipeline
            INSERT INTO crm_leads (lead_id, pipeline_id, stage_id, posicao)
            VALUES (NEW.lead_id, v_pipeline_id, v_first_stage_id, 0)
            ON CONFLICT (lead_id, pipeline_id) DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER crm_auto_add_on_visit_created
    AFTER INSERT ON visitas
    FOR EACH ROW EXECUTE FUNCTION auto_add_lead_to_crm();

-- Insert default pipeline with stages
DO $$
DECLARE
    v_pipeline_id UUID;
BEGIN
    INSERT INTO crm_pipelines (nome, descricao, is_default, auto_add_visits)
    VALUES ('Funil Principal', 'Funil padrão de vendas', true, true)
    RETURNING id INTO v_pipeline_id;

    INSERT INTO crm_stages (pipeline_id, nome, cor, posicao) VALUES
    (v_pipeline_id, 'Novo Lead', '#6366f1', 0),
    (v_pipeline_id, 'Em Contato', '#f59e0b', 1),
    (v_pipeline_id, 'Visita Agendada', '#3b82f6', 2),
    (v_pipeline_id, 'Visita Realizada', '#8b5cf6', 3),
    (v_pipeline_id, 'Proposta Enviada', '#ec4899', 4),
    (v_pipeline_id, 'Negociação', '#f97316', 5),
    (v_pipeline_id, 'Fechado (Ganho)', '#22c55e', 6),
    (v_pipeline_id, 'Perdido', '#ef4444', 7);
END $$;
