/**
 * BANT Scorer Module
 * Budget, Authority, Need, Timeline scoring for lead qualification
 * Part of Phase 2: Advanced Qualification
 */

// ============================================================
// TYPES
// ============================================================

export interface BANTScores {
    budget: number;      // 0-25 points
    authority: number;   // 0-20 points
    need: number;        // 0-30 points
    timeline: number;    // 0-25 points
    total: number;       // 0-100 points
    temperature: 'hot' | 'warm' | 'cool' | 'cold';
}

export interface BANTDetails {
    budget: BudgetDetails;
    authority: AuthorityDetails;
    need: NeedDetails;
    timeline: TimelineDetails;
}

export interface BudgetDetails {
    has_defined_budget: boolean;
    min_value?: number;
    max_value?: number;
    financing_needed?: boolean;
    has_down_payment?: boolean;
    down_payment_percentage?: number;
    pre_approved?: boolean;
}

export interface AuthorityDetails {
    is_decision_maker: boolean;
    needs_spouse_approval?: boolean;
    needs_family_approval?: boolean;
    other_stakeholders?: string[];
    stakeholders_aligned?: boolean;
}

export interface NeedDetails {
    property_type?: string;
    min_bedrooms?: number;
    preferred_neighborhoods?: string[];
    must_have_features?: string[];
    nice_to_have_features?: string[];
    deal_breakers?: string[];
    reason_for_moving?: string;
    need_clarity_score: number; // 0-100
}

export interface TimelineDetails {
    urgency: 'immediate' | '3_months' | '6_months' | '1_year' | 'researching' | 'unknown';
    has_deadline?: boolean;
    deadline_reason?: string;
    current_living_situation?: string;
    lease_ending?: boolean;
    actively_visiting?: boolean;
}

export interface QualificationData {
    property_type?: string;
    min_price?: number;
    max_price?: number;
    min_bedrooms?: number;
    preferred_neighborhoods?: string[];
    urgency?: string;
    financing_needed?: boolean;
    decision_maker?: boolean;
    has_family?: boolean;
    timeline?: string;
    // Extended fields from entity extraction
    bedrooms?: number;
    price_max?: number;
    price_min?: number;
    neighborhood?: string;
}

// ============================================================
// SCORING WEIGHTS
// ============================================================

const WEIGHTS = {
    budget: {
        max: 25,
        criteria: {
            has_defined_budget: 10,
            reasonable_range: 5,      // Within market prices
            financing_clear: 5,       // Knows if needs financing
            pre_approved: 5           // Has pre-approval or down payment ready
        }
    },
    authority: {
        max: 20,
        criteria: {
            is_decision_maker: 10,
            stakeholders_identified: 5,
            stakeholders_aligned: 5
        }
    },
    need: {
        max: 30,
        criteria: {
            property_type_defined: 8,
            bedrooms_defined: 6,
            location_defined: 8,
            features_identified: 4,
            clear_motivation: 4
        }
    },
    timeline: {
        max: 25,
        criteria: {
            urgency_defined: 10,
            actively_searching: 8,
            deadline_exists: 7
        }
    }
};

// ============================================================
// MAIN SCORING FUNCTIONS
// ============================================================

/**
 * Calculate complete BANT score from qualification data
 */
export function calculateBANTScore(
    qualData: QualificationData,
    details?: Partial<BANTDetails>
): BANTScores {
    const budget = calculateBudgetScore(qualData, details?.budget);
    const authority = calculateAuthorityScore(qualData, details?.authority);
    const need = calculateNeedScore(qualData, details?.need);
    const timeline = calculateTimelineScore(qualData, details?.timeline);

    const total = budget + authority + need + timeline;
    const temperature = getTemperature(total);

    return { budget, authority, need, timeline, total, temperature };
}

/**
 * Calculate Budget score (0-25 points)
 */
export function calculateBudgetScore(
    qualData: QualificationData,
    details?: BudgetDetails
): number {
    let score = 0;
    const criteria = WEIGHTS.budget.criteria;

    // Has defined budget (10 pts)
    if (qualData.max_price || qualData.min_price || qualData.price_max || qualData.price_min) {
        score += criteria.has_defined_budget;
    }

    // Reasonable range - within typical market (5 pts)
    const maxPrice = qualData.max_price || qualData.price_max;
    if (maxPrice && maxPrice >= 150000 && maxPrice <= 5000000) {
        score += criteria.reasonable_range;
    }

    // Financing clarity (5 pts)
    if (qualData.financing_needed !== undefined) {
        score += criteria.financing_clear;
    }

    // Pre-approved or has down payment (5 pts)
    if (details?.pre_approved || details?.has_down_payment) {
        score += criteria.pre_approved;
    }

    return Math.min(score, WEIGHTS.budget.max);
}

