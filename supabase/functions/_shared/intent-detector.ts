/**
 * Intent Detector Module
 * Classifies user messages into intents and extracts entities
 * Part of Phase 1: Core Enhancement
 */

import OpenAI from 'https://esm.sh/openai@4.28.0';

// ============================================================
// TYPES
// ============================================================

export interface ExtractedEntities {
    property_type?: 'apartamento' | 'casa' | 'terreno' | 'comercial' | 'rural';
    price_min?: number;
    price_max?: number;
    bedrooms?: number;
    neighborhood?: string;
    city?: string;
    timeline?: 'imediato' | '3_meses' | '6_meses' | '1_ano' | 'pesquisando';
    financing?: boolean;
    has_family?: boolean;
    name?: string;
    phone?: string;
}

export interface IntentResult {
    primary_intent:
    | 'greeting'
    | 'property_search'
    | 'property_details'
    | 'schedule_visit'
    | 'price_inquiry'
    | 'location_inquiry'
    | 'objection'
    | 'confirmation'
    | 'rejection'
    | 'question'
    | 'farewell'
    | 'transfer_human'
    | 'unclear';
    secondary_intents: string[];
    confidence: number;
    entities: ExtractedEntities;
    sentiment: 'positive' | 'neutral' | 'negative' | 'urgent' | 'frustrated';
    sentiment_confidence: number;
    suggested_action: string | null;
    requires_human: boolean;
}

// ============================================================
// PATTERN MATCHING (Fast path for common patterns)
// ============================================================

const INTENT_PATTERNS: Record<string, RegExp[]> = {
    greeting: [
        /^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|e aí|eai|opa|fala)/i,
        /^(tudo bem|como vai|beleza)/i
    ],
    confirmation: [
        /^(sim|yes|ok|pode ser|combinado|fechado|beleza|perfeito|isso|exato|correto|certo|claro|com certeza|bora|vamos)/i,
        /^(quero|aceito|concordo|pode|tá bom|ta bom|show|massa)/i
    ],
    rejection: [
        /^(não|nao|no|nunca|nem|nada|desisto|cancel|deixa|esquece)/i,
        /^(não quero|nao quero|sem interesse|não tenho interesse)/i
    ],
    farewell: [
        /^(tchau|bye|até mais|ate mais|até logo|ate logo|valeu|obrigad[oa]|flw|falou)/i
    ],
    transfer_human: [
        /(falar com|atendente|humano|pessoa|corretor|vendedor|gerente)/i,
        /(não é robô|nao e robo|pessoa real|gente de verdade)/i
    ],
    price_inquiry: [
        /(quanto custa|qual o valor|qual o preço|qual o preco|preço|valor|custo|investimento)/i,
        /(faixa de preço|condições de pagamento|financiamento|entrada|parcela)/i
    ],
    schedule_visit: [
        /(visitar|conhecer pessoalmente|ir ver|marcar visita|agendar|quero ver|posso ver)/i,
        /(quando posso|disponibilidade|horário disponível|horario disponivel)/i
    ],
    property_search: [
        /(procur|quer|precis|busc).*(apartamento|casa|imóvel|imovel|terreno)/i,
        /(tem algo|tem algum|opções|opcoes|sugestões|sugestoes)/i,
        /(me mostr|me indica|me recomend)/i
    ],
    objection: [
        /(muito caro|não tenho|nao tenho|fora do orçamento|fora do orcamento|não posso|nao posso)/i,
        /(preciso pensar|vou pensar|deixa eu ver|depois eu|vou decidir)/i,
        /(meu marido|minha esposa|minha família|minha familia|cônjuge|conjuge)/i,
        /(já tenho corretor|ja tenho corretor|outro corretor|imobiliária|imobiliaria)/i,
        /(não agora|nao agora|ainda não|ainda nao|não é hora|nao e hora)/i
    ]
};

