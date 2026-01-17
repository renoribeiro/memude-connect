-- Initial Schema Migration
-- This migration creates all the main tables for the application

-- Create audit_logs table
CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    table_name text NOT NULL,
    action text NOT NULL,
    record_id uuid,
    old_values jsonb,
    new_values jsonb,
    user_id uuid,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create bairros table
CREATE TABLE public.bairros (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    nome text NOT NULL,
    cidade text NOT NULL,
    estado text DEFAULT 'CE'::text NOT NULL,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Create construtoras table
CREATE TABLE public.construtoras (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    nome text NOT NULL,
    descricao text,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    avatar_url text,
    phone text,
    role user_role DEFAULT 'cliente'::user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create corretores table
CREATE TABLE public.corretores (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    profile_id uuid NOT NULL,
    creci text NOT NULL,
    whatsapp text NOT NULL,
    cpf text,
    email text,
    telefone text,
    cidade text,
    estado estado_brasil_enum DEFAULT 'CE'::estado_brasil_enum,
    tipo_imovel tipo_imovel_enum DEFAULT 'todos'::tipo_imovel_enum,
    observacoes text,
    status corretor_status DEFAULT 'em_avaliacao'::corretor_status,
    nota_media numeric DEFAULT 0,
    total_visitas integer DEFAULT 0,
    data_avaliacao date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create empreendimentos table
CREATE TABLE public.empreendimentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    nome text NOT NULL,
    descricao text,
    endereco text,
    bairro_id uuid,
    construtora_id uuid,
    valor_min numeric,
    valor_max numeric,
    wp_post_id integer,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create leads table
CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    nome text NOT NULL,
    telefone text NOT NULL,
    email text,
    empreendimento_id uuid,
    data_visita_solicitada date NOT NULL,
    horario_visita_solicitada time without time zone NOT NULL,
    observacoes text,
    status lead_status DEFAULT 'novo'::lead_status,
    corretor_designado_id uuid,
    origem text DEFAULT 'website'::text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create visitas table
CREATE TABLE public.visitas (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    lead_id uuid NOT NULL,
    corretor_id uuid,
    empreendimento_id uuid,
    data_visita date NOT NULL,
    horario_visita time without time zone NOT NULL,
    status text DEFAULT 'agendada'::text,
    feedback_corretor text,
    comentarios_lead text,
    avaliacao_lead integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create communication_log table
CREATE TABLE public.communication_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    type communication_type NOT NULL,
    direction text NOT NULL,
    content text NOT NULL,
    phone_number text,
    lead_id uuid,
    corretor_id uuid,
    message_id text,
    status text DEFAULT 'pending'::text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Create lead_distribution_log table
CREATE TABLE public.lead_distribution_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    lead_id uuid,
    corretor_id uuid,
    ordem_prioridade integer NOT NULL,
    data_envio timestamp with time zone DEFAULT now(),
    data_resposta timestamp with time zone,
    resposta text,
    tempo_resposta_minutos integer,
    created_at timestamp with time zone DEFAULT now()
);

-- Create corretor_bairros table
CREATE TABLE public.corretor_bairros (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    corretor_id uuid,
    bairro_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- Create corretor_construtoras table
CREATE TABLE public.corretor_construtoras (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    corretor_id uuid,
    construtora_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- Create system_settings table
CREATE TABLE public.system_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    key text NOT NULL,
    value text NOT NULL,
    description text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);

-- Create report_templates table
CREATE TABLE public.report_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name text NOT NULL,
    description text,
    template_config jsonb NOT NULL,
    category text DEFAULT 'custom'::text NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create scheduled_reports table
CREATE TABLE public.scheduled_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    report_template_id uuid NOT NULL,
    schedule_type text NOT NULL,
    recipients jsonb NOT NULL,
    email_subject text NOT NULL,
    email_message text,
    next_run timestamp with time zone NOT NULL,
    last_run timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create WordPress sync tables
CREATE TABLE public.wp_sync_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    sync_date timestamp with time zone DEFAULT now(),
    status text DEFAULT 'success'::text NOT NULL,
    total_posts_fetched integer DEFAULT 0 NOT NULL,
    new_empreendimentos integer DEFAULT 0 NOT NULL,
    updated_empreendimentos integer DEFAULT 0 NOT NULL,
    errors_count integer DEFAULT 0 NOT NULL,
    last_wp_post_id integer,
    sync_duration_ms integer,
    error_details jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.wp_sync_performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    sync_log_id uuid,
    operation_type text NOT NULL,
    operation_start timestamp with time zone DEFAULT now() NOT NULL,
    operation_end timestamp with time zone,
    duration_ms integer,
    post_id integer,
    empreendimento_id uuid,
    success boolean DEFAULT true,
    error_message text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.wp_categories_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    wp_category_id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    parent integer DEFAULT 0,
    cached_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construtoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corretor_bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corretor_construtoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corretores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empreendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_distribution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wp_categories_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wp_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wp_sync_performance ENABLE ROW LEVEL SECURITY;