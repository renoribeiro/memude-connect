/**
 * Context Builder Module
 * Enriches conversation context for better AI responses
 * Part of Phase 1: Core Enhancement
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4.28.0';

// ============================================================
// TYPES
// ============================================================

export interface ConversationContext {
    summary: string;
    customer_name: string | null;
    customer_profile: CustomerProfile | null;
    qualification_progress: QualificationProgress;
    presented_properties: PropertySummary[];
    interest_signals: string[];
    objections_raised: string[];
    last_intent: string | null;
    conversation_stage: string;
    message_count: number;
    knowledge_context: string[];
}

export interface CustomerProfile {
    name: string | null;
    phone: string;
    preferred_contact_time?: string;
    property_preferences?: {
        type?: string;
        price_range?: { min?: number; max?: number };
        bedrooms?: number;
        neighborhoods?: string[];
    };
    lead_source?: string;
    previous_interactions?: number;
}

export interface QualificationProgress {
    budget_collected: boolean;
    authority_confirmed: boolean;
    need_identified: boolean;
    timeline_defined: boolean;
    completion_percentage: number;
}

export interface PropertySummary {
    id: string;
    name: string;
    price_range: string;
    location: string;
    shown_at: string;
}

// ============================================================
// MAIN FUNCTIONS
// ============================================================

/**
 * Build comprehensive context for AI conversation
 */
export async function buildContext(
    supabase: SupabaseClient,
    conversationId: string,
    phoneNumber: string,
    currentMessage: string
): Promise<ConversationContext> {
    // Parallel fetch of all context data
    const [
        conversationData,
        messageHistory,
        leadData,
        qualificationData,
        previousConversations
    ] = await Promise.all([
        fetchConversationData(supabase, conversationId),
        fetchMessageHistory(supabase, conversationId, 15),
        fetchLeadByPhone(supabase, phoneNumber),
        fetchQualificationData(supabase, conversationId),
        fetchPreviousConversations(supabase, phoneNumber, conversationId)
    ]);

    // Build customer profile
    const customerProfile = buildCustomerProfile(leadData, conversationData, phoneNumber);

    // Analyze qualification progress
    const qualificationProgress = analyzeQualificationProgress(qualificationData, conversationData);

    // Extract interest signals and objections from history
    const { interests, objections } = analyzeMessageHistory(messageHistory);

    // Build property summaries
    const presentedProperties = await buildPropertySummaries(
        supabase,
        conversationData?.presented_properties || []
    );

    // Generate summary if conversation is long
    const summary = messageHistory.length > 10
        ? await generateConversationSummary(messageHistory)
        : buildSimpleSummary(messageHistory);

    return {
        summary,
        customer_name: customerProfile?.name || conversationData?.customer_name || null,
        customer_profile: customerProfile,
        qualification_progress: qualificationProgress,
        presented_properties: presentedProperties,
        interest_signals: interests,
        objections_raised: objections,
        last_intent: conversationData?.last_intent || null,
        conversation_stage: conversationData?.current_stage || 'greeting',
        message_count: conversationData?.total_messages || 0,
        knowledge_context: []
    };
}

/**
 * Enrich context with knowledge base matches
 */
export async function enrichWithKnowledge(
    supabase: SupabaseClient,
    openai: OpenAI,
    agentId: string,
    context: ConversationContext,
    currentMessage: string
): Promise<ConversationContext> {
    try {
        // Generate embedding for current message
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: currentMessage
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Search knowledge base
        const { data: matches } = await supabase.rpc('match_knowledge_base', {
            query_embedding: embedding,
            p_agent_id: agentId,
            match_threshold: 0.7,
            match_count: 3
        });

        if (matches && matches.length > 0) {
            context.knowledge_context = matches.map((m: any) =>
                `[${m.category.toUpperCase()}] ${m.answer}`
            );
        }
    } catch (error) {
        console.error('Error enriching with knowledge:', error);
    }

    return context;
}

/**
 * Format context for system prompt injection
 */
