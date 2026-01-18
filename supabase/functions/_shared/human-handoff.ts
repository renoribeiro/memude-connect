/**
 * Human Handoff Module
 * Prepares context for seamless transfer to human agents
 * Part of Phase 3: Engagement Excellence
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// TYPES
// ============================================================

export interface HandoffContext {
    summary: string;
    lead_info: LeadInfo;
    qualification: QualificationSummary;
    conversation_highlights: ConversationHighlight[];
    properties_shown: PropertyShown[];
    objections: string[];
    recommended_actions: string[];
    urgency_level: 'high' | 'medium' | 'low';
    handoff_reason: string;
}

export interface LeadInfo {
    name: string | null;
    phone: string;
    first_contact: string;
    total_messages: number;
    conversation_duration: string;
}

export interface QualificationSummary {
    bant_score: number;
    temperature: string;
    budget_range: string | null;
    property_type: string | null;
    bedrooms: number | null;
    neighborhoods: string[];
    timeline: string | null;
    financing: boolean | null;
    is_decision_maker: boolean | null;
}

export interface ConversationHighlight {
    timestamp: string;
    type: 'interest' | 'objection' | 'question' | 'request';
    content: string;
}

export interface PropertyShown {
    id: string;
    name: string;
    price_range: string;
    interest_level: 'high' | 'medium' | 'low' | 'unknown';
}

// ============================================================
// MAIN FUNCTIONS
// ============================================================

/**
 * Build complete handoff context for human agent
 */
export async function buildHandoffContext(
    supabase: SupabaseClient,
    conversationId: string,
    handoffReason: string
): Promise<HandoffContext> {
    // Fetch all necessary data
    const [conversation, messages, qualification] = await Promise.all([
        fetchConversation(supabase, conversationId),
        fetchRecentMessages(supabase, conversationId, 20),
        fetchQualification(supabase, conversationId)
    ]);

    // Build lead info
    const leadInfo = buildLeadInfo(conversation, messages);

    // Build qualification summary
    const qualificationSummary = buildQualificationSummary(qualification, conversation);

    // Extract conversation highlights
    const highlights = extractHighlights(messages);

    // Build properties shown
    const propertiesShown = await buildPropertiesShown(
        supabase,
        conversation?.presented_properties || []
    );

    // Extract objections
    const objections = extractObjections(messages);

    // Generate recommended actions
    const recommendedActions = generateRecommendedActions(
        qualificationSummary,
        objections,
        propertiesShown
    );

    // Determine urgency
    const urgencyLevel = determineUrgency(qualificationSummary, messages, objections);

    // Generate summary
    const summary = generateSummary(
        leadInfo,
        qualificationSummary,
        propertiesShown,
        objections
    );

    return {
        summary,
        lead_info: leadInfo,
        qualification: qualificationSummary,
        conversation_highlights: highlights,
        properties_shown: propertiesShown,
        objections,
        recommended_actions: recommendedActions,
        urgency_level: urgencyLevel,
        handoff_reason: handoffReason
    };
}

/**
 * Format handoff context as notification message
 */
export function formatHandoffMessage(context: HandoffContext): string {
    const urgencyEmoji = {
        high: '🚨',
        medium: '⚠️',
        low: 'ℹ️'
    }[context.urgency_level];

    const tempEmoji = {
        hot: '🔥',
        warm: '🌡️',
        cool: '❄️',
        cold: '🧊'
    }[context.qualification.temperature] || '❓';

    let msg = `${urgencyEmoji} *TRANSFERÊNCIA DE ATENDIMENTO*\n\n`;
    msg += `📱 *Lead:* ${context.lead_info.name || 'Não informado'}\n`;
    msg += `📞 *Telefone:* ${context.lead_info.phone}\n`;
    msg += `${tempEmoji} *BANT Score:* ${context.qualification.bant_score}/100 (${context.qualification.temperature})\n\n`;

    msg += `*Motivo da Transferência:*\n${context.handoff_reason}\n\n`;

    msg += `*Resumo:*\n${context.summary}\n\n`;

    if (context.qualification.budget_range) {
        msg += `💰 *Orçamento:* ${context.qualification.budget_range}\n`;
    }
    if (context.qualification.property_type) {
        msg += `🏠 *Busca:* ${context.qualification.property_type}`;
        if (context.qualification.bedrooms) {
            msg += ` (${context.qualification.bedrooms}+ quartos)`;
        }
        msg += '\n';
    }
    if (context.qualification.neighborhoods.length > 0) {
        msg += `📍 *Bairros:* ${context.qualification.neighborhoods.join(', ')}\n`;
    }
    if (context.qualification.timeline) {
        msg += `⏰ *Prazo:* ${context.qualification.timeline}\n`;
    }

    if (context.objections.length > 0) {
        msg += `\n⚠️ *Objeções Identificadas:*\n`;
        context.objections.forEach(o => {
            msg += `• ${o}\n`;
        });
    }

    if (context.properties_shown.length > 0) {
        msg += `\n🏢 *Imóveis Apresentados:*\n`;
        context.properties_shown.forEach(p => {
            const interest = p.interest_level === 'high' ? '⭐' : p.interest_level === 'medium' ? '👍' : '';
            msg += `• ${p.name} - ${p.price_range} ${interest}\n`;
        });
    }

    msg += `\n✅ *Próximos Passos Sugeridos:*\n`;
    context.recommended_actions.forEach(a => {
        msg += `• ${a}\n`;
    });

    msg += `\n📊 *Conversa:* ${context.lead_info.total_messages} msgs em ${context.lead_info.conversation_duration}`;

    return msg;
}