const ENTITY_PATTERNS = {
    property_type: [
        { pattern: /apartamento/i, value: 'apartamento' as const },
        { pattern: /casa/i, value: 'casa' as const },
        { pattern: /terreno/i, value: 'terreno' as const },
        { pattern: /(sala comercial|loja|galpão|galpao)/i, value: 'comercial' as const },
        { pattern: /(sítio|sitio|fazenda|chácara|chacara)/i, value: 'rural' as const }
    ],
    price: [
        { pattern: /(\d+(?:\.\d+)?)\s*(?:mil|k)/i, multiplier: 1000 },
        { pattern: /(\d+(?:,\d+)?)\s*(?:milhão|milhao|mi|m)/i, multiplier: 1000000 },
        { pattern: /R\$\s*(\d+(?:\.\d{3})*(?:,\d{2})?)/i, multiplier: 1 }
    ],
    bedrooms: [
        { pattern: /(\d+)\s*(?:quartos?|dormitórios?|dormitorios?|suítes?|suites?)/i }
    ],
    timeline: [
        { pattern: /(agora|imediato|urgente|essa semana|esse mês|esse mes)/i, value: 'imediato' as const },
        { pattern: /(próximos? 3 meses|proximos? 3 meses|três meses|tres meses)/i, value: '3_meses' as const },
        { pattern: /(6 meses|seis meses|semestre)/i, value: '6_meses' as const },
        { pattern: /(1 ano|um ano|próximo ano|proximo ano|ano que vem)/i, value: '1_ano' as const },
        { pattern: /(só pesquisando|so pesquisando|ainda pesquisando|só olhando|so olhando)/i, value: 'pesquisando' as const }
    ],
    financing: [
        { pattern: /(financ|mcmv|minha casa|caixa|banco|parcela|entrada)/i, value: true }
    ]
};

const SENTIMENT_PATTERNS = {
    positive: [
        /😊|😀|🙂|👍|❤️|💚|🎉|perfeito|ótimo|otimo|maravilh|excelente|adorei|amei|show|massa|arretado/i
    ],
    negative: [
        /😞|😠|😡|👎|péssimo|pessimo|horrível|horrivel|ruim|não gostei|nao gostei|decepcion/i
    ],
    urgent: [
        /urgente|preciso agora|o quanto antes|imediato|não pode esperar|nao pode esperar|hoje|amanhã|amanha/i
    ],
    frustrated: [
        /já falei|ja falei|de novo|quantas vezes|não entende|nao entende|cansad|irritad|chateado/i,
        /🙄|😤|não acredito|nao acredito|absurdo|impossível|impossivel/i
    ]
};

// ============================================================
// MAIN FUNCTIONS
// ============================================================

/**
 * Detect intent using pattern matching (fast path)
 */
export function detectIntentFast(text: string): Partial<IntentResult> {
    const normalizedText = text.trim().toLowerCase();

    // Check patterns
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(normalizedText)) {
                return {
                    primary_intent: intent as IntentResult['primary_intent'],
                    confidence: 0.85,
                    entities: extractEntities(text),
                    sentiment: detectSentimentFast(text),
                    sentiment_confidence: 0.8
                };
            }
        }
    }

    return {
        primary_intent: 'unclear',
        confidence: 0.3,
        entities: extractEntities(text),
        sentiment: detectSentimentFast(text),
        sentiment_confidence: 0.6
    };
}

/**
 * Extract entities from text using patterns
 */
export function extractEntities(text: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Property type
    for (const { pattern, value } of ENTITY_PATTERNS.property_type) {
        if (pattern.test(text)) {
            entities.property_type = value;
            break;
        }
    }

    // Price extraction
    for (const { pattern, multiplier } of ENTITY_PATTERNS.price) {
        const match = text.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(/\./g, '').replace(',', '.')) * multiplier;
            // Determine if it's min or max based on context
            if (/até|ate|máximo|maximo|no máximo|no maximo/i.test(text)) {
                entities.price_max = value;
            } else if (/partir|mínimo|minimo|acima/i.test(text)) {
                entities.price_min = value;
            } else {
                entities.price_max = value; // Default to max
            }
        }
    }

    // Bedrooms
    for (const { pattern } of ENTITY_PATTERNS.bedrooms) {
        const match = text.match(pattern);
        if (match) {
            entities.bedrooms = parseInt(match[1]);
            break;
        }
    }

    // Timeline
    for (const { pattern, value } of ENTITY_PATTERNS.timeline) {
        if (pattern.test(text)) {
            entities.timeline = value;
            break;
        }
    }

    // Financing
    for (const { pattern, value } of ENTITY_PATTERNS.financing) {
        if (pattern.test(text)) {
            entities.financing = value;
            break;
        }
    }

    return entities;
}

