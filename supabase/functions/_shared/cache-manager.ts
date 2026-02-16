/**
 * Cache Manager Module
 * Provides caching utilities for reducing LLM costs and improving response times
 * Part of Phase 5: Enterprise Scale
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// TYPES
// ============================================================

export interface CacheConfig {
    ttl_seconds: number;
    is_enabled: boolean;
}

export interface CachedResponse {
    response_text: string;
    tokens_used: number;
    is_fresh: boolean;
}

export interface CacheStats {
    hits: number;
    misses: number;
    hit_rate: number;
}

// In-memory cache for hot data
const memoryCache: Map<string, { value: any; expires: number }> = new Map();

// ============================================================
// MAIN FUNCTIONS
// ============================================================

/**
 * Get cached LLM response
 */
export async function getCachedResponse(
    supabase: SupabaseClient,
    agentId: string,
    queryText: string
): Promise<CachedResponse | null> {
    try {
        // Check memory cache first
        const memKey = `response:${agentId}:${hashQuery(queryText)}`;
        const memCached = getFromMemory(memKey);
        if (memCached) {
            return memCached as CachedResponse;
        }

        // Check database cache
        const { data, error } = await supabase.rpc('get_cached_response', {
            p_agent_id: agentId,
            p_query_text: queryText
        });

        if (error || !data || data.length === 0) {
            return null;
        }

        const cached = data[0] as CachedResponse;

        // Store in memory for faster subsequent access
        if (cached.is_fresh) {
            setInMemory(memKey, cached, 300); // 5 min memory cache
        }

        return cached;
    } catch (e) {
        console.warn('Cache get error:', e);
        return null;
    }
}

/**
 * Store LLM response in cache
 */
export async function setCachedResponse(
    supabase: SupabaseClient,
    agentId: string,
    queryText: string,
    responseText: string,
    tokensUsed: number,
    modelUsed: string,
    ttlSeconds: number = 3600
): Promise<void> {
    try {
        // Store in database
        await supabase.rpc('set_cached_response', {
            p_agent_id: agentId,
            p_query_text: queryText,
            p_response_text: responseText,
            p_tokens_used: tokensUsed,
            p_model_used: modelUsed,
            p_ttl_seconds: ttlSeconds
        });

        // Also store in memory
        const memKey = `response:${agentId}:${hashQuery(queryText)}`;
        setInMemory(memKey, {
            response_text: responseText,
            tokens_used: tokensUsed,
            is_fresh: true
        }, Math.min(ttlSeconds, 300));
    } catch (e) {
        console.warn('Cache set error:', e);
    }
}

/**
 * Get cached embeddings
 */
export async function getCachedEmbedding(
    supabase: SupabaseClient,
    text: string
): Promise<number[] | null> {
    const memKey = `embedding:${hashQuery(text)}`;
    const cached = getFromMemory(memKey);
    if (cached) {
        return cached as number[];
    }
    return null;
}

/**
 * Store embeddings in cache
 */
export function setCachedEmbedding(
    text: string,
    embedding: number[],
    ttlSeconds: number = 86400
): void {
    const memKey = `embedding:${hashQuery(text)}`;
    setInMemory(memKey, embedding, ttlSeconds);
}

/**
 * Get cached property data
 */
export async function getCachedProperty(
    supabase: SupabaseClient,
    propertyId: string
): Promise<any | null> {
    const memKey = `property:${propertyId}`;
    return getFromMemory(memKey);
}

/**
 * Cache property data
 */
export function setCachedProperty(
    propertyId: string,
    data: any,
    ttlSeconds: number = 1800
): void {
    const memKey = `property:${propertyId}`;
    setInMemory(memKey, data, ttlSeconds);
}

/**
 * Invalidate cache by pattern
 */
export function invalidateCache(pattern: string): number {
    let count = 0;
    for (const key of memoryCache.keys()) {
        if (key.includes(pattern)) {
            memoryCache.delete(key);
            count++;
        }
    }
    return count;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
    cleanExpired();
    return {
        size: memoryCache.size,
        keys: Array.from(memoryCache.keys())
    };
}

/**
 * Check if query is cacheable
 */
export function isCacheable(queryText: string, intent: string): boolean {
    // Don't cache personal/specific queries
    const nonCacheablePatterns = [
        /meu nome|minha|nosso|hoje/i,
        /agendar|marcar|reservar/i,
        /telefone|whatsapp|contato/i
    ];

    for (const pattern of nonCacheablePatterns) {
        if (pattern.test(queryText)) {
            return false;
        }
    }

    // AI-09: Cache informational queries — intent names match intent-detector output
    const cacheableIntents = [
        'property_search',
        'property_details',
        'greeting',
        'location_inquiry',
        'price_inquiry',
        'general_question',
        'conversation'
    ];

    return cacheableIntents.includes(intent);
}

/**
 * Get similarity threshold for cache matching
 */
export function shouldUseCache(
    originalQuery: string,
    cachedQuery: string,
    similarity: number = 0.95
): boolean {
    // Simple word-based similarity
    const words1 = new Set(originalQuery.toLowerCase().split(/\s+/));
    const words2 = new Set(cachedQuery.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    const jaccardSimilarity = intersection.size / union.size;

    return jaccardSimilarity >= similarity;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function hashQuery(text: string): string {
    // Simple hash for cache key
    let hash = 0;
    const normalized = text.toLowerCase().trim();
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

function getFromMemory(key: string): any | null {
    const cached = memoryCache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expires) {
        memoryCache.delete(key);
        return null;
    }

    return cached.value;
}

function setInMemory(key: string, value: any, ttlSeconds: number): void {
    // Limit memory cache size
    if (memoryCache.size > 1000) {
        cleanExpired();
        // If still too large, remove oldest
        if (memoryCache.size > 900) {
            const keysToDelete = Array.from(memoryCache.keys()).slice(0, 100);
            keysToDelete.forEach(k => memoryCache.delete(k));
        }
    }

    memoryCache.set(key, {
        value,
        expires: Date.now() + (ttlSeconds * 1000)
    });
}

function cleanExpired(): void {
    const now = Date.now();
    for (const [key, cached] of memoryCache.entries()) {
        if (now > cached.expires) {
            memoryCache.delete(key);
        }
    }
}
