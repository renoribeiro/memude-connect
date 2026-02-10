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

    // Log completo do payload para debug
    console.log('📨 Webhook FULL payload:', JSON.stringify(webhookData).substring(0, 2000));

    // Comparação case-insensitive para evento (Evolution API pode enviar MESSAGES_UPSERT ou messages.upsert)
    const eventLower = (event || '').toLowerCase().replace('.', '_');

    if (eventLower === 'messages_upsert') {
      // Evolution API V2 pode ter estruturas diferentes
      const messageData = data?.message || data;

      // Tentar extrair phone de várias formas
      let phone = messageData?.key?.remoteJid?.replace('@s.whatsapp.net', '') ||
        data?.key?.remoteJid?.replace('@s.whatsapp.net', '');

      // Em grupos, pegar o participante
      if (phone?.includes('@g.us')) {
        phone = messageData?.key?.participant?.replace('@s.whatsapp.net', '') ||
          messageData?.key?.participantAlt?.replace('@s.whatsapp.net', '');
      }

      // Extrair texto de várias formas possíveis (Iterar sobre possíveis locais do conteúdo)
      // O conteúdo pode estar em data.message (direto) ou data.message.message (aninhado)
      let text = '';

      const possibleContentObjects = [
        data?.message?.message, // Estrutura WebMessageInfo padrão
        data?.message,          // Estrutura simplificada ou direta
        data                    // Fallback
      ];

      for (const msgContent of possibleContentObjects) {
        if (!msgContent) continue;

        const extracted = msgContent.conversation ||
          msgContent.extendedTextMessage?.text ||
          msgContent.buttonsResponseMessage?.selectedButtonId ||
          msgContent.listResponseMessage?.singleSelectReply?.selectedRowId ||
          msgContent.templateButtonReplyMessage?.selectedId;

        if (extracted) {
          text = extracted;
          console.log('✅ Texto encontrado em nível de objeto:', Object.keys(msgContent));
          break;
        }
      }

      // Log detalhado
      const fromMe = messageData?.key?.fromMe || data?.key?.fromMe;
      console.log(`📱 Dados extraídos: phone=${phone}, text="${text}", fromMe=${fromMe}`);

      // Log estrutura para garantir
      console.log('📋 Estrutura analisada:', JSON.stringify({
        hasDataMessage: !!data?.message,
        hasDataMessageMessage: !!data?.message?.message,
        hasConversationDirect: !!data?.message?.conversation,
        hasConversationNested: !!data?.message?.message?.conversation
      }));

      if (phone && text && !fromMe) {
        console.log(`Webhook Evolution: Recebido de ${phone}: ${text}`);

        // Extract sender name (pushName) from webhook payload (BUG-03 fix)
        const senderName = messageData?.pushName || data?.pushName || null;

        // ============================================
        // FASE 1: Verificar se há agente de IA ativo
        // ============================================
        const aiHandled = await tryAIAgentProcessing(supabase, phone, text, senderName);

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

        // Log no banco para debug
        await supabase.from('webhook_logs').insert({
          event_type: 'DISTRIBUTION_RESPONSE',
          instance_name: webhookData?.instance || 'unknown',
          payload: { phone, text, result },
          processed_successfully: result.processed,
          processing_time_ms: 0
        });
      } else {
        console.log(`⚠️ Mensagem ignorada: phone=${phone}, text="${text}", fromMe=${messageData?.key?.fromMe}`);

        // Log no banco para debug - incluir estrutura completa para análise
        await supabase.from('webhook_logs').insert({
          event_type: 'MESSAGE_IGNORED',
          instance_name: webhookData?.instance || 'unknown',
          payload: {
            phone,
            text,
            fromMe: messageData?.key?.fromMe,
            reason: !phone ? 'no_phone' : !text ? 'no_text' : 'from_me',
            messageKeys: Object.keys(messageData?.message || {}),
            dataKeys: Object.keys(data || {}),
            fullData: JSON.stringify(data).substring(0, 1000)
          },
          processed_successfully: false,
          processing_time_ms: 0
        });
      }
    } else {
      console.log(`⏭️ Evento ignorado: ${event}`);

      // Log no banco para debug
      await supabase.from('webhook_logs').insert({
        event_type: event || 'UNKNOWN',
        instance_name: webhookData?.instance || 'unknown',
        payload: { event, ignored: true },
        processed_successfully: false,
        processing_time_ms: 0
      });
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
  text: string,
  senderName?: string | null
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

    // BUG-06 fix: Check if lead was recently transferred to human — don't reactivate AI
    const { data: transferredConv } = await supabase
      .from('agent_conversations')
      .select('id, status')
      .eq('phone_number', phone)
      .eq('status', 'transferred')
      .gte('last_message_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (transferredConv) {
      console.log('🚫 Lead está em atendimento humano (transferido há menos de 24h), ignorando AI');
      return false;
    }

    // 4. Invocar o processador de AI
    const { data: aiResult, error: aiError } = await supabase.functions.invoke(
      'ai-agent-processor',
      {
        body: {
          phone_number: phone,
          message_text: text,
          sender_name: senderName || null
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