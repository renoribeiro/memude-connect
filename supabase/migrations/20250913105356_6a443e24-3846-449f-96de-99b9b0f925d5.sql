-- MeMude Connect Database Schema
-- Sistema de gestão de leads imobiliários estilo Uber

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. User Roles Enum
CREATE TYPE user_role AS ENUM ('admin', 'corretor', 'cliente');

-- 2. Lead Status Enum  
CREATE TYPE lead_status AS ENUM ('novo', 'buscando_corretor', 'corretor_designado', 'visita_agendada', 'visita_confirmada', 'visita_realizada', 'cancelado', 'follow_up');

-- 3. Corretor Status Enum
CREATE TYPE corretor_status AS ENUM ('em_avaliacao', 'ativo', 'inativo', 'bloqueado');

-- 4. Communication Type Enum
CREATE TYPE communication_type AS ENUM ('whatsapp', 'email', 'sms', 'sistema');

-- 5. User Profiles Table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'cliente',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Construtoras Table
CREATE TABLE construtoras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Bairros Table
CREATE TABLE bairros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cidade TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'CE',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(nome, cidade, estado)
);

-- 8. Empreendimentos Table
CREATE TABLE empreendimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    construtora_id UUID REFERENCES construtoras(id) ON DELETE SET NULL,
    bairro_id UUID REFERENCES bairros(id) ON DELETE SET NULL,
    endereco TEXT,
    descricao TEXT,
    valor_min DECIMAL(15,2),
    valor_max DECIMAL(15,2),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Corretores Table
CREATE TABLE corretores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    creci TEXT UNIQUE NOT NULL,
    cpf TEXT,
    status corretor_status DEFAULT 'em_avaliacao',
    nota_media DECIMAL(3,2) DEFAULT 0,
    total_visitas INTEGER DEFAULT 0,
    whatsapp TEXT NOT NULL,
    observacoes TEXT,
    data_avaliacao DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Corretor Bairros (Many-to-Many)
CREATE TABLE corretor_bairros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corretor_id UUID REFERENCES corretores(id) ON DELETE CASCADE,
    bairro_id UUID REFERENCES bairros(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(corretor_id, bairro_id)
);

-- 11. Corretor Construtoras (Many-to-Many)
CREATE TABLE corretor_construtoras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corretor_id UUID REFERENCES corretores(id) ON DELETE CASCADE,
    construtora_id UUID REFERENCES construtoras(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(corretor_id, construtora_id)
);

-- 12. Leads Table
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    email TEXT,
    empreendimento_id UUID REFERENCES empreendimentos(id) ON DELETE SET NULL,
    data_visita_solicitada DATE NOT NULL,
    horario_visita_solicitada TIME NOT NULL,
    status lead_status DEFAULT 'novo',
    corretor_designado_id UUID REFERENCES corretores(id) ON DELETE SET NULL,
    observacoes TEXT,
    origem TEXT DEFAULT 'website',
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Lead Distribution Log
CREATE TABLE lead_distribution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    corretor_id UUID REFERENCES corretores(id) ON DELETE CASCADE,
    ordem_prioridade INTEGER NOT NULL,
    data_envio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_resposta TIMESTAMP WITH TIME ZONE,
    resposta TEXT, -- 'aceito', 'recusado', 'timeout'
    tempo_resposta_minutos INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Visitas Table
CREATE TABLE visitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE UNIQUE NOT NULL,
    corretor_id UUID REFERENCES corretores(id) ON DELETE SET NULL,
    empreendimento_id UUID REFERENCES empreendimentos(id) ON DELETE SET NULL,
    data_visita DATE NOT NULL,
    horario_visita TIME NOT NULL,
    status TEXT DEFAULT 'agendada', -- agendada, confirmada, realizada, cancelada
    avaliacao_lead INTEGER CHECK (avaliacao_lead BETWEEN 1 AND 5),
    comentarios_lead TEXT,
    feedback_corretor TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Communication Log Table