/**
 * Fast sentiment detection using patterns
 */
export function detectSentimentFast(text: string): IntentResult['sentiment'] {
    // Check frustrated first (highest priority)
    for (const pattern of SENTIMENT_PATTERNS.frustrated) {
        if (pattern.test(text)) return 'frustrated';
    }

    // Check urgent
    for (const pattern of SENTIMENT_PATTERNS.urgent) {
        if (pattern.test(text)) return 'urgent';
    }

    // Check negative
    for (const pattern of SENTIMENT_PATTERNS.negative) {
        if (pattern.test(text)) return 'negative';
    }

    // Check positive
    for (const pattern of SENTIMENT_PATTERNS.positive) {
        if (pattern.test(text)) return 'positive';
    }

    return 'neutral';
}

/**
 * Enhanced intent detection using LLM (slow path, for complex cases)
 */
export async function detectIntentLLM(
    openai: OpenAI,
    text: string,
    conversationContext?: string
): Promise<IntentResult> {
    const prompt = `Analise esta mensagem de um cliente interessado em imóveis e extraia:

MENSAGEM: "${text}"
${conversationContext ? `CONTEXTO DA CONVERSA: ${conversationContext}` : ''}

Responda APENAS com JSON válido no formato:
{
  "primary_intent": "greeting|property_search|property_details|schedule_visit|price_inquiry|location_inquiry|objection|confirmation|rejection|question|farewell|transfer_human|unclear",
  "secondary_intents": [],
  "confidence": 0.0-1.0,
  "entities": {
    "property_type": "apartamento|casa|terreno|comercial|rural|null",
    "price_min": number|null,
    "price_max": number|null,
    "bedrooms": number|null,
    "neighborhood": "string|null",
    "timeline": "imediato|3_meses|6_meses|1_ano|pesquisando|null",
    "financing": boolean|null
  },
  "sentiment": "positive|neutral|negative|urgent|frustrated",
  "sentiment_confidence": 0.0-1.0,
  "suggested_action": "string|null",
  "requires_human": boolean
}`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Você é um classificador de intenções para um chatbot imobiliário. Responda APENAS com JSON válido.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.1
        });

        const response = completion.choices[0]?.message?.content || '{}';
        const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();

        return JSON.parse(cleaned) as IntentResult;
    } catch (error) {
        console.error('Error in LLM intent detection:', error);
        // Fallback to fast detection
        const fastResult = detectIntentFast(text);
        return {
            primary_intent: fastResult.primary_intent || 'unclear',
            secondary_intents: [],
            confidence: fastResult.confidence || 0.5,
            entities: fastResult.entities || {},
            sentiment: fastResult.sentiment || 'neutral',
            sentiment_confidence: fastResult.sentiment_confidence || 0.5,
            suggested_action: null,
            requires_human: false
        };
    }
}

/**
 * Determine if message requires human handoff
 */
export function shouldTransferToHuman(intent: IntentResult, messageCount: number): boolean {
    // Direct request for human
    if (intent.primary_intent === 'transfer_human') return true;

    // Frustrated after multiple messages
    if (intent.sentiment === 'frustrated' && messageCount > 5) return true;

    // Low confidence after many attempts
    if (intent.primary_intent === 'unclear' && intent.confidence < 0.4 && messageCount > 3) return true;

    // Explicit human requirement flag
    if (intent.requires_human) return true;

    return false;
}

/**
 * Get suggested response based on intent
 */
export function getSuggestedResponse(intent: IntentResult): string | null {
    const suggestions: Record<string, string> = {
        greeting: 'Respond with a warm greeting and ask about their property interests',
        property_search: 'Ask clarifying questions about property preferences or search properties',
        schedule_visit: 'Offer available times and confirm property interest',
        objection: 'Address the objection with empathy and provide counter-points',
        price_inquiry: 'Provide price range and highlight financing options',
        farewell: 'Thank them and leave door open for future contact',
        unclear: 'Ask a clarifying question about their needs'
    };

    return suggestions[intent.primary_intent] || null;
}