export function formatContextForPrompt(context: ConversationContext): string {
    const parts: string[] = [];

    // Customer info
    if (context.customer_name) {
        parts.push(`## Cliente: ${context.customer_name}`);
    }

    // Conversation summary
    if (context.summary) {
        parts.push(`## Resumo da Conversa\n${context.summary}`);
    }

    // Qualification progress
    const qual = context.qualification_progress;
    parts.push(`## Progresso da Qualificação (${qual.completion_percentage}%)`);
    parts.push(`- Orçamento: ${qual.budget_collected ? '✅' : '❌'}`);
    parts.push(`- Decisor: ${qual.authority_confirmed ? '✅' : '❌'}`);
    parts.push(`- Necessidade: ${qual.need_identified ? '✅' : '❌'}`);
    parts.push(`- Prazo: ${qual.timeline_defined ? '✅' : '❌'}`);

    // Properties shown
    if (context.presented_properties.length > 0) {
        parts.push(`## Imóveis Apresentados`);
        context.presented_properties.forEach(p => {
            parts.push(`- ${p.name} (${p.location}) - ${p.price_range}`);
        });
    }

    // Interest signals
    if (context.interest_signals.length > 0) {
        parts.push(`## Sinais de Interesse`);
        context.interest_signals.forEach(s => parts.push(`- ${s}`));
    }

    // Objections
    if (context.objections_raised.length > 0) {
        parts.push(`## Objeções Identificadas`);
        context.objections_raised.forEach(o => parts.push(`- ${o}`));
    }

    // Knowledge context
    if (context.knowledge_context.length > 0) {
        parts.push(`## Informações Relevantes`);
        context.knowledge_context.forEach(k => parts.push(k));
    }

    return parts.join('\n');
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function fetchConversationData(supabase: SupabaseClient, conversationId: string) {
    const { data } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
    return data;
}

async function fetchMessageHistory(supabase: SupabaseClient, conversationId: string, limit: number) {
    const { data } = await supabase
        .from('agent_messages')
        .select('role, content, intent_detected, action_taken, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);
    return data || [];
}

async function fetchLeadByPhone(supabase: SupabaseClient, phone: string) {
    const { data } = await supabase
        .from('leads')
        .select('id, nome, telefone, email, status, origem, created_at')
        .eq('telefone', phone)
        .maybeSingle();
    return data;
}

async function fetchQualificationData(supabase: SupabaseClient, conversationId: string) {
    const { data } = await supabase
        .from('ai_lead_qualification')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();
    return data;
}

async function fetchPreviousConversations(supabase: SupabaseClient, phone: string, excludeId: string) {
    const { data } = await supabase
        .from('agent_conversations')
        .select('id, qualification_data, lead_score, current_stage, completed_at')
        .eq('phone_number', phone)
        .neq('id', excludeId)
        .order('completed_at', { ascending: false })
        .limit(3);
    return data || [];
}

function buildCustomerProfile(lead: any, conversation: any, phone: string): CustomerProfile | null {
    if (!lead && !conversation) {
        return { name: null, phone };
    }

    const qualData = conversation?.qualification_data || {};

    return {
        name: lead?.nome || conversation?.customer_name || null,
        phone,
        property_preferences: {
            type: qualData.property_type,
            price_range: qualData.max_price ? { max: qualData.max_price } : undefined,
            bedrooms: qualData.min_bedrooms,
            neighborhoods: qualData.preferred_neighborhoods
        },
        lead_source: lead?.origem,
        previous_interactions: lead ? 1 : 0
    };
}

function analyzeQualificationProgress(qualification: any, conversation: any): QualificationProgress {
    const qualData = conversation?.qualification_data || {};
    const qual = qualification || {};

    const budget = !!(qualData.max_price || qual.max_price);
    const authority = qual.decision_maker !== null ? qual.decision_maker : undefined;
    const need = !!(qualData.property_type || qual.property_type);
    const timeline = !!(qualData.urgency || qual.urgency);

    let collected = 0;
    if (budget) collected++;
    if (authority !== undefined) collected++;
    if (need) collected++;
    if (timeline) collected++;

    return {
        budget_collected: budget,
        authority_confirmed: authority === true,
        need_identified: need,
        timeline_defined: timeline,
        completion_percentage: Math.round((collected / 4) * 100)
    };
}

function analyzeMessageHistory(messages: any[]): { interests: string[]; objections: string[] } {
    const interests: string[] = [];
    const objections: string[] = [];

    const interestPatterns = [
        /interessante|gostei|quero saber mais|me conta mais|parece bom/i,
        /esse eu gostei|esse é legal|pode ser|quero ver/i
    ];

    const objectionPatterns = [
        /(muito caro|fora do orçamento|não tenho)/i,
        /(preciso pensar|vou ver|depois)/i,
        /(meu marido|minha esposa|família)/i
    ];

    for (const msg of messages) {
        if (msg.role !== 'user') continue;

        for (const pattern of interestPatterns) {
            if (pattern.test(msg.content)) {
                interests.push(msg.content.substring(0, 50) + '...');
                break;
            }
        }

        for (const pattern of objectionPatterns) {
            if (pattern.test(msg.content)) {
                objections.push(msg.content.substring(0, 50) + '...');
                break;
            }
        }
    }

    return {
        interests: interests.slice(-3),
        objections: objections.slice(-3)
    };
}

async function buildPropertySummaries(supabase: SupabaseClient, propertyIds: string[]): Promise<PropertySummary[]> {
    if (!propertyIds || propertyIds.length === 0) return [];

    const { data } = await supabase
        .from('empreendimentos')
        .select('id, nome, valor_min, valor_max, bairro:bairros(nome)')
        .in('id', propertyIds.slice(0, 5));

    if (!data) return [];

    return data.map(p => ({
        id: p.id,
        name: p.nome,
        price_range: formatPriceRange(p.valor_min, p.valor_max),
        location: (p.bairro as any)?.nome || 'N/A',
        shown_at: new Date().toISOString()
    }));
}

function formatPriceRange(min: number | null, max: number | null): string {
    const format = (v: number) => {
        if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
        if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}k`;
        return `R$ ${v}`;
    };

    if (min && max) return `${format(min)} - ${format(max)}`;
    if (min) return `A partir de ${format(min)}`;
    if (max) return `Até ${format(max)}`;
    return 'Consulte';
}

function buildSimpleSummary(messages: any[]): string {
    if (messages.length === 0) return 'Nova conversa iniciada.';

    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');

    let summary = `Conversa com ${messages.length} mensagens.`;

    if (lastUserMsg?.intent_detected) {
        summary += ` Última intenção: ${lastUserMsg.intent_detected}.`;
    }

    return summary;
}

async function generateConversationSummary(messages: any[]): Promise<string> {
    // AI-05: Build a rich summary with actionable insights
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const recentUserMessages = userMessages.slice(-5);
    const topics = new Set<string>();
    const entities: string[] = [];

    recentUserMessages.forEach(m => {
        if (m.intent_detected) topics.add(m.intent_detected);
        if (m.action_data) {
            const data = typeof m.action_data === 'string' ? JSON.parse(m.action_data) : m.action_data;
            Object.entries(data).forEach(([k, v]) => {
                if (v && k !== 'qualification') entities.push(`${k}: ${v}`);
            });
        }
    });

    // Determine engagement level
    const avgUserMsgLen = userMessages.length > 0
        ? userMessages.reduce((sum: number, m: any) => sum + (m.content?.length || 0), 0) / userMessages.length
        : 0;
    const engagement = avgUserMsgLen > 100 ? 'alto engajamento' : avgUserMsgLen > 30 ? 'engajamento moderado' : 'respostas curtas';

    // Detect sentiment trend from recent messages
    const lastSentiment = recentUserMessages[recentUserMessages.length - 1]?.sentiment || null;

    let summary = `Conversa com ${messages.length} mensagens (${userMessages.length} do cliente, ${assistantMessages.length} do assistente). ${engagement}.`;

    if (topics.size > 0) {
        summary += ` Tópicos: ${[...topics].join(', ')}.`;
    }
    if (entities.length > 0) {
        summary += ` Dados coletados: ${entities.slice(0, 5).join('; ')}.`;
    }
    if (lastSentiment && lastSentiment !== 'neutral') {
        summary += ` Sentimento recente: ${lastSentiment}.`;
    }

    return summary;
}
