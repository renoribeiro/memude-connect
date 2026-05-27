-- Migration to add admin-configurable human transfer variables to ai_agents
ALTER TABLE "public"."ai_agents" 
ADD COLUMN IF NOT EXISTS "transfer_on_frustration" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "transfer_on_unclear" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "transfer_on_request" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "transfer_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "transfer_message" TEXT DEFAULT 'Entendi perfeitamente. Vou passar sua conversa agora mesmo para um consultor especializado que irá te dar continuidade no atendimento! 🤝',
ADD COLUMN IF NOT EXISTS "max_unclear_attempts" INTEGER DEFAULT 3;

COMMENT ON COLUMN "public"."ai_agents"."transfer_on_frustration" IS 'Habilita a transferência automática quando o lead demonstra frustração';
COMMENT ON COLUMN "public"."ai_agents"."transfer_on_unclear" IS 'Habilita a transferência automática quando o agente de IA não compreende a intenção por várias mensagens';
COMMENT ON COLUMN "public"."ai_agents"."transfer_on_request" IS 'Habilita a transferência automática quando o lead solicita falar com um humano';
COMMENT ON COLUMN "public"."ai_agents"."transfer_keywords" IS 'Palavras-chave personalizadas cadastradas pelo administrador que forçam a transferência imediata';
COMMENT ON COLUMN "public"."ai_agents"."transfer_message" IS 'Mensagem de transição personalizada enviada ao lead antes da transferência para o humano';
COMMENT ON COLUMN "public"."ai_agents"."max_unclear_attempts" IS 'Número máximo de tentativas consecutivas sem entendimento antes de transferir';
