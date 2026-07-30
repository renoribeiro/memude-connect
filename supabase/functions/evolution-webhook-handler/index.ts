
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { processIncomingMessage } from '../_shared/distribution-logic.ts';
import { logIntegration } from '../_shared/integration-logger.ts';
import { jsonResponse, verifyWebhook } from '../_shared/security.ts';
import { getEvolutionWebhookSecret } from '../_shared/evolution-webhook.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'https://core.memudecore.com.br',
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

    const declaredLength = Number(req.headers.get('content-length') ?? '0');
    if (declaredLength > 1024 * 1024) {
      return jsonResponse(req, { error: 'Payload excede o limite permitido' }, 413);
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).length > 1024 * 1024) {
      return jsonResponse(req, { error: 'Payload excede o limite permitido' }, 413);
    }

    const expectedSecret = await getEvolutionWebhookSecret(supabase);
    if (!expectedSecret) {
      console.error('Evolution webhook rejected: no webhook secret configured');
      return jsonResponse(req, { error: 'Webhook ainda não configurado' }, 503);
    }

    if (!(await verifyWebhook(req, rawBody, expectedSecret))) {
      console.warn('Evolution webhook rejected: invalid signature');
      return jsonResponse(req, { error: 'Não autorizado' }, 401);
    }

    const startTime = Date.now();
    const webhookData = JSON.parse(rawBody);
    const { event, data } = webhookData;
    const safeWebhookData = {
      ...webhookData,
      ...(webhookData?.apikey ? { apikey: '[REDACTED]' } : {}),
    };

    console.log('Evolution webhook received', { event, message_id: data?.key?.id ?? null });

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
        console.log('Identificador LID detectado; buscando alternativa');
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
        console.log('Resolvendo identificador LID');

        const lid = stripJidSuffix(rawRemoteJid);

        // Tentar resolver LID → telefone real via lid_phone_map
        const { data: lidMapping } = await supabase
          .from('lid_phone_map')
          .select('phone')
          .eq('lid', lid)
          .maybeSingle();

        if (lidMapping?.phone) {
          console.log('Identificador LID resolvido');
          phone = lidMapping.phone;
        } else {
          // Fallback: tentar pelo phone extraído do sender (pode ser a instância)
          // Verificar se o phone atual NÃO é a instância
          const { data: instanceCheck } = await supabase
            .from('evolution_instances')
            .select('instance_name')
            .limit(1)
            .maybeSingle();

          console.log('Identificador LID ainda não possui mapeamento');
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

      const fromMe = messageData?.key?.fromMe || data?.key?.fromMe;

      if (phone && text && !fromMe) {
        console.log('Webhook Evolution: mensagem recebida', {
          has_phone: Boolean(phone),
          text_length: text.length,
        });

        // Extract sender name (pushName) from webhook payload (BUG-03 fix)
        const senderName = messageData?.pushName || data?.pushName || null;

        // ============================================
        // FASE 1: Verificar distribuição pendente PRIMEIRO (SIM/NÃO de corretores)
        // PRIORIDADE: Respostas de distribuição DEVEM ser processadas antes do AI
        // ============================================
        console.log('📋 Verificando lógica de distribuição (prioridade sobre AI)...');
        const distributionResult = await processIncomingMessage(supabase, phone, text, senderName || '', rawRemoteJid);
        console.log('Resultado de distribuição calculado');

        if (distributionResult.processed) {
          console.log(`✅ Mensagem processada pela distribuição: action=${distributionResult.action}`);

          // Log no banco para debug
          await supabase.from('webhook_logs').insert({
            event_type: 'DISTRIBUTION_RESPONSE',
            instance_name: webhookData?.instance || 'unknown',
            payload: {
              action: distributionResult.action,
              message_length: text.length,
              processed: true,
            },
            processed_successfully: true,
            processing_time_ms: Date.now() - startTime
          });

          const respBody = { success: true, distribution_handled: true, action: distributionResult.action };
          await logIntegration(supabase, {
            service: 'evolution-api',
            endpoint: 'webhook',
            method: 'POST',
            status_code: 200,
            request_payload: safeWebhookData,
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
            request_payload: safeWebhookData,
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
          payload: {
            message_length: text.length,
            distribution_processed: distributionResult.processed,
            ai_handled: aiHandled,
          },
          processed_successfully: false,
          processing_time_ms: Date.now() - startTime
        });
      } else {
        console.log('Mensagem ignorada por ausência de dados ou origem própria');

        // Log no banco para debug - incluir estrutura completa para análise
        await supabase.from('webhook_logs').insert({
          event_type: 'MESSAGE_IGNORED',
          instance_name: webhookData?.instance || 'unknown',
          payload: {
            fromMe: messageData?.key?.fromMe,
            reason: !phone ? 'no_phone' : !text ? 'no_text' : 'from_me',
            messageKeys: Object.keys(messageData?.message || {}),
            dataKeys: Object.keys(data || {}),
            message_length: text.length,
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
              provider_status: status,
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
            await supabase.functions.invoke('distribution-timeout-checker', {
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
            await supabase.functions.invoke('visit-distribution-timeout-checker', {
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
    } else if (eventLower === 'test_connection') {
      await supabase.from('webhook_logs').insert({
        event_type: 'TEST_CONNECTION',
        instance_name: webhookData?.instance || 'unknown',
        payload: { connectivity_test: true },
        processed_successfully: true,
        processing_time_ms: Date.now() - startTime,
      });
      return jsonResponse(req, { success: true, connectivity_test: true });
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
      request_payload: safeWebhookData,
      response_body: finalRespBody,
      duration_ms: Date.now() - startTime,
      metadata: { event: webhookData?.event, instance: webhookData?.instance }
    });

    return new Response(JSON.stringify(finalRespBody), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error(
      'Falha no webhook Evolution:',
      error instanceof Error ? error.message : 'erro desconhecido',
    );
    // EVO-01: Return proper HTTP error code so Evolution API can retry delivery
    return new Response(
      JSON.stringify({ error: 'Falha interna ao processar webhook' }),
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
