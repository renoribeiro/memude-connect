-- Row Level Security Policies Migration
-- This migration creates all RLS policies for data access control

-- Audit Logs Policies
CREATE POLICY "Admin users can view all audit logs" ON public.audit_logs
FOR SELECT USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
FOR SELECT USING ((get_current_user_role() = 'admin'::text) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.id = audit_logs.user_id)))));

-- Bairros Policies
CREATE POLICY "Admin users can manage bairros" ON public.bairros
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "All authenticated users can read bairros" ON public.bairros
FOR SELECT USING (auth.role() = 'authenticated'::text);

-- Communication Log Policies
CREATE POLICY "Admin users can manage all communication_log" ON public.communication_log
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "Corretores can view their communication logs" ON public.communication_log
FOR SELECT USING (EXISTS ( SELECT 1
   FROM (profiles p
     JOIN corretores c ON ((c.profile_id = p.id)))
  WHERE ((p.user_id = auth.uid()) AND (c.id = communication_log.corretor_id))));

-- Construtoras Policies
CREATE POLICY "Admin users can manage construtoras" ON public.construtoras
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "All authenticated users can read construtoras" ON public.construtoras
FOR SELECT USING (auth.role() = 'authenticated'::text);

-- Corretor Bairros Policies
CREATE POLICY "Admin users can manage corretor_bairros" ON public.corretor_bairros
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "Corretores can view their own bairros" ON public.corretor_bairros
FOR SELECT USING (EXISTS ( SELECT 1
   FROM (profiles p
     JOIN corretores c ON ((c.profile_id = p.id)))
  WHERE ((p.user_id = auth.uid()) AND (c.id = corretor_bairros.corretor_id))));

-- Corretor Construtoras Policies
CREATE POLICY "Admin users can manage corretor_construtoras" ON public.corretor_construtoras
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "Corretores can view their own construtoras" ON public.corretor_construtoras
FOR SELECT USING (EXISTS ( SELECT 1
   FROM (profiles p
     JOIN corretores c ON ((c.profile_id = p.id)))
  WHERE ((p.user_id = auth.uid()) AND (c.id = corretor_construtoras.corretor_id))));

-- Corretores Policies
CREATE POLICY "Admin users can manage all corretores" ON public.corretores
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "Corretores can view their own data" ON public.corretores
FOR SELECT USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.id = corretores.profile_id))));

CREATE POLICY "Corretores can update their own data" ON public.corretores
FOR UPDATE USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.id = corretores.profile_id))));

-- Empreendimentos Policies
CREATE POLICY "Admin users can manage empreendimentos" ON public.empreendimentos
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "All authenticated users can read empreendimentos" ON public.empreendimentos
FOR SELECT USING (auth.role() = 'authenticated'::text);

-- Lead Distribution Log Policies
CREATE POLICY "Admin users can manage lead_distribution_log" ON public.lead_distribution_log
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "Corretores can view their distribution logs" ON public.lead_distribution_log
FOR SELECT USING (EXISTS ( SELECT 1
   FROM (profiles p
     JOIN corretores c ON ((c.profile_id = p.id)))
  WHERE ((p.user_id = auth.uid()) AND (c.id = lead_distribution_log.corretor_id))));

-- Leads Policies
CREATE POLICY "Admin users can manage all leads" ON public.leads
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "Corretores can view assigned leads" ON public.leads
FOR SELECT USING (EXISTS ( SELECT 1
   FROM (profiles p
     JOIN corretores c ON ((c.profile_id = p.id)))
  WHERE ((p.user_id = auth.uid()) AND (c.id = leads.corretor_designado_id))));

-- Profiles Policies
CREATE POLICY "Admin users can view all profiles" ON public.profiles
FOR SELECT USING ((auth.email() = 'reno@re9.online'::text) OR (auth.uid() = user_id));

CREATE POLICY "Admin users can update all profiles" ON public.profiles
FOR UPDATE USING ((auth.email() = 'reno@re9.online'::text) OR (auth.uid() = user_id));

CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow profile creation on signup" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Report Templates Policies
CREATE POLICY "Admin users can manage all templates" ON public.report_templates
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "Users can view public templates or their own templates" ON public.report_templates
FOR SELECT USING ((is_public = true) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.id = report_templates.created_by)))));

CREATE POLICY "Users can create their own templates" ON public.report_templates
FOR INSERT WITH CHECK (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.id = report_templates.created_by))));

CREATE POLICY "Users can update their own templates" ON public.report_templates
FOR UPDATE USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.id = report_templates.created_by))));

-- Scheduled Reports Policies
CREATE POLICY "Admin users can manage all scheduled reports" ON public.scheduled_reports
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "Users can view their own scheduled reports" ON public.scheduled_reports
FOR SELECT USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.id = scheduled_reports.created_by))));

CREATE POLICY "Users can create their own scheduled reports" ON public.scheduled_reports
FOR INSERT WITH CHECK (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.id = scheduled_reports.created_by))));

CREATE POLICY "Users can update their own scheduled reports" ON public.scheduled_reports
FOR UPDATE USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.id = scheduled_reports.created_by))));

-- System Settings Policies
CREATE POLICY "Admin users can manage system settings" ON public.system_settings
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

-- Visitas Policies
CREATE POLICY "Admin users can manage all visitas" ON public.visitas
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "Corretores can view their own visitas" ON public.visitas
FOR SELECT USING (EXISTS ( SELECT 1
   FROM (profiles p
     JOIN corretores c ON ((c.profile_id = p.id)))
  WHERE ((p.user_id = auth.uid()) AND (c.id = visitas.corretor_id))));

CREATE POLICY "Corretores can update their own visitas" ON public.visitas
FOR UPDATE USING (EXISTS ( SELECT 1
   FROM (profiles p
     JOIN corretores c ON ((c.profile_id = p.id)))
  WHERE ((p.user_id = auth.uid()) AND (c.id = visitas.corretor_id))));

-- WordPress Sync Policies
CREATE POLICY "Admin users can manage wp_sync_log" ON public.wp_sync_log
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "Admin users can manage wp_sync_performance" ON public.wp_sync_performance
FOR ALL USING (auth.email() = 'reno@re9.online'::text);

CREATE POLICY "Admin users can manage wp_categories_cache" ON public.wp_categories_cache
FOR ALL USING (auth.email() = 'reno@re9.online'::text);