-- Initial Data Migration
-- This migration inserts essential initial data for development

-- Insert default system settings
INSERT INTO public.system_settings (key, value, description) VALUES
('lead_distribution_enabled', 'true', 'Habilita distribuição automática de leads'),
('max_leads_per_corretor', '10', 'Máximo de leads ativos por corretor'),
('lead_response_timeout_minutes', '30', 'Tempo limite para resposta do corretor em minutos'),
('whatsapp_integration_enabled', 'false', 'Habilita integração com WhatsApp'),
('email_notifications_enabled', 'true', 'Habilita notificações por email'),
('wordpress_sync_enabled', 'false', 'Habilita sincronização com WordPress'),
('backup_retention_days', '30', 'Dias para retenção de backups automáticos'),
('audit_log_retention_days', '90', 'Dias para retenção de logs de auditoria');

-- Insert default bairros for Ceará
INSERT INTO public.bairros (nome, cidade, estado) VALUES
('Centro', 'Fortaleza', 'CE'),
('Aldeota', 'Fortaleza', 'CE'),
('Meireles', 'Fortaleza', 'CE'),
('Cocó', 'Fortaleza', 'CE'),
('Papicu', 'Fortaleza', 'CE'),
('Varjota', 'Fortaleza', 'CE'),
('Dionísio Torres', 'Fortaleza', 'CE'),
('Benfica', 'Fortaleza', 'CE'),
('Joaquim Távora', 'Fortaleza', 'CE'),
('Mucuripe', 'Fortaleza', 'CE'),
('Praia de Iracema', 'Fortaleza', 'CE'),
('Montese', 'Fortaleza', 'CE'),
('Parangaba', 'Fortaleza', 'CE'),
('Messejana', 'Fortaleza', 'CE'),
('Maracanaú', 'Maracanaú', 'CE'),
('Centro', 'Caucaia', 'CE'),
('Jurema', 'Caucaia', 'CE'),
('Cumbuco', 'Caucaia', 'CE'),
('Centro', 'Eusébio', 'CE'),
('Sapiranga', 'Eusébio', 'CE');

-- Insert sample construtoras
INSERT INTO public.construtoras (nome, descricao) VALUES
('Construtora A', 'Especializada em apartamentos de alto padrão'),
('Construtora B', 'Focada em empreendimentos populares'),
('Construtora C', 'Construção sustentável e inovadora'),
('Construtora D', 'Tradição em casas de luxo'),
('Construtora E', 'Empreendimentos comerciais e residenciais');

-- Insert default report templates (only if admin user exists)
-- Note: These inserts will only work if the admin user profile already exists
-- They are safe to run as they will simply be ignored if the profile doesn't exist

DO $$
DECLARE
    admin_profile_id uuid;
BEGIN
    -- Try to get admin profile ID
    SELECT id INTO admin_profile_id 
    FROM public.profiles 
    WHERE user_id = (
        SELECT id FROM auth.users 
        WHERE email = 'reno@re9.online' 
        LIMIT 1
    ) 
    LIMIT 1;
    
    -- Only insert if admin profile exists
    IF admin_profile_id IS NOT NULL THEN
        INSERT INTO public.report_templates (name, description, template_config, category, is_public, created_by) VALUES
        ('Relatório de Vendas Mensais', 'Relatório padrão de vendas do mês', 
        '{"fields": ["leads", "visitas", "vendas"], "period": "monthly", "charts": ["bar", "line"]}', 
        'vendas', true, admin_profile_id),

        ('Performance de Corretores', 'Relatório de performance individual dos corretores',
        '{"fields": ["corretor", "leads_recebidos", "visitas_realizadas", "conversoes"], "period": "weekly", "charts": ["pie", "bar"]}',
        'corretores', true, admin_profile_id),

        ('Relatório de Empreendimentos', 'Relatório de performance dos empreendimentos',
        '{"fields": ["empreendimento", "leads_gerados", "visitas", "vendas"], "period": "monthly", "charts": ["table", "bar"]}',
        'empreendimentos', true, admin_profile_id);
    END IF;
END $$;