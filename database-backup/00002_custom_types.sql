-- Custom Types Migration
-- This migration creates all custom enum types used in the application

-- Communication type enum
CREATE TYPE public.communication_type AS ENUM (
    'whatsapp',
    'email',
    'sms',
    'call'
);

-- Corretor status enum
CREATE TYPE public.corretor_status AS ENUM (
    'ativo',
    'inativo',
    'em_avaliacao',
    'suspenso'
);

-- Estado Brasil enum
CREATE TYPE public.estado_brasil_enum AS ENUM (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
);

-- Lead status enum
CREATE TYPE public.lead_status AS ENUM (
    'novo',
    'em_contato',
    'agendado',
    'visitou',
    'negociando',
    'vendido',
    'perdido',
    'sem_interesse'
);

-- Tipo de imóvel enum
CREATE TYPE public.tipo_imovel_enum AS ENUM (
    'apartamento',
    'casa',
    'terreno',
    'comercial',
    'todos'
);

-- User role enum
CREATE TYPE public.user_role AS ENUM (
    'admin',
    'corretor',
    'cliente'
);