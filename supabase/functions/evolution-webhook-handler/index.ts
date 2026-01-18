import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processIncomingMessage } from '../_shared/distribution-logic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const webhookData = await req.json();
    const { event, data } = webhookData;

    if (event === 'MESSAGES_UPSERT') {
      const message = data.message || data;
      const phone = message.key?.remoteJid?.replace('@s.whatsapp.net', '');

      // Extrair texto (suporte V2)
      let text = message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.buttonsResponseMessage?.selectedButtonId || '';

      if (!text && message.message?.listResponseMessage) {
        text = message.message.listResponseMessage.singleSelectReply.selectedRowId;
      }

      if (phone && text && !message.key.fromMe) {
        console.log(`Webhook Evolution: Recebido de ${phone}: ${text}`);

        // ============================================
        // FASE 1: Verificar se há agente de IA ativo
        // ============================================
        const aiHandled = await tryAIAgentProcessing(supabase, phone, text);

        if (aiHandled) {
          console.log('✅ Mensagem processada pelo AI Agent');
          return new Response(
            JSON.stringify({ success: true, ai_handled: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ============================================
        // FASE 2: Fallback para lógica original (SIM/NÃO)
        // ============================================
        console.log('📋 Processando com lógica de distribuição original...');
        const result = await processIncomingMessage(supabase, phone, text);
        console.log('Resultado processamento:', result);
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

/**
 * Tenta processar a mensagem com um agente de IA
 * Retorna true se a mensagem foi processada pelo AI, false caso contrário
 */
async function tryAIAgentProcessing(
  supabase: any,
  phone: string,
  text: string
): Promise<boolean> {
  try {
    // 1. Verificar se há agente ativo
    const { data: activeAgent, error: agentError } = await supabase
      .from('ai_agents')
      .select('id, trigger_keywords')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (agentError || !activeAgent) {
      console.log('🤖 Nenhum agente de IA ativo');
      return false;
    }

    // 2. Verificar se há conversa ativa com este telefone
    const { data: existingConversation } = await supabase
      .from('agent_conversations')
      .select('id, status')
      .eq('phone_number', phone)
      .eq('status', 'active')
      .maybeSingle();

    // 3. Se não há conversa ativa, verificar se a mensagem contém keywords de trigger
    if (!existingConversation) {
      const keywords = activeAgent.trigger_keywords || [];
      const textLower = text.toLowerCase();
      const hasKeyword = keywords.some((kw: string) => textLower.includes(kw.toLowerCase()));

      if (!hasKeyword) {
        console.log('🤖 Nenhuma keyword de trigger encontrada, usando fluxo original');
        return false;
      }

      console.log('🤖 Keyword de trigger detectada, iniciando conversa com AI');
    } else {
      console.log(`🤖 Conversa ativa encontrada: ${existingConversation.id}`);
    }

    // 4. Invocar o processador de AI
    const { data: aiResult, error: aiError } = await supabase.functions.invoke(
      'ai-agent-processor',
      {
        body: {
          phone_number: phone,
          message_text: text
        }
      }
    );

    if (aiError) {
      console.error('❌ Erro ao invocar AI Agent:', aiError);
      return false;
    }

    return aiResult?.handled === true;

  } catch (error) {
    console.error('❌ Erro no tryAIAgentProcessing:', error);
    return false;
  }
}