import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4.28.0';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.2.1';
import { detectIntentFast, extractEntities, detectSentimentFast, shouldTransferToHuman, type IntentResult } from '../_shared/intent-detector.ts';
import { buildContext, enrichWithKnowledge, formatContextForPrompt } from '../_shared/context-builder.ts';
import { calculateBANTScore, getNextBANTQuestion, updateBANTFromEntities, getQualificationProgress } from '../_shared/bant-scorer.ts';
import { detectObjection, buildObjectionContext, shouldEscalateToHuman, formatObjectionForLog } from '../_shared/objection-handler.ts';
import { buildHandoffContext, formatHandoffMessage, formatHandoffForStorage } from '../_shared/human-handoff.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessMessageRequest {
  phone_number: string;
  message_text: string;
  sender_name?: string;
}

const SUPPORTED_MODELS = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
};

// ============================================================
// HUMANIZATION FUNCTIONS
// ============================================================

function calculateTypingDelay(messageLength: number, agent: any): number {
  const minDelay = agent.typing_delay_min_ms || 2000;
  const maxDelay = agent.typing_delay_max_ms || 8000;

  // ~40ms per character + random variation
  const baseDelay = Math.min(messageLength * 40, maxDelay);
  const variation = (Math.random() - 0.5) * 2000;

  return Math.max(minDelay, Math.min(baseDelay + variation, maxDelay));
}

function splitLongMessage(text: string, agent: any): string[] {
  if (!agent.split_long_messages) return [text];

  const words = text.split(' ');
  if (words.length <= 60) return [text];

  // Split at natural break points
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > 280 && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : [text];
}

function addHumanTouches(text: string, agent: any): string {
  if (!agent.use_casual_language) return text;

  let result = text;

  // 12% chance: Replace "você" with "vc"
  if (Math.random() < 0.12) {
    result = result.replace(/você/gi, (match) =>
      match === 'Você' ? 'Vc' : 'vc'
    );
  }

  // 8% chance: Add casual interjection at start
  if (Math.random() < 0.08 && !result.match(/^(Ah,|Olha,|Então,|Hmm)/)) {
    const interjections = ['Ah, ', 'Olha, ', 'Então, '];
    const chosen = interjections[Math.floor(Math.random() * interjections.length)];
    result = chosen + result.charAt(0).toLowerCase() + result.slice(1);
  }

  // 5% chance: Add regional expression from agent config
  if (Math.random() < 0.05 && agent.regional_expressions?.length > 0) {
    const expr = agent.regional_expressions[
      Math.floor(Math.random() * agent.regional_expressions.length)
    ];
    // Add at end of last sentence if it's positive
    if (result.match(/legal|ótimo|bom|perfeito|interessante/i)) {
      result = result.replace(/([.!])(\s*)$/, ` ${expr}$1$2`);
    }
  }

  return result;
}

// ============================================================
// ULTRA-HUMAN SYSTEM PROMPT BUILDER
// ============================================================