/**
 * Format handoff as compact JSON for storage
 */
export function formatHandoffForStorage(context: HandoffContext): Record<string, any> {
    return {
        handoff_reason: context.handoff_reason,
        urgency: context.urgency_level,
        bant_score: context.qualification.bant_score,
        temperature: context.qualification.temperature,
        objections_count: context.objections.length,
        properties_shown: context.properties_shown.length,
        summary: context.summary,
        created_at: new Date().toISOString()
    };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function fetchConversation(supabase: SupabaseClient, conversationId: string) {
    const { data } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
    return data;
}

async function fetchRecentMessages(supabase: SupabaseClient, conversationId: string, limit: number) {
    const { data } = await supabase
        .from('agent_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);
    return data || [];
}

async function fetchQualification(supabase: SupabaseClient, conversationId: string) {
    const { data } = await supabase
        .from('ai_lead_qualification')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();
    return data;
}

function buildLeadInfo(conversation: any, messages: any[]): LeadInfo {
    const firstMessage = messages[0];
    const now = new Date();
    const start = new Date(conversation?.started_at || firstMessage?.created_at || now);
    const durationMs = now.getTime() - start.getTime();
    const durationMins = Math.floor(durationMs / 60000);

    let duration: string;
    if (durationMins < 60) {
        duration = `${durationMins} min`;
    } else if (durationMins < 1440) {
        duration = `${Math.floor(durationMins / 60)}h ${durationMins % 60}min`;
    } else {
        duration = `${Math.floor(durationMins / 1440)} dias`;
    }

    return {
        name: conversation?.customer_name || null,
        phone: conversation?.phone_number || 'N/A',
        first_contact: start.toISOString(),
        total_messages: conversation?.total_messages || messages.length,
        conversation_duration: duration
    };
}

function buildQualificationSummary(qualification: any, conversation: any): QualificationSummary {
    const qualData = conversation?.qualification_data || {};

    let budgetRange: string | null = null;
    const maxPrice = qualification?.max_price || qualData.max_price || qualData.price_max;
    const minPrice = qualification?.min_price || qualData.min_price || qualData.price_min;
    if (maxPrice) {
        const formatPrice = (v: number) => v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` : `R$ ${(v / 1000).toFixed(0)}k`;
        if (minPrice) {
            budgetRange = `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;
        } else {
            budgetRange = `Até ${formatPrice(maxPrice)}`;
        }
    }

    return {
        bant_score: qualification?.bant_total_score || conversation?.lead_score || 0,
        temperature: qualification?.lead_temperature || 'cold',
        budget_range: budgetRange,
        property_type: qualification?.property_type || qualData.property_type || null,
        bedrooms: qualification?.min_bedrooms || qualData.min_bedrooms || qualData.bedrooms || null,
        neighborhoods: qualification?.preferred_neighborhoods || qualData.preferred_neighborhoods || [],
        timeline: qualification?.urgency || qualData.urgency || qualData.timeline || null,
        financing: qualification?.financing_needed ?? qualData.financing_needed ?? qualData.financing ?? null,
        is_decision_maker: qualification?.decision_maker ?? qualData.decision_maker ?? null
    };
}

function extractHighlights(messages: any[]): ConversationHighlight[] {
    const highlights: ConversationHighlight[] = [];

    const interestPatterns = /interessante|gostei|quero|adorei|perfeito|massa|show/i;
    const objectionPatterns = /muito caro|não posso|preciso pensar|meu marido|minha esposa|não agora/i;
    const questionPatterns = /\?|como|quando|quanto|onde|qual/i;
    const requestPatterns = /visitar|agendar|ver|conhecer|marcar/i;

    for (const msg of messages) {
        if (msg.role !== 'user') continue;

        let type: ConversationHighlight['type'] | null = null;

        if (requestPatterns.test(msg.content)) {
            type = 'request';
        } else if (objectionPatterns.test(msg.content)) {
            type = 'objection';
        } else if (interestPatterns.test(msg.content)) {
            type = 'interest';
        } else if (questionPatterns.test(msg.content)) {
            type = 'question';
        }

        if (type) {
            highlights.push({
                timestamp: msg.created_at,
                type,
                content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')
            });
        }
    }

    return highlights.slice(-5); // Last 5 highlights
}

async function buildPropertiesShown(
    supabase: SupabaseClient,
    propertyIds: string[]
): Promise<PropertyShown[]> {
    if (!propertyIds || propertyIds.length === 0) return [];

    const { data } = await supabase
        .from('empreendimentos')
        .select('id, nome, valor_min, valor_max')
        .in('id', propertyIds.slice(0, 5));

    if (!data) return [];

    return data.map(p => {
        const formatPrice = (v: number) => v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` : `R$ ${(v / 1000).toFixed(0)}k`;
        let priceRange = 'Consulte';
        if (p.valor_min && p.valor_max) {
            priceRange = `${formatPrice(p.valor_min)} - ${formatPrice(p.valor_max)}`;
        } else if (p.valor_max) {
            priceRange = `Até ${formatPrice(p.valor_max)}`;
        }

        return {
            id: p.id,
            name: p.nome,
            price_range: priceRange,
            interest_level: 'unknown' as const
        };
    });
}

function extractObjections(messages: any[]): string[] {
    const objections: string[] = [];
    const patterns = [
        { pattern: /muito caro|preço alto|fora do orçamento/i, label: 'Preço alto' },
        { pattern: /preciso pensar|vou pensar/i, label: 'Precisa pensar' },
        { pattern: /meu marido|minha esposa|família/i, label: 'Decisão em família' },
        { pattern: /não agora|ainda não|momento errado/i, label: 'Timing' },
        { pattern: /já tenho corretor|outra imobiliária/i, label: 'Já tem corretor' },
        { pattern: /longe|localização/i, label: 'Localização' },
        { pattern: /não consigo financiar|crédito/i, label: 'Financiamento' }
    ];

    for (const msg of messages) {
        if (msg.role !== 'user') continue;

        for (const { pattern, label } of patterns) {
            if (pattern.test(msg.content) && !objections.includes(label)) {
                objections.push(label);
            }
        }
    }

    return objections;
}

function generateRecommendedActions(
    qual: QualificationSummary,
    objections: string[],
    properties: PropertyShown[]
): string[] {
    const actions: string[] = [];

    // Based on missing qualification data
    if (!qual.budget_range) {
        actions.push('Confirmar faixa de orçamento');
    }
    if (!qual.timeline) {
        actions.push('Verificar prazo para compra');
    }
    if (qual.is_decision_maker === false) {
        actions.push('Tentar incluir cônjuge/família na conversa');
    }

    // Based on objections
    if (objections.includes('Preço alto')) {
        actions.push('Apresentar opções de financiamento');
    }
    if (objections.includes('Localização')) {
        actions.push('Mostrar benefícios da região');
    }
    if (objections.includes('Financiamento')) {
        actions.push('Encaminhar para análise de crédito');
    }

    // Based on properties
    if (properties.length > 0) {
        actions.push('Agendar visita presencial');
    } else {
        actions.push('Apresentar imóveis compatíveis');
    }

    // Default actions
    if (actions.length === 0) {
        actions.push('Entender melhor as necessidades');
        actions.push('Construir rapport');
    }

    return actions.slice(0, 4);
}

function determineUrgency(
    qual: QualificationSummary,
    messages: any[],
    objections: string[]
): 'high' | 'medium' | 'low' {
    // Hot lead or high BANT = high urgency
    if (qual.temperature === 'hot' || qual.bant_score >= 70) {
        return 'high';
    }

    // Trust or financing issues = high urgency (need human)
    if (objections.includes('Financiamento')) {
        return 'high';
    }

    // Warm lead = medium
    if (qual.temperature === 'warm' || qual.bant_score >= 50) {
        return 'medium';
    }

    return 'low';
}

function generateSummary(
    lead: LeadInfo,
    qual: QualificationSummary,
    properties: PropertyShown[],
    objections: string[]
): string {
    const parts: string[] = [];

    // Lead intro
    parts.push(`Lead ${lead.name ? `"${lead.name}"` : 'anônimo'} em conversa há ${lead.conversation_duration}.`);

    // Interest
    if (qual.property_type) {
        let interest = `Busca ${qual.property_type}`;
        if (qual.bedrooms) interest += ` com ${qual.bedrooms}+ quartos`;
        if (qual.neighborhoods.length > 0) interest += ` em ${qual.neighborhoods.slice(0, 2).join('/')}`;
        parts.push(interest + '.');
    }

    // Budget
    if (qual.budget_range) {
        parts.push(`Orçamento: ${qual.budget_range}.`);
    }

    // Properties
    if (properties.length > 0) {
        parts.push(`${properties.length} imóveis apresentados.`);
    }

    // Objections
    if (objections.length > 0) {
        parts.push(`Objeções: ${objections.join(', ')}.`);
    }

    return parts.join(' ');
}
