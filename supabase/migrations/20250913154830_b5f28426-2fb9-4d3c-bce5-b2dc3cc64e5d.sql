-- Mover extensões para schema apropriado se disponível
DROP EXTENSION IF EXISTS pg_cron;
DROP EXTENSION IF EXISTS pg_net;

-- Criar schema extensions se não existir
CREATE SCHEMA IF NOT EXISTS extensions;

-- Recriar extensões no schema extensions
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;