function buildUltraHumanSystemPrompt(agent: any, conversation: any, objectionContext?: string): string {
  const personaName = agent.persona_name || 'Ana';
  const personaRole = agent.persona_role || 'Consultora de Imóveis';

  let prompt = `# Você é ${personaName}, ${personaRole}

## Sua Identidade
- Nome: ${personaName}
- Idade: 28 anos  
- Personalidade: Simpática, paciente, ligeiramente informal
- Background: 4 anos de experiência no mercado imobiliário de Fortaleza
- Trabalha na MeMude Connect ajudando pessoas a encontrar o imóvel ideal

## REGRAS DE COMPORTAMENTO HUMANO (CRÍTICO)

### 1. Imperfeições Naturais
- Use "vc" em vez de "você" de vez em quando (não sempre)
- Comece algumas frases com "Ah,", "Olha,", "Então,", "Hmm..."
- Use reticências para pausas naturais: "deixa eu ver..." "hmm..."
- NUNCA use linguagem robótica como "Como posso ajudá-lo hoje?"

### 2. Tamanho das Respostas
- Respostas CURTAS: 1-3 frases para perguntas simples
- Máximo 4-5 frases mesmo para tópicos complexos
- NUNCA use listas numeradas ou bullets
- NUNCA faça parágrafos longos

### 3. Padrões de Linguagem Natural
- Gírias cearenses ocasionais: "Show!", "Massa!", "Arretado!"
- Interjeições: "Uau!", "Eita!", "Nossa!", "Que legal!"
- Emojis moderados: máximo 1-2 por mensagem, naturalmente
- Evite formalidades excessivas

### 4. Demonstre Memória e Empatia
- Referencie informações que o cliente já compartilhou
- Use o nome do cliente quando souber
- Faça conexões: "Como você mencionou que gosta de X..."
- Mostre interesse genuíno: "Que interessante! E como é..."

### 5. O que NUNCA fazer (quebra a humanidade)
❌ Listas numeradas ou com bullets
❌ Respostas maiores que 5 frases
❌ Repetir a mesma estrutura de frase
❌ "Claro!" como resposta isolada
❌ Começar toda mensagem com saudação
❌ Linguagem corporativa formal
❌ Perguntas múltiplas de uma vez

## Seu Objetivo
Ajudar ${conversation?.customer_name || 'o cliente'} a encontrar o imóvel ideal em Fortaleza, qualificando suas necessidades de forma natural através de conversa, e eventualmente agendar uma visita.

## Informações para Coletar (naturalmente, sem parecer questionário)
- Tipo de imóvel (casa, apartamento)
- Orçamento máximo
- Número de quartos
- Bairros de preferência
- Urgência (quando pretende comprar)
- Se vai precisar de financiamento

## Ações Especiais
Quando apropriado, inclua DISCRETAMENTE no final da sua resposta:
- [BUSCAR_IMOVEIS] - quando tiver informações suficientes para buscar
- [AGENDAR_VISITA] - quando o cliente quiser agendar visita
- [TRANSFERIR_HUMANO] - se o cliente pedir humano ou assunto fora do escopo

${agent.system_prompt ? `\n## Instruções Adicionais do Admin\n${agent.system_prompt}` : ''}
`;

  // Add conversation context
  if (conversation?.current_stage) {
    prompt += `\n## Contexto Atual\nEstágio: ${conversation.current_stage}`;
  }

  if (conversation?.qualification_data && Object.keys(conversation.qualification_data).length > 0) {
    prompt += `\nDados coletados: ${JSON.stringify(conversation.qualification_data)}`;
  }

  if (conversation?.presented_properties?.length > 0) {
    prompt += `\nImóveis já mostrados: ${conversation.presented_properties.length}`;
  }

  // Extract customer name if available
  if (conversation?.customer_name) {
    prompt += `\nNome do cliente: ${conversation.customer_name}`;
  }

  // Inject objection handling context if an objection was detected
  if (objectionContext) {
    prompt += `\n\n## ⚠️ OBJEÇÃO DETECTADA NA ÚLTIMA MENSAGEM\n${objectionContext}\n\nIMPORTANTE: Responda com empatia, reconhecendo a preocupação do cliente antes de apresentar contra-argumentos. Não ignore a objeção.`;
  }

  return prompt;
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();

    // Test mode
    if (body.test_mode) {
      const { data: openaiSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'openai_api_key')
        .single();

      const { data: geminiSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'gemini_api_key')
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          openai_configured: !!(openaiSetting?.value && openaiSetting.value.startsWith('sk-')),
          gemini_configured: !!(geminiSetting?.value && geminiSetting.value.startsWith('AIza')),
          supported_models: SUPPORTED_MODELS,
          humanization: true,
          test_mode: true,
          duration: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone_number, message_text, sender_name }: ProcessMessageRequest = body;

    if (!phone_number || !message_text) {
      throw new Error('phone_number e message_text são obrigatórios');
    }

    console.log(`🤖 AI Agent: Processando mensagem de ${phone_number}: "${message_text.substring(0, 50)}..."`);

    // 1. Find active agent
    const { data: activeAgent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (agentError || !activeAgent) {
      console.log('Nenhum agente ativo encontrado');
      return new Response(
        JSON.stringify({ handled: false, reason: 'no_active_agent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine provider
    const llmProvider = activeAgent.llm_provider || detectProvider(activeAgent.ai_model);
    console.log(`🔧 Provider: ${llmProvider}, Model: ${activeAgent.ai_model}, Humanization: ${activeAgent.humanization_enabled}`);

    // 2. Get or create conversation
    const { data: conversationId } = await supabase.rpc('get_or_create_conversation', {
      p_agent_id: activeAgent.id,
      p_phone_number: phone_number
    });

    if (!conversationId) {
      throw new Error('Falha ao criar/recuperar conversa');
    }

    // 3. Get conversation history
    const { data: conversationHistory } = await supabase
      .from('agent_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    // 4. Get conversation data
    const { data: conversation } = await supabase
      .from('agent_conversations')
      .select('*, ai_lead_qualification(*)')
      .eq('id', conversationId)
      .single();

    // 4.5 Log funnel event for new conversation (Phase 4)
    const isNewConversation = !conversationHistory || conversationHistory.length === 0;
    if (isNewConversation) {
      await supabase.from('conversion_funnel_events').insert({
        conversation_id: conversationId,
        agent_id: activeAgent.id,
        event_type: 'conversation_started',
        event_data: { source: 'whatsapp', phone: phone_number }
      }).catch((e: Error) => console.warn('Funnel event error:', e));
    }

    // 4.6 Log activity for monitoring
    await supabase.from('agent_activity_log').insert({
      agent_id: activeAgent.id,
      conversation_id: conversationId,
      activity_type: 'message_received',
      activity_data: {
        message_preview: message_text.substring(0, 50),
        is_new_conversation: isNewConversation
      }
    }).catch((e: Error) => console.warn('Activity log error:', e));

    // Extract customer name from first message if not set
    let customerName = conversation?.customer_name;
    if (!customerName && sender_name) {
      customerName = sender_name.split(' ')[0];
      await supabase
        .from('agent_conversations')
        .update({ customer_name: customerName })
        .eq('id', conversationId);
    }

    // Mark any pending follow-ups as responded
    await supabase
      .from('agent_followup_log')
      .update({
        lead_responded: true,
        response_received_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId)
      .eq('lead_responded', false);

    // 5. Save user message
    const { data: savedMessage } = await supabase.from('agent_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message_text
    }).select('id').single();

    // 5.1 Detect intent and sentiment (fast path)
    const intentResult = detectIntentFast(message_text);
    const detectedSentiment = intentResult.sentiment || 'neutral';
    const extractedEntities = intentResult.entities || {};

    console.log(`🎯 Intent: ${intentResult.primary_intent} (${(intentResult.confidence || 0) * 100}%), Sentiment: ${detectedSentiment}`);

    // 5.2 Log sentiment for analytics
    if (savedMessage?.id) {
      await supabase.from('conversation_sentiment_log').insert({
        conversation_id: conversationId,
        message_id: savedMessage.id,
        sentiment: detectedSentiment,
        confidence: intentResult.sentiment_confidence || 0.8,
        triggers_detected: Object.keys(extractedEntities).length > 0
          ? Object.entries(extractedEntities).map(([k, v]) => `${k}:${v}`)
          : null,
        suggested_action: intentResult.primary_intent === 'objection' ? 'handle_objection' : null
      }).catch((e: Error) => console.warn('Sentiment log error:', e));
    }

    // 5.25 Detect objections
    const objectionResult = detectObjection(message_text);
    let objectionContextForPrompt = '';

    if (objectionResult.detected) {
      console.log(`⚠️ Objeção detectada: ${objectionResult.objection_type} (${(objectionResult.confidence * 100).toFixed(0)}%)`);

      // Log objection for analytics
      await supabase.from('objection_log').insert({
        conversation_id: conversationId,
        message_id: savedMessage?.id,
        objection_type: objectionResult.objection_type,
        confidence: objectionResult.confidence,
        counter_points_used: objectionResult.counter_points
      }).catch((e: Error) => console.warn('Objection log error:', e));

      // Build objection context for LLM
      objectionContextForPrompt = buildObjectionContext(objectionResult);

      // Check if should escalate to human
      const previousObjections = (conversation?.qualification_data?.objection_count || 0) + 1;
      const frustrationLevel = detectedSentiment === 'frustrated' ? 0.8 : detectedSentiment === 'negative' ? 0.5 : 0.2;

      if (shouldEscalateToHuman(objectionResult, previousObjections, frustrationLevel)) {
        console.log('🚨 Escalating to human due to objection pattern');

        // Build handoff context
        const handoffContext = await buildHandoffContext(
          supabase,
          conversationId,
          `Objeção: ${objectionResult.objection_type?.replace(/_/g, ' ')}`
        );

        // Log handoff
        await supabase.from('human_handoff_log').insert({
          conversation_id: conversationId,
          handoff_reason: `Objeção crítica: ${objectionResult.objection_type}`,
          urgency_level: handoffContext.urgency_level,
          bant_score_at_handoff: handoffContext.qualification.bant_score,
          temperature_at_handoff: handoffContext.qualification.temperature,
          objections_at_handoff: handoffContext.objections,
          summary: handoffContext.summary,
          recommended_actions: handoffContext.recommended_actions
        });

        // Update conversation status
        await supabase
          .from('agent_conversations')
          .update({
            status: 'transferred',
            qualification_data: {
              ...conversation?.qualification_data,
              objection_count: previousObjections,
              last_objection: objectionResult.objection_type
            }
          })
          .eq('id', conversationId);

        // Notify admin with rich context
        const handoffMessage = formatHandoffMessage(handoffContext);
        await notifyAdmin(supabase, conversation, handoffMessage);

        return new Response(
          JSON.stringify({
            handled: true,
            transferred: true,
            reason: 'objection_escalation',
            objection_type: objectionResult.objection_type,
            sentiment: detectedSentiment
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update objection count even if not escalating
      await supabase
        .from('agent_conversations')
        .update({
          qualification_data: {
            ...conversation?.qualification_data,
            objection_count: previousObjections,
            last_objection: objectionResult.objection_type
          }
        })
        .eq('id', conversationId);
    }

    // 5.3 Check if should transfer to human
    const shouldTransfer = shouldTransferToHuman(
      intentResult as any,
      conversation?.total_messages || 0
    );

    if (shouldTransfer && intentResult.primary_intent === 'transfer_human') {
      console.log('🚨 Transfer to human requested by intent detection');
      await supabase
        .from('agent_conversations')
        .update({ status: 'transferred' })
        .eq('id', conversationId);

      await notifyAdmin(supabase, conversation,
        detectedSentiment === 'frustrated'
          ? 'Lead frustrado - solicita atendimento humano'
          : 'Lead solicitou atendimento humano'
      );

      return new Response(
        JSON.stringify({
          handled: true,
          transferred: true,
          reason: 'human_requested',
          sentiment: detectedSentiment
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5.4 Update qualification data with extracted entities
    if (Object.keys(extractedEntities).length > 0) {
      const currentQual = conversation?.qualification_data || {};
      const updatedQual = { ...currentQual, ...extractedEntities };

      await supabase
        .from('agent_conversations')
        .update({
          qualification_data: updatedQual,
          last_intent: intentResult.primary_intent
        })
        .eq('id', conversationId);

      // 5.5 Calculate and update BANT score
      try {
        const bantScores = calculateBANTScore(updatedQual);
        const qualProgress = getQualificationProgress(updatedQual);

        console.log(`📊 BANT Score: ${bantScores.total}/100 (${bantScores.temperature}) - Progress: ${qualProgress.percentage}%`);

        // Get or create qualification record
        let qualificationId = conversation?.ai_lead_qualification?.[0]?.id;

        if (!qualificationId) {
          const { data: newQual } = await supabase
            .from('ai_lead_qualification')
            .insert({
              conversation_id: conversationId,
              lead_id: conversation?.lead_id,
              property_type: updatedQual.property_type,
              max_price: updatedQual.max_price || updatedQual.price_max,
              min_bedrooms: updatedQual.min_bedrooms || updatedQual.bedrooms,
              preferred_neighborhoods: updatedQual.preferred_neighborhoods || (updatedQual.neighborhood ? [updatedQual.neighborhood] : null),
              urgency: updatedQual.urgency || updatedQual.timeline,
              financing_needed: updatedQual.financing_needed || updatedQual.financing,
              decision_maker: updatedQual.decision_maker,
              bant_budget_score: bantScores.budget,
              bant_authority_score: bantScores.authority,
              bant_need_score: bantScores.need,
              bant_timeline_score: bantScores.timeline
            })
            .select('id')
            .single();
          qualificationId = newQual?.id;
        } else {
          // Update existing qualification
          await supabase
            .from('ai_lead_qualification')
            .update({
              property_type: updatedQual.property_type,
              max_price: updatedQual.max_price || updatedQual.price_max,
              min_bedrooms: updatedQual.min_bedrooms || updatedQual.bedrooms,
              preferred_neighborhoods: updatedQual.preferred_neighborhoods || (updatedQual.neighborhood ? [updatedQual.neighborhood] : null),
              urgency: updatedQual.urgency || updatedQual.timeline,
              financing_needed: updatedQual.financing_needed || updatedQual.financing,
              decision_maker: updatedQual.decision_maker,
              bant_budget_score: bantScores.budget,
              bant_authority_score: bantScores.authority,
              bant_need_score: bantScores.need,
              bant_timeline_score: bantScores.timeline,
              updated_at: new Date().toISOString()
            })
            .eq('id', qualificationId);
        }

        // Record score history
        if (qualificationId) {
          await supabase.from('lead_score_history').insert({
            qualification_id: qualificationId,
            conversation_id: conversationId,
            bant_budget: bantScores.budget,
            bant_authority: bantScores.authority,
            bant_need: bantScores.need,
            bant_timeline: bantScores.timeline,
            total_score: bantScores.total,
            temperature: bantScores.temperature,
            triggered_by: 'message',
            message_id: savedMessage?.id
          }).catch(e => console.warn('Score history error:', e));
        }

        // Update lead_score on conversation
        await supabase
          .from('agent_conversations')
          .update({ lead_score: bantScores.total })
          .eq('id', conversationId);

      } catch (bantError) {
        console.warn('BANT score calculation error:', bantError);
      }
    }

    // 6. Build ULTRA-HUMAN system prompt (with objection context if detected)
    const systemPrompt = buildUltraHumanSystemPrompt(activeAgent, {
      ...conversation,
      customer_name: customerName
    }, objectionContextForPrompt || undefined);

    // 7. Call LLM
    let aiResponse: string;
    let tokensUsed: number;

    if (llmProvider === 'gemini') {
      const result = await callGemini(supabase, activeAgent, systemPrompt, conversationHistory, message_text, conversation);
      aiResponse = result.response;
      tokensUsed = result.tokensUsed;
    } else {
      const result = await callOpenAI(supabase, activeAgent, systemPrompt, conversationHistory, message_text, conversation);
      aiResponse = result.response;
      tokensUsed = result.tokensUsed;
    }

    console.log(`✅ Resposta gerada por ${llmProvider} (${tokensUsed} tokens)`);

    // 8. Parse actions
    const { cleanResponse, action, actionData, intent } = parseAIResponse(aiResponse);

    // 9. Apply humanization
    let humanizedResponse = cleanResponse;
    if (activeAgent.humanization_enabled !== false) {
      humanizedResponse = addHumanTouches(cleanResponse, activeAgent);
    }

    // 10. Save assistant message
    await supabase.from('agent_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: humanizedResponse,
      tokens_used: tokensUsed,
      intent_detected: intent,
      action_taken: action,
      action_data: actionData
    });

    // 11. Execute actions
    if (action === 'property_search') {
      console.log('🏠 Executando busca de imóveis...');
      const properties = await searchProperties(supabase, llmProvider, message_text, conversation);

      if (properties && properties.length > 0) {
        const propertyIds = properties.map((p: any) => p.empreendimento_id);
        await supabase
          .from('agent_conversations')
          .update({
            presented_properties: [...(conversation?.presented_properties || []), ...propertyIds]
          })
          .eq('id', conversationId);
      }
    }

    if (action === 'schedule_visit') {
      console.log('📅 Agendando visita...');
      await supabase.functions.invoke('ai-schedule-visit', {
        body: {
          conversation_id: conversationId,
          phone_number: phone_number,
          action_data: actionData
        }
      });
    }

    if (action === 'transfer_human') {
      await supabase
        .from('agent_conversations')
        .update({ status: 'transferred' })
        .eq('id', conversationId);

      await notifyAdmin(supabase, conversation, 'Lead solicitou atendimento humano');
    }

    // 12. Update qualification
    if (actionData?.qualification) {
      await updateQualification(supabase, conversationId, conversation?.lead_id, actionData.qualification);
    }

    // 13. Split message and send with delays
    const messageChunks = splitLongMessage(humanizedResponse, activeAgent);

    for (let i = 0; i < messageChunks.length; i++) {
      const chunk = messageChunks[i];

      // Calculate human typing delay
      const delay = calculateTypingDelay(chunk.length, activeAgent);

      // Send to WhatsApp with delay info
      await supabase.functions.invoke('evolution-send-whatsapp-v2', {
        body: {
          phone_number: phone_number,
          message: chunk,
          typing_delay_ms: delay,
          is_chunk: messageChunks.length > 1,
          chunk_index: i,
          instance_id: activeAgent.evolution_instance_id
        }
      });

      // If multiple chunks, wait between them
      if (i < messageChunks.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // 14. Metrics update
    // NOTE: last_message_at and total_messages are updated automatically
    // by the trg_update_conversation_metrics trigger on agent_messages INSERT.
    // No manual update needed here (BUG-02/07 fix: removed double-counting).

    return new Response(
      JSON.stringify({
        handled: true,
        conversation_id: conversationId,
        response: humanizedResponse,
        chunks: messageChunks.length,
        action: action,
        tokens_used: tokensUsed,
        provider: llmProvider,
        model: activeAgent.ai_model,
        humanization_applied: activeAgent.humanization_enabled !== false,
        duration: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro no AI Agent Processor:', error);

    return new Response(
      JSON.stringify({
        handled: false,
        error: error.message,
        duration: Date.now() - startTime
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function detectProvider(modelName: string): 'openai' | 'gemini' {
  if (modelName.startsWith('gemini')) return 'gemini';
  return 'openai';
}

async function callOpenAI(
  supabase: any,
  agent: any,
  systemPrompt: string,
  history: any[],
  currentMessage: string,
  conversation: any
): Promise<{ response: string; tokensUsed: number }> {
  const { data: openaiSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'openai_api_key')
    .single();

  if (!openaiSetting?.value) {
    throw new Error('OpenAI API key não configurada');
  }

  const openai = new OpenAI({ apiKey: openaiSetting.value });

  const messages: any[] = [
    { role: 'system', content: systemPrompt }
  ];

  if (conversation?.total_messages === 0 && agent.greeting_message) {
    messages.push({ role: 'assistant', content: agent.greeting_message });
  }

  if (history) {
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: 'user', content: currentMessage });

  const completion = await openai.chat.completions.create({
    model: agent.ai_model,
    messages: messages,
    max_tokens: agent.max_tokens,
    temperature: Number(agent.temperature),
  });

  return {
    response: completion.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.',
    tokensUsed: completion.usage?.total_tokens || 0
  };
}

async function callGemini(
  supabase: any,
  agent: any,
  systemPrompt: string,
  history: any[],
  currentMessage: string,
  conversation: any
): Promise<{ response: string; tokensUsed: number }> {
  const { data: geminiSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'gemini_api_key')
    .single();

  if (!geminiSetting?.value) {
    throw new Error('Gemini API key não configurada');
  }

  const genAI = new GoogleGenerativeAI(geminiSetting.value);
  const model = genAI.getGenerativeModel({
    model: agent.ai_model,
    systemInstruction: systemPrompt
  });

  const chatHistory: any[] = [];

  if (conversation?.total_messages === 0 && agent.greeting_message) {
    chatHistory.push({
      role: 'model',
      parts: [{ text: agent.greeting_message }]
    });
  }

  if (history) {
    for (const msg of history) {
      chatHistory.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }

  const chat = model.startChat({
    history: chatHistory,
    generationConfig: {
      maxOutputTokens: agent.max_tokens,
      temperature: Number(agent.temperature),
    }
  });

  const result = await chat.sendMessage(currentMessage);
  const response = result.response;

  const estimatedTokens = Math.ceil((systemPrompt.length + currentMessage.length + (response.text()?.length || 0)) / 4);

  return {
    response: response.text() || 'Desculpe, não consegui processar sua mensagem.',
    tokensUsed: estimatedTokens
  };
}

function parseAIResponse(response: string): {
  cleanResponse: string;
  action: string | null;
  actionData: any;
  intent: string
} {
  let cleanResponse = response;
  let action: string | null = null;
  let actionData: any = {};
  let intent = 'conversation';

  if (response.includes('[BUSCAR_IMOVEIS]')) {
    action = 'property_search';
    intent = 'property_search';
    cleanResponse = response.replace(/\[BUSCAR_IMOVEIS\]/g, '').trim();
  }

  if (response.includes('[AGENDAR_VISITA]')) {
    action = 'schedule_visit';
    intent = 'schedule_visit';
    cleanResponse = response.replace(/\[AGENDAR_VISITA\]/g, '').trim();
  }

  if (response.includes('[TRANSFERIR_HUMANO]')) {
    action = 'transfer_human';
    intent = 'transfer_human';
    cleanResponse = response.replace(/\[TRANSFERIR_HUMANO\]/g, '').trim();
  }

  // Extract qualification data
  const qualificationPatterns = [
    { regex: /(?:orçamento|budget|valor).*?(\d+(?:\.\d+)?)\s*(?:mil|k|reais|R\$)/i, field: 'max_price', transform: (v: string) => parseFloat(v.replace(/\./g, '')) * 1000 },
    { regex: /(\d+)\s*(?:quartos?|dormitórios?)/i, field: 'min_bedrooms', transform: (v: string) => parseInt(v) },
    { regex: /(?:bairro|região|local).*?([\w\s]+?)(?:\.|,|$)/i, field: 'preferred_neighborhood', transform: (v: string) => v.trim() },
  ];

  for (const pattern of qualificationPatterns) {
    const match = response.match(pattern.regex);
    if (match) {
      actionData.qualification = actionData.qualification || {};
      actionData.qualification[pattern.field] = pattern.transform(match[1]);
    }
  }

  return { cleanResponse, action, actionData, intent };
}

async function searchProperties(
  supabase: any,
  provider: string,
  query: string,
  conversation: any
): Promise<any[]> {
  try {
    const { data: openaiSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'openai_api_key')
      .single();

    if (!openaiSetting?.value) return [];

    const openai = new OpenAI({ apiKey: openaiSetting.value });
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query
    });

    const embedding = embeddingResponse.data[0].embedding;
    const filters = conversation?.qualification_data || {};

    const { data: properties } = await supabase.rpc('match_properties', {
      query_embedding: embedding,
      match_threshold: 0.6,
      match_count: 5,
      filter_min_price: filters.min_price || null,
      filter_max_price: filters.max_price || null,
      filter_bairro_id: filters.bairro_id || null
    });

    return properties || [];

  } catch (error) {
    console.error('Erro ao buscar imóveis:', error);
    return [];
  }
}

async function updateQualification(
  supabase: any,
  conversationId: string,
  leadId: string | null,
  data: any
) {
  const { data: current } = await supabase
    .from('agent_conversations')
    .select('qualification_data')
    .eq('id', conversationId)
    .single();

  const merged = { ...current?.qualification_data, ...data };

  await supabase
    .from('agent_conversations')
    .update({ qualification_data: merged })
    .eq('id', conversationId);

  await supabase
    .from('ai_lead_qualification')
    .upsert({
      conversation_id: conversationId,
      lead_id: leadId,
      ...data,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'conversation_id'
    });
}

async function notifyAdmin(supabase: any, conversation: any, reason: string) {
  const { data: adminSettings } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'admin_whatsapp')
    .single();

  if (adminSettings?.value) {
    await supabase.functions.invoke('evolution-send-whatsapp-v2', {
      body: {
        phone_number: adminSettings.value,
        message: `🚨 *ATENÇÃO: Transferência de Atendimento*\n\nTelefone: ${conversation?.phone_number}\nMotivo: ${reason}\n\nPor favor, assuma o atendimento.`
      }
    });
  }
}