CREATE TABLE communication_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    corretor_id UUID REFERENCES corretores(id) ON DELETE SET NULL,
    type communication_type NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('enviado', 'recebido')),
    content TEXT NOT NULL,
    phone_number TEXT,
    message_id TEXT, -- Para Evolution API
    status TEXT DEFAULT 'pending', -- pending, sent, delivered, read, failed
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. System Settings Table
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
('tempo_resposta_corretor_minutos', '15', 'Tempo limite para corretor responder em minutos'),
('max_corretores_tentativa', '5', 'Número máximo de corretores a consultar por lead'),
('whatsapp_template_consulta', 'Olá {nome_corretor}! Temos um cliente interessado no {empreendimento} no dia {data} às {hora}. Você tem disponibilidade? Responda SIM para aceitar.', 'Template de consulta via WhatsApp'),
('whatsapp_template_confirmacao', 'Perfeito! Sua visita ao {empreendimento} foi agendada para {data} às {hora}. Cliente: {nome_lead} - {telefone_lead}', 'Template de confirmação'),
('evolution_api_url', '', 'URL da API Evolution V2'),
('evolution_api_key', '', 'Chave da API Evolution'),
('evolution_instance_name', '', 'Nome da instância Evolution');

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE construtoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE empreendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE corretores ENABLE ROW LEVEL SECURITY;
ALTER TABLE corretor_bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE corretor_construtoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_distribution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Profiles
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Allow profile creation on signup" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for Leads (Admins full access, Corretores only their assigned leads)
CREATE POLICY "Admins can manage all leads" ON leads
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Corretores can view assigned leads" ON leads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN corretores c ON c.profile_id = p.id
            WHERE p.user_id = auth.uid() 
            AND c.id = leads.corretor_designado_id
        )
    );

-- RLS Policies for Corretores
CREATE POLICY "Admins can manage all corretores" ON corretores
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Corretores can view their own data" ON corretores
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND id = corretores.profile_id
        )
    );

CREATE POLICY "Corretores can update their own data" ON corretores
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND id = corretores.profile_id
        )
    );

-- RLS Policies for System Settings (Admin only)
CREATE POLICY "Only admins can manage system settings" ON system_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- RLS Policies for public read tables (but admin manage)
CREATE POLICY "All authenticated users can read construtoras" ON construtoras
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can manage construtoras" ON construtoras
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "All authenticated users can read bairros" ON bairros
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can manage bairros" ON bairros
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "All authenticated users can read empreendimentos" ON empreendimentos
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can manage empreendimentos" ON empreendimentos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_construtoras_updated_at BEFORE UPDATE ON construtoras
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_empreendimentos_updated_at BEFORE UPDATE ON empreendimentos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_corretores_updated_at BEFORE UPDATE ON corretores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visitas_updated_at BEFORE UPDATE ON visitas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_empreendimento ON leads(empreendimento_id);
CREATE INDEX idx_leads_corretor ON leads(corretor_designado_id);
CREATE INDEX idx_corretores_status ON corretores(status);
CREATE INDEX idx_corretores_profile ON corretores(profile_id);
CREATE INDEX idx_communication_log_lead ON communication_log(lead_id);
CREATE INDEX idx_visitas_lead ON visitas(lead_id);
CREATE INDEX idx_visitas_corretor ON visitas(corretor_id);

-- Insert some sample data
INSERT INTO construtoras (nome, descricao) VALUES 
('Cyrela', 'Construtora nacional focada em alto padrão'),
('MRV', 'Especializada em habitação popular e Minha Casa Minha Vida'),
('Tenda', 'Focada no segmento econômico'),
('Patriani', 'Construtora de Fortaleza especializada em lançamentos'),
('Diagonal', 'Construtora cearense de renome');

INSERT INTO bairros (nome, cidade, estado) VALUES
('Meireles', 'Fortaleza', 'CE'),
('Aldeota', 'Fortaleza', 'CE'), 
('Cocó', 'Fortaleza', 'CE'),
('Papicu', 'Fortaleza', 'CE'),
('Varjota', 'Fortaleza', 'CE'),
('Praia de Iracema', 'Fortaleza', 'CE'),
('Centro', 'Fortaleza', 'CE'),
('Messejana', 'Fortaleza', 'CE');

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Sistema')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();