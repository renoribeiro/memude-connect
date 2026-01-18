/**
 * Objection Handler Module
 * Detects and suggests responses for common real estate objections
 * Part of Phase 3: Engagement Excellence
 */

// ============================================================
// TYPES
// ============================================================

export interface ObjectionResult {
    detected: boolean;
    objection_type: ObjectionType | null;
    confidence: number;
    suggested_response: string | null;
    counter_points: string[];
    follow_up_action: 'address_objection' | 'provide_value' | 'offer_alternative' | 'schedule_callback' | 'none';
    requires_human: boolean;
}

export type ObjectionType =
    | 'price_too_high'
    | 'need_to_think'
    | 'spouse_decision'
    | 'already_has_realtor'
    | 'not_ready'
    | 'bad_timing'
    | 'location_concern'
    | 'financing_concern'
    | 'trust_issue'
    | 'comparison_shopping'
    | 'property_condition'
    | 'other';

// ============================================================
// OBJECTION PATTERNS AND RESPONSES
// ============================================================

interface ObjectionConfig {
    patterns: RegExp[];
    suggested_responses: string[];
    counter_points: string[];
    action: ObjectionResult['follow_up_action'];
    requires_human: boolean;
}

const OBJECTION_DATABASE: Record<ObjectionType, ObjectionConfig> = {
    price_too_high: {
        patterns: [
            /muito caro|preço alto|fora do orçamento|fora do orcamento|não tenho|nao tenho|caro demais/i,
            /acima do (meu )?orçamento|acima do (meu )?orcamento|não posso pagar|nao posso pagar/i,
            /sem condições|sem condicoes|não dá|nao da|impossível|impossivel/i
        ],
        suggested_responses: [
            "Entendo sua preocupação com o valor! 💭 Mas olha, esse empreendimento tem condições especiais de financiamento que podem deixar a parcela bem acessível. Posso te mostrar uma simulação?",
            "Hmm, entendo... Mas sabe o que é legal? A região tá valorizando muito, então é um investimento que tende a crescer. E dá pra negociar condições especiais de entrada!",
            "Sei como é... Mas esse valor inclui várias coisas que normalmente são extras. E tem opções de financiamento em até 35 anos que deixam bem mais tranquilo. Quer simular?"
        ],
        counter_points: [
            "Possibilidade de financiamento em até 35 anos",
            "Valorização da região",
            "Condições especiais de entrada",
            "Itens inclusos que normalmente são extras"
        ],
        action: 'address_objection',
        requires_human: false
    },

    need_to_think: {
        patterns: [
            /preciso pensar|vou pensar|deixa eu ver|depois eu|tenho que pensar/i,
            /vou analisar|preciso analisar|dar uma pensada|refletir/i,
            /não sei ainda|nao sei ainda|ainda não decidi|ainda nao decidi/i
        ],
        suggested_responses: [
            "Claro, entendo que é uma decisão importante! 🤔 Posso te enviar um material completo do empreendimento pra você analisar com calma?",
            "Faz sentido, é uma decisão grande mesmo! Que tal eu te mandar os detalhes por aqui e a gente marca uma visita quando você se sentir pronto(a)?",
            "Tranquilo! Quer que eu te envie mais informações sobre as condições de pagamento pra você avaliar melhor?"
        ],
        counter_points: [
            "Oferecer material informativo",
            "Agendar callback",
            "Destacar urgência sem pressionar",
            "Enviar comparativo de preços da região"
        ],
        action: 'provide_value',
        requires_human: false
    },

    spouse_decision: {
        patterns: [
            /meu marido|minha esposa|meu companheiro|minha companheira|cônjuge|conjuge/i,
            /preciso falar com|tenho que conversar com|minha família|minha familia/i,
            /decisão em conjunto|decisao em conjunto|decidir junto|a dois/i
        ],
        suggested_responses: [
            "Claro, é super importante decidir junto! 👫 Que tal marcarmos uma visita que os dois possam ir? Assim vocês veem pessoalmente!",
            "Faz todo sentido! Posso enviar um tour virtual pra vocês verem juntos? E depois marcamos uma visita presencial!",
            "Entendo perfeitamente! Talvez uma visita no final de semana funcione melhor pra irem juntos, que acha?"
        ],
        counter_points: [
            "Agendar visita para casal",
            "Enviar tour virtual",
            "Disponibilizar horários flexíveis",
            "Oferecer atendimento conjunto"
        ],
        action: 'offer_alternative',
        requires_human: false
    },

    already_has_realtor: {
        patterns: [
            /já tenho corretor|ja tenho corretor|outro corretor|meu corretor/i,
            /imobiliária|imobiliaria|já estou sendo atendido|ja estou sendo atendido/i,
            /outra pessoa|outro profissional|já com alguém|ja com alguem/i
        ],
        suggested_responses: [
            "Que bom que você já está em boas mãos! 😊 Mas olha, esse empreendimento é lançamento exclusivo e tem condições diferenciadas. Posso te passar as informações sem compromisso?",
            "Entendo! Mas como estamos falando de um lançamento, talvez tenha condições especiais que seu corretor não tenha acesso. Posso te contar mais?"
        ],
        counter_points: [
            "Destacar exclusividade do lançamento",
            "Condições especiais de pré-lançamento",
            "Informação sem compromisso"
        ],
        action: 'provide_value',
        requires_human: false
    },

    not_ready: {
        patterns: [
            /não tô pronto|nao to pronto|não estou pronto|nao estou pronto|ainda não|ainda nao/i,
            /não é hora|nao e hora|momento errado|não agora|nao agora/i,
            /talvez depois|mais pra frente|no futuro|outro momento/i
        ],
        suggested_responses: [
            "Tudo bem, sem pressa! 😊 Mas posso te manter informado(a) sobre as novidades? Assim quando chegar a hora certa, você já tem tudo na mão!",
            "Entendo! Mesmo assim, vale a pena conhecer o projeto porque as melhores unidades costumam ir rápido. Posso te enviar as informações sem compromisso?"
        ],
        counter_points: [
            "Cadastro para novidades",
            "FOMO sutil sobre melhores unidades",
            "Informação sem compromisso"
        ],
        action: 'provide_value',
        requires_human: false
    },

    bad_timing: {
        patterns: [
            /péssimo momento|pessimo momento|crise|desemprego|desempregado/i,
            /saindo do emprego|fim de ano|começo de ano|inicio do ano/i,
            /muitos gastos|gastos extras|apertado|difícil|dificil/i
        ],
        suggested_responses: [
            "Entendo, realmente o momento nem sempre ajuda... Mas olha, existem programas de financiamento com carência inicial. Quer que eu te explique como funciona?",
            "Sei como é... Mas às vezes um financiamento bem planejado pode ser até mais barato que aluguel! Posso fazer uma simulação pra você ver?"
        ],
        counter_points: [
            "Programas com carência",
            "Comparativo com aluguel",
            "Planejamento financeiro facilitado"
        ],
        action: 'address_objection',
        requires_human: false
    },

    location_concern: {
        patterns: [
            /longe|distante|localização ruim|localizacao ruim|bairro|região|regiao/i,
            /não gosto (da região|do bairro)|nao gosto (da regiao|do bairro)/i,
            /muito longe do trabalho|transporte|acesso/i
        ],
        suggested_responses: [
            "Hmm, entendo sua preocupação com a localização! 🗺️ Mas você sabia que essa região está recebendo novos investimentos em infraestrutura? Posso te mostrar o que está sendo planejado?",
            "A região realmente tá mudando bastante! Novos comércios, acessos... E por isso os preços ainda estão bons. Quer conhecer pessoalmente?"
        ],
        counter_points: [
            "Investimentos na região",
            "Valorização futura",
            "Novos acessos e comércios"
        ],
        action: 'provide_value',
        requires_human: false
    },

    financing_concern: {
        patterns: [
            /não consigo financiar|nao consigo financiar|nome sujo|restrição|restricao/i,
            /crédito ruim|credito ruim|não tenho entrada|nao tenho entrada|score baixo/i,
            /banco não aprova|banco nao aprova|não sou aprovado|nao sou aprovado/i
        ],
        suggested_responses: [
            "Entendo sua preocupação! 😊 Mas sabia que existem opções de financiamento direto com a construtora? As condições são diferentes dos bancos tradicionais!",
            "Hmm, olha... a gente tem parcerias que facilitam muito a aprovação. Posso te passar pra nossa equipe de crédito analisar? Sem compromisso!"
        ],
        counter_points: [
            "Financiamento direto com construtora",
            "Parcerias para aprovação facilitada",
            "Análise sem compromisso"
        ],
        action: 'address_objection',
        requires_human: true
    },

    trust_issue: {
        patterns: [
            /não confio|nao confio|golpe|fraude|mentira|enganar/i,
            /já fui enganado|ja fui enganado|desconfio|suspeito/i,
            /muita propaganda|vendedor|só quer vender|so quer vender/i
        ],
        suggested_responses: [
            "Entendo totalmente sua cautela! 🙏 A construtora tem X anos de mercado e você pode verificar tudo no registro de imóveis. Posso te enviar os documentos oficiais?",
            "Faz sentido ter cuidado! Por isso sugiro uma visita presencial ao decorado e ao canteiro de obras. Assim você vê tudo com seus próprios olhos!"
        ],
        counter_points: [
            "Documentação oficial",
            "Visita presencial",
            "Histórico da construtora",
            "Registro no cartório"
        ],
        action: 'provide_value',
        requires_human: true
    },

    comparison_shopping: {
        patterns: [
            /estou comparando|to comparando|vendo outros|outras opções|outras opcoes/i,
            /concorrência|concorrencia|outro empreendimento|melhor preço|melhor preco/i,
            /pesquisando mais|vendo mais|conhecendo outros/i
        ],
        suggested_responses: [
            "Ótimo que você está pesquisando bem! 👍 Posso te enviar um comparativo com outros empreendimentos da região? Assim fica mais fácil avaliar!",
            "Faz super sentido comparar! Esse empreendimento tem alguns diferenciais que talvez você não encontre em outros. Quer que eu te mostre?"
        ],
        counter_points: [
            "Enviar comparativo",
            "Destacar diferenciais",
            "Preço por m² competitivo"
        ],
        action: 'provide_value',
        requires_human: false
    },

    property_condition: {
        patterns: [
            /acabamento ruim|qualidade baixa|material fraco|não gostei|nao gostei/i,
            /pequeno demais|muito pequeno|planta ruim|distribuição|distribuicao/i,
            /sem varanda|sem vaga|falta|não tem|nao tem/i
        ],
        suggested_responses: [
            "Entendo! 🤔 Talvez essa unidade específica não seja a ideal. Temos outras opções de planta que podem se encaixar melhor. Quer ver?",
            "Hmm, faz sentido... Posso te mostrar outras tipologias disponíveis? Temos plantas diferentes que talvez atendam melhor suas necessidades!"
        ],
        counter_points: [
            "Outras plantas disponíveis",
            "Possibilidade de personalização",
            "Diferentes tipologias"
        ],
        action: 'offer_alternative',
        requires_human: false
    },

    other: {
        patterns: [],
        suggested_responses: [
            "Entendo seu ponto! 🤔 Me conta mais sobre sua preocupação que vou tentar te ajudar da melhor forma.",
            "Hmm, faz sentido! Vou anotar isso e verificar o que podemos fazer. Posso te retornar com mais informações?"
        ],
        counter_points: [],
        action: 'none',
        requires_human: false
    }
};