/**
 * Calculate Authority score (0-20 points)
 */
export function calculateAuthorityScore(
    qualData: QualificationData,
    details?: AuthorityDetails
): number {
    let score = 0;
    const criteria = WEIGHTS.authority.criteria;

    // Is decision maker (10 pts)
    if (qualData.decision_maker === true) {
        score += criteria.is_decision_maker;
    } else if (qualData.decision_maker === false) {
        // Not decision maker but identified stakeholders (5 pts partial)
        score += 5;
    }

    // Stakeholders identified (5 pts)
    if (qualData.has_family !== undefined || details?.needs_spouse_approval !== undefined) {
        score += criteria.stakeholders_identified;
    }

    // Stakeholders aligned (5 pts)
    if (details?.stakeholders_aligned) {
        score += criteria.stakeholders_aligned;
    }

    return Math.min(score, WEIGHTS.authority.max);
}

/**
 * Calculate Need score (0-30 points)
 */
export function calculateNeedScore(
    qualData: QualificationData,
    details?: NeedDetails
): number {
    let score = 0;
    const criteria = WEIGHTS.need.criteria;

    // Property type defined (8 pts)
    if (qualData.property_type) {
        score += criteria.property_type_defined;
    }

    // Bedrooms defined (6 pts)
    if (qualData.min_bedrooms || qualData.bedrooms) {
        score += criteria.bedrooms_defined;
    }

    // Location defined (8 pts)
    const neighborhoods = qualData.preferred_neighborhoods ||
        (qualData.neighborhood ? [qualData.neighborhood] : []);
    if (neighborhoods.length > 0) {
        score += criteria.location_defined;
    }

    // Features identified (4 pts)
    if (details?.must_have_features?.length || details?.nice_to_have_features?.length) {
        score += criteria.features_identified;
    }

    // Clear motivation (4 pts)
    if (details?.reason_for_moving) {
        score += criteria.clear_motivation;
    }

    return Math.min(score, WEIGHTS.need.max);
}

/**
 * Calculate Timeline score (0-25 points)
 */
export function calculateTimelineScore(
    qualData: QualificationData,
    details?: TimelineDetails
): number {
    let score = 0;
    const criteria = WEIGHTS.timeline.criteria;

    // Urgency defined (10 pts)
    const urgency = qualData.urgency || qualData.timeline || details?.urgency;
    if (urgency && urgency !== 'unknown') {
        score += criteria.urgency_defined;

        // Bonus for high urgency
        if (urgency === 'immediate' || urgency === 'imediato') {
            score += 5;
        } else if (urgency === '3_months' || urgency === '3_meses') {
            score += 3;
        }
    }

    // Actively searching (8 pts)
    if (details?.actively_visiting) {
        score += criteria.actively_searching;
    }

    // Has deadline (7 pts)
    if (details?.has_deadline || details?.lease_ending) {
        score += criteria.deadline_exists;
    }

    return Math.min(score, WEIGHTS.timeline.max);
}

/**
 * Get temperature classification based on total score
 */
export function getTemperature(totalScore: number): 'hot' | 'warm' | 'cool' | 'cold' {
    if (totalScore >= 80) return 'hot';
    if (totalScore >= 60) return 'warm';
    if (totalScore >= 40) return 'cool';
    return 'cold';
}

/**
 * Get temperature emoji and label
 */
export function getTemperatureDisplay(temperature: string): { emoji: string; label: string; color: string } {
    const displays: Record<string, { emoji: string; label: string; color: string }> = {
        hot: { emoji: '🔥', label: 'Hot Lead', color: 'red' },
        warm: { emoji: '🌡️', label: 'Warm Lead', color: 'orange' },
        cool: { emoji: '❄️', label: 'Cool Lead', color: 'blue' },
        cold: { emoji: '🧊', label: 'Cold Lead', color: 'gray' }
    };
    return displays[temperature] || displays.cold;
}

