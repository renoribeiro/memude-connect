-- Fix security issues identified by linter

-- RLS Policies for missing tables
-- corretor_bairros
CREATE POLICY "Admins can manage corretor_bairros" ON corretor_bairros
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Corretores can view their own bairros" ON corretor_bairros
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN corretores c ON c.profile_id = p.id
            WHERE p.user_id = auth.uid() 
            AND c.id = corretor_bairros.corretor_id
        )
    );

-- corretor_construtoras  
CREATE POLICY "Admins can manage corretor_construtoras" ON corretor_construtoras
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Corretores can view their own construtoras" ON corretor_construtoras
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN corretores c ON c.profile_id = p.id
            WHERE p.user_id = auth.uid() 
            AND c.id = corretor_construtoras.corretor_id
        )
    );

-- lead_distribution_log
CREATE POLICY "Admins can manage lead_distribution_log" ON lead_distribution_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Corretores can view their distribution logs" ON lead_distribution_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN corretores c ON c.profile_id = p.id
            WHERE p.user_id = auth.uid() 
            AND c.id = lead_distribution_log.corretor_id
        )
    );

-- visitas
CREATE POLICY "Admins can manage all visitas" ON visitas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Corretores can view their own visitas" ON visitas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN corretores c ON c.profile_id = p.id
            WHERE p.user_id = auth.uid() 
            AND c.id = visitas.corretor_id
        )
    );

CREATE POLICY "Corretores can update their own visitas" ON visitas
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN corretores c ON c.profile_id = p.id
            WHERE p.user_id = auth.uid() 
            AND c.id = visitas.corretor_id
        )
    );

-- communication_log
CREATE POLICY "Admins can manage all communication_log" ON communication_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Corretores can view their communication logs" ON communication_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN corretores c ON c.profile_id = p.id
            WHERE p.user_id = auth.uid() 
            AND c.id = communication_log.corretor_id
        )
    );

-- Fix function security issue - recreate with proper search_path
DROP FUNCTION IF EXISTS update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;