// ============================================================
// MAIN FUNCTIONS
// ============================================================

/**
 * Detect objection in user message
 */
export function detectObjection(message: string): ObjectionResult {
    const normalizedMessage = message.toLowerCase().trim();

    for (const [type, config] of Object.entries(OBJECTION_DATABASE)) {
        if (type === 'other') continue;

        for (const pattern of config.patterns) {
            if (pattern.test(normalizedMessage)) {
                const responses = config.suggested_responses;
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];

                return {
                    detected: true,
                    objection_type: type as ObjectionType,
                    confidence: 0.85,
                    suggested_response: randomResponse,
                    counter_points: config.counter_points,
                    follow_up_action: config.action,
                    requires_human: config.requires_human
                };
            }
        }
    }

    return {
        detected: false,
        objection_type: null,
        confidence: 0,
        suggested_response: null,
        counter_points: [],
        follow_up_action: 'none',
        requires_human: false
    };
}

/**
 * Get all counter points for an objection type
 */
export function getCounterPoints(objectionType: ObjectionType): string[] {
    return OBJECTION_DATABASE[objectionType]?.counter_points || [];
}

/**
 * Get a random suggested response for an objection
 */
export function getSuggestedResponse(objectionType: ObjectionType): string {
    const responses = OBJECTION_DATABASE[objectionType]?.suggested_responses || [];
    if (responses.length === 0) return '';
    return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * Build objection context for LLM prompt
 */
export function buildObjectionContext(objection: ObjectionResult): string {
    if (!objection.detected || !objection.objection_type) {
        return '';
    }

    const parts = [
        `## Objeção Detectada: ${objection.objection_type.replace(/_/g, ' ').toUpperCase()}`,
        '',
        '### Pontos para Contornar:',
        ...objection.counter_points.map(p => `- ${p}`),
        '',
        '### Sugestão de Resposta:',
        objection.suggested_response || 'Aborde com empatia e ofereça informações adicionais.',
        '',
        `### Ação Recomendada: ${objection.follow_up_action}`,
        objection.requires_human ? '⚠️ CONSIDERE TRANSFERIR PARA HUMANO' : ''
    ];

    return parts.join('\n');
}

/**
 * Check if objection should trigger human transfer
 */
export function shouldEscalateToHuman(
    objection: ObjectionResult,
    previousObjections: number,
    frustrationLevel: number
): boolean {
    // Always escalate trust issues
    if (objection.objection_type === 'trust_issue') return true;

    // Escalate financing concerns
    if (objection.objection_type === 'financing_concern') return true;

    // Multiple objections in same conversation
    if (previousObjections >= 3) return true;

    // High frustration
    if (frustrationLevel >= 0.7) return true;

    // Objection config says requires human
    if (objection.requires_human) return true;

    return false;
}

/**
 * Log objection for analytics
 */
export function formatObjectionForLog(
    objection: ObjectionResult,
    messageId?: string
): Record<string, any> {
    return {
        detected: objection.detected,
        type: objection.objection_type,
        confidence: objection.confidence,
        action: objection.follow_up_action,
        requires_human: objection.requires_human,
        message_id: messageId,
        timestamp: new Date().toISOString()
    };
}
