
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processIncomingMessage } from '../_shared/distribution-logic.ts';
import { logIntegration } from '../_shared/integration-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// EVO-02: In-memory dedup cache (survives within a single function invocation cold-start window)
const processedMessages = new Map<string, number>();
const DEDUP_TTL_MS = 60_000; // 60 seconds

function isDuplicate(messageId: string): boolean {
  const now = Date.now();
  // Clean expired entries
  for (const [key, ts] of processedMessages) {
    if (now - ts > DEDUP_TTL_MS) processedMessages.delete(key);
  }
  if (processedMessages.has(messageId)) return true;
  processedMessages.set(messageId, now);
  return false;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // EVO-07: Webhook authentication
    const webhookSecret = req.headers.get('x-webhook-secret');
    const { data: secretSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'evolution_webhook_secret')
      .maybeSingle();

    if (secretSetting?.value) {
      if (!webhookSecret || webhookSecret !== secretSetting.value) {
        console.warn('🚫 Webhook authentication failed: invalid or missing secret');
        return new Response(
          JSON.stringify({ error: 'Unauthorized: missing or invalid secret' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const startTime = Date.now();
    const webhookData = await req.json();
    const { event, data } = webhookData;

    // Log completo do payload para debug
    console.log('📨 Webhook FULL payload:', JSON.stringify(webhookData).substring(0, 2000));

    // EVO-02: Extract messageId for deduplication
    const messageId = data?.key?.id || data?.message?.key?.id || null;
    if (messageId && isDuplicate(messageId)) {
      console.log(`⏭️ Duplicate message skipped: ${messageId}`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'duplicate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Comparação case-insensitive para evento (Evolution API pode enviar MESSAGES_UPSERT ou messages.upsert)
    const eventLower = (event || '').toLowerCase().replace('.', '_');

    if (eventLower === 'messages_upsert') {
      // Evolution API V2 pode ter estruturas diferentes
      const messageData = data?.message || data;

      // EVO-LID-FIX: Evolution API V2 agora usa LID (Linked Identity Device) no remoteJid
      // O campo `sender` pode conter o telefone da INSTÂNCIA (bot), não do remetente!
      // O remoteJid contém o LID. Precisamos resolver via lid_phone_map.
      const stripJidSuffix = (jid: string | undefined) =>
        jid?.replace('@s.whatsapp.net', '').replace('@lid', '') || '';

      // 1. Priorizar campo `sender` do payload (Evolution API V2 format)
      let phone = stripJidSuffix(webhookData?.sender);

      // 2. Fallback para remoteJid (formato antigo ou instâncias que não enviam sender)
      if (!phone) {
        phone = stripJidSuffix(messageData?.key?.remoteJid) ||
          stripJidSuffix(data?.key?.remoteJid);
      }

      // 3. Se for LID (número não-telefônico), descartar e buscar alternativas
      if (phone && !/^\d{10,15}$/.test(phone)) {
        console.log(`⚠️ Phone "${phone}" parece ser LID, buscando alternativa...`);
        phone = stripJidSuffix(messageData?.key?.participant) ||
          stripJidSuffix(messageData?.key?.participantAlt) ||
          stripJidSuffix(data?.key?.participant) ||
          stripJidSuffix(data?.key?.participantAlt) || '';
      }

      // 4. Em grupos, pegar o participante
      if (phone?.includes('@g.us') || phone?.includes('g.us')) {
        phone = stripJidSuffix(messageData?.key?.participant) ||
          stripJidSuffix(messageData?.key?.participantAlt);
      }

      // =============================================
      // 5. LID RESOLUTION: Se o `phone` é o número da instância (bot),
      //    o remetente real está no LID do remoteJid.
      //    Resolver via tabela lid_phone_map.
      // =============================================
      const rawRemoteJid = messageData?.key?.remoteJid || data?.key?.remoteJid || '';
      const isLidMessage = rawRemoteJid.includes('@lid');

      if (isLidMessage && phone) {
        console.log(`🔄 LID detectado no remoteJid: ${rawRemoteJid}. Phone atual: ${phone}. Tentando resolver...`);

        const lid = stripJidSuffix(rawRemoteJid);

        // Tentar resolver LID → telefone real via lid_phone_map
        const { data: lidMapping } = await supabase
          .from('lid_phone_map')
          .select('phone')
          .eq('lid', lid)
          .maybeSingle();

        if (lidMapping?.phone) {
          console.log(`✅ LID resolvido via lid_phone_map: ${lid} → ${lidMapping.phone}`);
          phone = lidMapping.phone;
        } else {
          // Fallback: tentar pelo phone extraído do sender (pode ser a instância)
          // Verificar se o phone atual NÃO é a instância
          const { data: instanceCheck } = await supabase
            .from('evolution_instances')
            .select('instance_name')
            .limit(1)
            .maybeSingle();

          console.log(`⚠️ LID ${lid} não encontrado em lid_phone_map. Phone permanece: ${phone}`);
          console.log(`   Para resolver, é necessário enviar uma mensagem ao destinatário primeiro para popular lid_phone_map.`);
        }
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
        // FASE 1: Verificar distribuição pendente PRIMEIRO (SIM/NÃO de corretores)
        // PRIORIDADE: Respostas de distribuição DEVEM ser processadas antes do AI
        // ============================================
        console.log('📋 Verificando lógica de distribuição (prioridade sobre AI)...');
        const distributionResult = await processIncomingMessage(supabase, phone, text, senderName || '', rawRemoteJid);
        console.log('Resultado distribuição:', distributionResult);

        if (distributionResult.processed) {
          console.log(`✅ Mensagem processada pela distribuição: action=${distributionResult.action}`);

          // Log no banco para debug
          await supabase.from('webhook_logs').insert({
            event_type: 'DISTRIBUTION_RESPONSE',
            instance_name: webhookData?.instance || 'unknown',
            payload: { phone, text, result: distributionResult },
            processed_successfully: true,
            processing_time_ms: Date.now() - startTime
          });

          const respBody = { success: true, distribution_handled: true, action: distributionResult.action };
          await logIntegration(supabase, {
            service: 'evolution-api',
            endpoint: 'webhook',
            method: 'POST',
            status_code: 200,
            request_payload: webhookData,
            response_body: respBody,
            duration_ms: Date.now() - startTime,
            metadata: { event: webhookData.event, instance: webhookData.instance, handled_by: 'distribution_logic' }
          });

          return new Response(
            JSON.stringify(respBody),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ============================================
        // FASE 2: Tentar agente de IA (apenas se distribuição não processou)
        // ============================================
        const aiHandled = await tryAIAgentProcessing(supabase, phone, text, senderName);

        if (aiHandled) {
          console.log('✅ Mensagem processada pelo AI Agent');
          const respBody = { success: true, ai_handled: true };
          await logIntegration(supabase, {
            service: 'evolution-api',
            endpoint: 'webhook',
            method: 'POST',
            status_code: 200,
            request_payload: webhookData,
            response_body: respBody,
            duration_ms: Date.now() - startTime,
            metadata: { event: webhookData.event, instance: webhookData.instance, handled_by: 'ai_agent' }
          });

          return new Response(
            JSON.stringify(respBody),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ============================================
        // FASE 3: Nenhum handler processou — log para debug
        // ============================================
        console.log('📋 Mensagem não processada por distribuição nem AI. Registrando...');

        // Log no banco para debug
        await supabase.from('webhook_logs').insert({
          event_type: 'UNHANDLED_MESSAGE',
          instance_name: webhookData?.instance || 'unknown',
          payload: { phone, text, distributionResult, aiHandled },
          processed_successfully: false,
          processing_time_ms: Date.now() - startTime
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
    } else if (eventLower === 'messages_update') {
      const status = data?.status || data?.update?.status;
      const messageId = data?.key?.id;
      
      console.log(`🔄 Evolution Status Update: Message ${messageId} -> Status ${status}`);

      const isFailed = status === 'ERROR' || status === 'failed';

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
          console.log(`🚨 Falha de entrega na distribuição de LEAD ${leadAttempt.lead_id} (tentativa ${leadAttempt.id})`);
          
          await supabase
            .from('distribution_attempts')
            .update({
              status: 'timeout',
              response_message: 'Falha no envio da mensagem de WhatsApp (número inválido ou erro)'
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
          console.log(`🚨 Falha de entrega na distribuição de VISITA ${visitAttempt.visita_id} (tentativa ${visitAttempt.id})`);

          await supabase
            .from('visit_distribution_attempts')
            .update({
              status: 'timeout',
              response_message: 'Falha no envio da mensagem de WhatsApp (número inválido ou erro)'
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

    const finalRespBody = { success: true };
    await logIntegration(supabase, {
      service: 'evolution-api',
      endpoint: 'webhook',
      method: 'POST',
      status_code: 200,
      request_payload: webhookData,
      response_body: finalRespBody,
      duration_ms: Date.now() - startTime,
      metadata: { event: webhookData?.event, instance: webhookData?.instance }
    });

    return new Response(JSON.stringify(finalRespBody), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Webhook error:', error);
    // EVO-01: Return proper HTTP error code so Evolution API can retry delivery
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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