-- FASE 1: ESTRUTURA DE DADOS - Sistema de Templates de Comunicação

-- Criar enum para categorias de template
CREATE TYPE public.template_category AS ENUM (
    'lead_distribution',
    'visit_confirmation', 
    'visit_reminder',
    'follow_up',
    'welcome',
    'admin_notification',
    'custom'
);

-- Criar enum para tipos de comunicação
CREATE TYPE public.communication_channel AS ENUM (
    'whatsapp',
    'sms', 
    'email',
    'sistema'
);

-- Criar enum para tipos de dados das variáveis
CREATE TYPE public.variable_data_type AS ENUM (
    'text',
    'date',
    'time', 
    'number',
    'boolean'
);

-- Tabela principal de templates
CREATE TABLE public.message_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category template_category NOT NULL,
    type communication_channel NOT NULL,
    subject TEXT, -- Para emails
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb, -- Variáveis disponíveis no template
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false, -- Templates do sistema vs customizados
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de variáveis disponíveis
CREATE TABLE public.template_variables (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL, -- Nome da variável como {nome}
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    data_type variable_data_type NOT NULL,
    default_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_variables ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para message_templates
CREATE POLICY "Admin users can manage all templates" 
ON public.message_templates 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

CREATE POLICY "All authenticated users can read templates" 
ON public.message_templates 
FOR SELECT 
USING (auth.role() = 'authenticated' AND is_active = true);

-- Políticas RLS para template_variables
CREATE POLICY "Admin users can manage all variables" 
ON public.template_variables 
FOR ALL 
USING (auth.email() = 'reno@re9.online');

CREATE POLICY "All authenticated users can read variables" 
ON public.template_variables 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Trigger para atualizar updated_at
CREATE TRIGGER update_message_templates_updated_at
    BEFORE UPDATE ON public.message_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir variáveis padrão do sistema
INSERT INTO public.template_variables (name, description, category, data_type, default_value) VALUES
-- Variáveis de Lead
('{nome_lead}', 'Nome do cliente interessado', 'lead', 'text', 'Cliente'),
('{telefone_lead}', 'Telefone do cliente', 'lead', 'text', '(85) 99999-9999'),
('{email_lead}', 'Email do cliente', 'lead', 'text', 'cliente@email.com'),
('{data_visita}', 'Data da visita solicitada', 'lead', 'date', ''),
('{horario_visita}', 'Horário da visita solicitada', 'lead', 'time', ''),

-- Variáveis de Empreendimento
('{nome_empreendimento}', 'Nome do empreendimento', 'empreendimento', 'text', 'Residencial Example'),
('{endereco_empreendimento}', 'Endereço do empreendimento', 'empreendimento', 'text', 'Rua Example, 123'),
('{construtora}', 'Nome da construtora', 'empreendimento', 'text', 'Construtora ABC'),
('{valor_min}', 'Valor mínimo do imóvel', 'empreendimento', 'number', 'R$ 200.000'),
('{valor_max}', 'Valor máximo do imóvel', 'empreendimento', 'number', 'R$ 350.000'),

-- Variáveis de Corretor
('{nome_corretor}', 'Nome do corretor responsável', 'corretor', 'text', 'João Silva'),
('{whatsapp_corretor}', 'WhatsApp do corretor', 'corretor', 'text', '(85) 99888-7777'),
('{creci_corretor}', 'CRECI do corretor', 'corretor', 'text', 'CRECI 12345'),

-- Variáveis de Sistema
('{data_atual}', 'Data atual do sistema', 'sistema', 'date', ''),
('{hora_atual}', 'Hora atual do sistema', 'sistema', 'time', ''),
('{empresa}', 'Nome da empresa', 'sistema', 'text', 'Memude Imóveis'),

-- Variáveis de Visita
('{status_visita}', 'Status da visita', 'visita', 'text', 'Agendada'),
('{feedback_visita}', 'Feedback da visita', 'visita', 'text', ''),
('{avaliacao_visita}', 'Avaliação da visita (1-5)', 'visita', 'number', '5');

-- Inserir templates padrão do sistema
INSERT INTO public.message_templates (name, category, type, content, is_system, variables) VALUES
-- Templates de Distribuição de Leads
('Distribuição de Lead - Bairro', 'lead_distribution', 'whatsapp', 
'🏠 *NOVO LEAD - MATCH PERFEITO!* 🎯

Cliente: *{nome_lead}*
📱 WhatsApp: {telefone_lead}
📅 Visita: {data_visita} às {horario_visita}

🏢 *{nome_empreendimento}*
📍 {endereco_empreendimento}
🏗️ Construtora: {construtora}
💰 Valores: {valor_min} - {valor_max}

✅ *MATCH POR BAIRRO* - Cliente do seu território!

⏰ *Você tem 15 minutos para responder*
📲 Responda SIM para aceitar o lead', 
true, '["nome_lead", "telefone_lead", "data_visita", "horario_visita", "nome_empreendimento", "endereco_empreendimento", "construtora", "valor_min", "valor_max"]'),

('Distribuição de Lead - Construtora', 'lead_distribution', 'whatsapp',
'🏠 *NOVO LEAD DISPONÍVEL* 🎯

Cliente: *{nome_lead}*
📱 WhatsApp: {telefone_lead}
📅 Visita: {data_visita} às {horario_visita}

🏢 *{nome_empreendimento}*
📍 {endereco_empreendimento}  
🏗️ Construtora: {construtora}
💰 Valores: {valor_min} - {valor_max}

✅ *MATCH POR CONSTRUTORA* - Sua especialidade!

⏰ *Você tem 15 minutos para responder*
📲 Responda SIM para aceitar o lead',
true, '["nome_lead", "telefone_lead", "data_visita", "horario_visita", "nome_empreendimento", "endereco_empreendimento", "construtora", "valor_min", "valor_max"]'),

-- Templates de Confirmação
('Confirmação de Visita', 'visit_confirmation', 'whatsapp',
'✅ *VISITA CONFIRMADA!*

Olá {nome_lead}! 

Sua visita ao *{nome_empreendimento}* foi confirmada:

📅 Data: {data_visita}
🕐 Horário: {horario_visita}
📍 Local: {endereco_empreendimento}

👤 Corretor responsável: *{nome_corretor}*
📱 WhatsApp: {whatsapp_corretor}
🏅 CRECI: {creci_corretor}

Nos vemos lá! 🏠✨',
true, '["nome_lead", "nome_empreendimento", "data_visita", "horario_visita", "endereco_empreendimento", "nome_corretor", "whatsapp_corretor", "creci_corretor"]'),

-- Templates de Lembrete
('Lembrete de Visita', 'visit_reminder', 'whatsapp',
'⏰ *LEMBRETE DE VISITA*

Olá {nome_lead}!

Lembrando que sua visita ao *{nome_empreendimento}* é:

🗓️ AMANHÃ - {data_visita}
🕐 Às {horario_visita}
📍 {endereco_empreendimento}

👤 Corretor: {nome_corretor}
📱 Contato: {whatsapp_corretor}

Até amanhã! 🏠',
true, '["nome_lead", "nome_empreendimento", "data_visita", "horario_visita", "endereco_empreendimento", "nome_corretor", "whatsapp_corretor"]'),

-- Template de Boas-vindas
('Boas-vindas Corretor', 'welcome', 'whatsapp',
'🎉 *BEM-VINDO À {empresa}!*

Olá {nome_corretor}!

Parabéns! Seu cadastro foi aprovado e você já pode começar a receber leads.

📋 Seus dados:
• CRECI: {creci_corretor}
• WhatsApp: {whatsapp_corretor}

✅ *Próximos passos:*
1. Mantenha seu WhatsApp sempre ativo
2. Responda aos leads em até 15 minutos
3. Acompanhe suas visitas pelo sistema

Sucesso! 🚀',
true, '["empresa", "nome_corretor", "creci_corretor", "whatsapp_corretor"]'),

-- Template de Notificação Admin
('Notificação Admin - Lead sem Corretor', 'admin_notification', 'whatsapp',
'🚨 *ALERTA ADMINISTRATIVO*

Lead *{nome_lead}* não foi aceito por nenhum corretor.

📱 Cliente: {telefone_lead}
🏢 Empreendimento: {nome_empreendimento}
📅 Visita solicitada: {data_visita} às {horario_visita}

⚠️ *Ação necessária:* Designar corretor manualmente

🕐 Timestamp: {data_atual} {hora_atual}',
true, '["nome_lead", "telefone_lead", "nome_empreendimento", "data_visita", "horario_visita", "data_atual", "hora_atual"]');