/**
 * Get next recommended question based on missing BANT data
 */
export function getNextBANTQuestion(qualData: QualificationData): {
    category: 'budget' | 'authority' | 'need' | 'timeline';
    question: string;
    priority: number;
} | null {
    // Priority: Need > Budget > Timeline > Authority

    // Check Need (highest priority - we need to know what they want)
    if (!qualData.property_type) {
        return {
            category: 'need',
            question: 'Você está procurando um apartamento, casa ou terreno?',
            priority: 1
        };
    }

    if (!qualData.min_bedrooms && !qualData.bedrooms) {
        return {
            category: 'need',
            question: 'Quantos quartos você precisa no mínimo?',
            priority: 2
        };
    }

    // Check Budget
    if (!qualData.max_price && !qualData.price_max) {
        return {
            category: 'budget',
            question: 'Qual faixa de valor você está considerando para o imóvel?',
            priority: 3
        };
    }

    if (qualData.financing_needed === undefined) {
        return {
            category: 'budget',
            question: 'Você pretende financiar ou comprar à vista?',
            priority: 4
        };
    }

    // Check Timeline
    if (!qualData.urgency && !qualData.timeline) {
        return {
            category: 'timeline',
            question: 'Para quando você pretende fazer a mudança?',
            priority: 5
        };
    }

    // Check Authority
    if (qualData.decision_maker === undefined) {
        return {
            category: 'authority',
            question: 'A decisão será tomada por você ou tem mais alguém envolvido?',
            priority: 6
        };
    }

    // All basic BANT collected
    return null;
}

/**
 * Update BANT details from extracted entities
 */
export function updateBANTFromEntities(
    currentDetails: Partial<BANTDetails>,
    entities: Record<string, any>
): BANTDetails {
    const details: BANTDetails = {
        budget: currentDetails.budget || { has_defined_budget: false },
        authority: currentDetails.authority || { is_decision_maker: false },
        need: currentDetails.need || { need_clarity_score: 0 },
        timeline: currentDetails.timeline || { urgency: 'unknown' }
    };

    // Update from entities
    if (entities.price_max || entities.max_price) {
        details.budget.has_defined_budget = true;
        details.budget.max_value = entities.price_max || entities.max_price;
    }

    if (entities.price_min || entities.min_price) {
        details.budget.has_defined_budget = true;
        details.budget.min_value = entities.price_min || entities.min_price;
    }

    if (entities.financing !== undefined) {
        details.budget.financing_needed = entities.financing;
    }

    if (entities.property_type) {
        details.need.property_type = entities.property_type;
    }

    if (entities.bedrooms) {
        details.need.min_bedrooms = entities.bedrooms;
    }

    if (entities.neighborhood) {
        details.need.preferred_neighborhoods = [entities.neighborhood];
    }

    if (entities.timeline) {
        details.timeline.urgency = entities.timeline;
    }

    // Calculate need clarity
    let clarityPoints = 0;
    if (details.need.property_type) clarityPoints += 30;
    if (details.need.min_bedrooms) clarityPoints += 20;
    if (details.need.preferred_neighborhoods?.length) clarityPoints += 30;
    if (details.need.must_have_features?.length) clarityPoints += 20;
    details.need.need_clarity_score = clarityPoints;

    return details;
}

/**
 * Get qualification completion percentage
 */
export function getQualificationProgress(qualData: QualificationData): {
    percentage: number;
    missing: string[];
} {
    const required = [
        { key: 'property_type', label: 'Tipo de imóvel' },
        { key: 'bedrooms', label: 'Número de quartos', alt: 'min_bedrooms' },
        { key: 'price_max', label: 'Orçamento', alt: 'max_price' },
        { key: 'urgency', label: 'Prazo', alt: 'timeline' },
        { key: 'financing_needed', label: 'Financiamento' },
        { key: 'decision_maker', label: 'Decisor' }
    ];

    const missing: string[] = [];
    let collected = 0;

    for (const field of required) {
        const value = qualData[field.key as keyof QualificationData];
        const altValue = field.alt ? qualData[field.alt as keyof QualificationData] : undefined;

        if (value !== undefined && value !== null) {
            collected++;
        } else if (altValue !== undefined && altValue !== null) {
            collected++;
        } else {
            missing.push(field.label);
        }
    }

    return {
        percentage: Math.round((collected / required.length) * 100),
        missing
    };
}
