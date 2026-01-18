-- Create evolution_instances table
CREATE TABLE IF NOT EXISTS evolution_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- Friendly name (e.g., "Marketing Instance")
    instance_name TEXT NOT NULL, -- Actual Evolution instance name
    api_url TEXT NOT NULL,
    api_token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Add RLS policies for evolution_instances
ALTER TABLE evolution_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users"
    ON evolution_instances FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow write access to admins"
    ON evolution_instances FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Add evolution_instance_id to ai_agents
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS evolution_instance_id UUID REFERENCES evolution_instances(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_ai_agents_evolution_instance ON ai_agents(evolution_instance_id);

-- Trigger to update updated_at
CREATE TRIGGER update_evolution_instances_updated_at
    BEFORE UPDATE ON evolution_instances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
