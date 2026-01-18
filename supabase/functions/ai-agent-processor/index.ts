import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4.28.0';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.2.1';

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

function buildUltraHumanSystemPrompt(agent: any, conversation: any): string {
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
    await supabase.from('agent_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message_text
    });

    // 6. Build ULTRA-HUMAN system prompt
    const systemPrompt = buildUltraHumanSystemPrompt(activeAgent, {
      ...conversation,
      customer_name: customerName
    });

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
          chunk_index: i
        }
      });

      // If multiple chunks, wait between them
      if (i < messageChunks.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // 14. Update last_message_at
    await supabase
      .from('agent_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        total_messages: (conversation?.total_messages || 0) + 2
      })
      .eq('id', conversationId);

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
