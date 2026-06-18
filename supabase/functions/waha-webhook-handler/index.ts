import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processIncomingMessage } from '../_shared/distribution-logic.ts';
import { logIntegration } from '../_shared/integration-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, X-Api-Key, x-webhook-secret',
};

// In-memory dedup cache for WAHA events
const processedMessages = new Map<string, number>();
const DEDUP_TTL_MS = 60_000; // 60 seconds

function isDuplicate(messageId: string): boolean {
  const now = Date.now();
  for (const [key, ts] of processedMessages) {
    if (now - ts > DEDUP_TTL_MS) processedMessages.delete(key);
  }
  if (processedMessages.has(messageId)) return true;
  processedMessages.set(messageId, now);
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Webhook Security Validation (Opção A)
    const webhookSecret = req.headers.get('x-webhook-secret') || req.headers.get('X-Api-Key');
    const { data: secretSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'waha_api_key')
      .maybeSingle();

    if (secretSetting?.value) {
      if (!webhookSecret || webhookSecret !== secretSetting.value) {
        console.warn('🚫 WAHA Webhook authentication failed: invalid or missing secret');
        return new Response(
          JSON.stringify({ error: 'Unauthorized: missing or invalid secret' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const startTime = Date.now();
    const payload = await req.json();
    console.log('📨 Webhook WAHA FULL payload:', JSON.stringify(payload).substring(0, 2000));

    const event = payload.event;
    const data = payload.payload;

    if (!data) {
      return new Response(JSON.stringify({ success: true, message: 'No payload data found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Deduplication check
    const messageId = data.id || null;
    if (messageId && isDuplicate(messageId)) {
      console.log(`⏭️ Duplicate WAHA message skipped: ${messageId}`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'duplicate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (event === 'message.any' || event === 'message.upsert' || event === 'message.create') {
        // Ignorar mensagens enviadas pelo próprio bot
        if (data.fromMe) {
            return new Response(JSON.stringify({ status: 'ignored_fromMe' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const phone = data.from?.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@lid', '');
        
        // Extrair texto (selectedButtonId tem prioridade em botões interativos do WAHA)
        let text = data.selectedButtonId || data.body || '';
        
        // Se for resposta de botão legado ou estruturado
        if (data._data?.quotedMsg?.type === 'buttons_response') {
             text = data._data.quotedMsg.selectedButtonId || text; 
        }

        console.log(`📱 Dados WAHA extraídos: phone=${phone}, text="${text}"`);

        if (phone && text) {
            console.log(`Webhook WAHA: Recebido de ${phone}: ${text}`);
            const senderName = data.sender?.name || data.pushName || '';

            // ============================================
            // FASE 1: Verificar distribuição pendente PRIMEIRO (SIM/NÃO de corretores)
            // ============================================
            console.log('📋 Verificando lógica de distribuição...');
            const distributionResult = await processIncomingMessage(supabase, phone, text, senderName, data.from || '');
            console.log('Resultado distribuição:', distributionResult);

            if (distributionResult.processed) {
              console.log(`✅ Mensagem processada pela distribuição: action=${distributionResult.action}`);

              // Log no banco para debug
              await supabase.from('webhook_logs').insert({
                event_type: 'WAHA_DISTRIBUTION_RESPONSE',
                instance_name: 'waha_global',
                payload: { phone, text, result: distributionResult },
                processed_successfully: true,
                processing_time_ms: Date.now() - startTime
              });

              const respBody = { success: true, distribution_handled: true, action: distributionResult.action };
              await logIntegration(supabase, {
                service: 'waha-api',
                endpoint: 'webhook',
                method: 'POST',
                status_code: 200,
                request_payload: payload,
                response_body: respBody,
                duration_ms: Date.now() - startTime,
                metadata: { event, handled_by: 'distribution_logic' }
              });

              return new Response(
                JSON.stringify(respBody),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            // ============================================
            // FASE 2: Tentar qualificação BANT / Agente de IA
            // ============================================
            const aiHandled = await tryAIAgentProcessing(supabase, phone, text, senderName);

            if (aiHandled) {
              console.log('✅ Mensagem processada pelo AI Agent');
              const respBody = { success: true, ai_handled: true };
              await logIntegration(supabase, {
                service: 'waha-api',
                endpoint: 'webhook',
                method: 'POST',
                status_code: 200,
                request_payload: payload,
                response_body: respBody,
                duration_ms: Date.now() - startTime,
                metadata: { event, handled_by: 'ai_agent' }
              });

              return new Response(
                JSON.stringify(respBody),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            // ============================================
            // FASE 3: Sem processamento — Log para Auditoria
            // ============================================
            await supabase.from('webhook_logs').insert({
              event_type: 'WAHA_UNHANDLED_MESSAGE',
              instance_name: 'waha_global',
              payload: { phone, text },
              processed_successfully: false,
              processing_time_ms: Date.now() - startTime
            });
        }
    } else if (event === 'message.ack') {
        const messageId = data.id;
        const ackName = data.ackName;
        const ack = data.ack;

        console.log(`🔄 WAHA Status Update (Ack): Message ${messageId} -> Ack ${ack} (${ackName})`);

        const isFailed = ack === -1 || ackName === 'ERROR';

        if (isFailed && messageId) {
            // 1. Atualizar log de comunicação
            await supabase
              .from('communication_log')
              .update({
                status: 'failed',
                metadata: {
                  webhook_timestamp: new Date().toISOString(),
                  error_details: data
                }
              })
              .eq('message_id', messageId);

            // 2. Tentar redistribuir Lead
            const { data: leadAttempt } = await supabase
              .from('distribution_attempts')
              .select('id, lead_id')
              .eq('whatsapp_message_id', messageId)
              .eq('status', 'pending')
              .maybeSingle();

            if (leadAttempt) {
              console.log(`🚨 Falha de entrega WAHA na distribuição de LEAD ${leadAttempt.lead_id} (tentativa ${leadAttempt.id})`);
              
              await supabase
                .from('distribution_attempts')
                .update({
                  status: 'timeout',
                  response_message: 'Falha no envio da mensagem de WhatsApp via WAHA (número inválido ou erro)'
                })
                .eq('id', leadAttempt.id);

              try {
                const cronSecret = Deno.env.get('CRON_SECRET') || 'memude-cron-secret-2026-super-secure';
                await supabase.functions.invoke('distribution-timeout-checker', {
                  headers: {
                    'x-cron-secret': cronSecret
                  },
                  body: {
                    force_lead_id: leadAttempt.lead_id
                  }
                });
                console.log(`✅ Timeout checker de leads invocado de imediato para lead: ${leadAttempt.lead_id}`);
              } catch (invokeErr) {
                console.error('Erro ao invocar timeout checker de leads:', invokeErr);
              }
            }

            // 3. Tentar redistribuir Visita
            const { data: visitAttempt } = await supabase
              .from('visit_distribution_attempts')
              .select('id, visita_id')
              .eq('whatsapp_message_id', messageId)
              .eq('status', 'pending')
              .maybeSingle();

            if (visitAttempt) {
              console.log(`🚨 Falha de entrega WAHA na distribuição de VISITA ${visitAttempt.visita_id} (tentativa ${visitAttempt.id})`);

              await supabase
                .from('visit_distribution_attempts')
                .update({
                  status: 'timeout',
                  response_message: 'Falha no envio da mensagem de WhatsApp via WAHA (número inválido ou erro)'
                })
                .eq('id', visitAttempt.id);

              try {
                const cronSecret = Deno.env.get('CRON_SECRET') || 'memude-cron-secret-2026-super-secure';
                await supabase.functions.invoke('visit-distribution-timeout-checker', {
                  headers: {
                    'x-cron-secret': cronSecret
                  },
                  body: {
                    force_visita_id: visitAttempt.visita_id
                  }
                });
                console.log(`✅ Timeout checker de visitas invocado de imediato para visita: ${visitAttempt.visita_id}`);
              } catch (invokeErr) {
                console.error('Erro ao invocar timeout checker de visitas:', invokeErr);
              }
            }
        }
    } else {
      console.log(`⏭️ Evento WAHA ignorado: ${event}`);
    }

    const finalRespBody = { success: true };
    await logIntegration(supabase, {
      service: 'waha-api',
      endpoint: 'webhook',
      method: 'POST',
      status_code: 200,
      request_payload: payload,
      response_body: finalRespBody,
      duration_ms: Date.now() - startTime,
      metadata: { event }
    });

    return new Response(JSON.stringify(finalRespBody), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Tenta processar a conversa através da inteligência artificial BANT (tryAIAgentProcessing)
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
        console.log('🤖 Nenhuma keyword de trigger encontrada');
        return false;
      }

      console.log('🤖 Keyword de trigger detectada, iniciando conversa com AI');
    } else {
      console.log(`🤖 Conversa ativa encontrada: ${existingConversation.id}`);
    }

    // Check if lead was recently transferred to human — don't reactivate AI
    const { data: transferredConv } = await supabase
      .from('agent_conversations')
      .select('id, status')
      .eq('phone_number', phone)
      .eq('status', 'transferred')
      .gte('last_message_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (transferredConv) {
      console.log('🚫 Lead está em atendimento humano, ignorando AI');
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
    console.error('❌ Erro no tryAIAgentProcessing do WAHA:', error);
    return false;
  }
}
