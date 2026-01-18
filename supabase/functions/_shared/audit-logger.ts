/**
 * Audit Logger Module
 * Provides comprehensive audit logging for compliance and security
 * Part of Phase 5: Enterprise Scale
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// TYPES
// ============================================================

export type AuditAction =
    | 'conversation_started'
    | 'conversation_ended'
    | 'message_sent'
    | 'message_received'
    | 'lead_qualified'
    | 'lead_transferred'
    | 'visit_scheduled'
    | 'property_searched'
    | 'agent_config_changed'
    | 'prompt_modified'
    | 'user_login'
    | 'user_logout'
    | 'data_exported'
    | 'data_deleted'
    | 'error_occurred'
    | 'rate_limited'
    | 'api_called';

export type EntityType =
    | 'conversation'
    | 'lead'
    | 'agent'
    | 'message'
    | 'property'
    | 'visit'
    | 'user'
    | 'config'
    | 'system';

export interface AuditLogEntry {
    action: AuditAction;
    entity_type: EntityType;
    entity_id?: string;
    user_id?: string;
    agent_id?: string;
    conversation_id?: string;
    previous_value?: Record<string, any>;
    new_value?: Record<string, any>;
    metadata?: Record<string, any>;
    is_sensitive?: boolean;
}

export interface AuditQuery {
    user_id?: string;
    agent_id?: string;
    conversation_id?: string;
    action?: AuditAction;
    entity_type?: EntityType;
    from_date?: string;
    to_date?: string;
    limit?: number;
}

// ============================================================
// MAIN FUNCTIONS
// ============================================================

/**
 * Write audit log entry
 */
export async function writeAuditLog(
    supabase: SupabaseClient,
    entry: AuditLogEntry
): Promise<string | null> {
    try {
        const { data, error } = await supabase.rpc('write_audit_log', {
            p_action: entry.action,
            p_entity_type: entry.entity_type,
            p_entity_id: entry.entity_id || null,
            p_user_id: entry.user_id || null,
            p_agent_id: entry.agent_id || null,
            p_conversation_id: entry.conversation_id || null,
            p_previous_value: entry.previous_value || null,
            p_new_value: entry.new_value || null,
            p_metadata: entry.metadata || {}
        });

        if (error) {
            console.warn('Audit log write error:', error);
            return null;
        }

        return data as string;
    } catch (e) {
        console.warn('Audit log error:', e);
        return null;
    }
}

/**
 * Write audit log without awaiting (fire and forget)
 */
export function writeAuditLogAsync(
    supabase: SupabaseClient,
    entry: AuditLogEntry
): void {
    writeAuditLog(supabase, entry).catch(e =>
        console.warn('Async audit log error:', e)
    );
}

/**
 * Query audit logs
 */
export async function queryAuditLogs(
    supabase: SupabaseClient,
    query: AuditQuery
): Promise<any[]> {
    let builder = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(query.limit || 100);

    if (query.user_id) {
        builder = builder.eq('user_id', query.user_id);
    }
    if (query.agent_id) {
        builder = builder.eq('agent_id', query.agent_id);
    }
    if (query.conversation_id) {
        builder = builder.eq('conversation_id', query.conversation_id);
    }
    if (query.action) {
        builder = builder.eq('action', query.action);
    }
    if (query.entity_type) {
        builder = builder.eq('entity_type', query.entity_type);
    }
    if (query.from_date) {
        builder = builder.gte('created_at', query.from_date);
    }
    if (query.to_date) {
        builder = builder.lte('created_at', query.to_date);
    }

    const { data, error } = await builder;

    if (error) {
        console.warn('Audit log query error:', error);
        return [];
    }

    return data || [];
}

/**
 * Log conversation event
 */
export function logConversationEvent(
    supabase: SupabaseClient,
    conversationId: string,
    agentId: string,
    action: 'conversation_started' | 'conversation_ended' | 'lead_transferred',
    metadata?: Record<string, any>
): void {
    writeAuditLogAsync(supabase, {
        action,
        entity_type: 'conversation',
        entity_id: conversationId,
        agent_id: agentId,
        conversation_id: conversationId,
        metadata
    });
}

/**
 * Log message event
 */
export function logMessageEvent(
    supabase: SupabaseClient,
    messageId: string,
    conversationId: string,
    agentId: string,
    action: 'message_sent' | 'message_received',
    metadata?: Record<string, any>
): void {
    writeAuditLogAsync(supabase, {
        action,
        entity_type: 'message',
        entity_id: messageId,
        agent_id: agentId,
        conversation_id: conversationId,
        metadata
    });
}

/**
 * Log lead qualification event
 */
export function logLeadEvent(
    supabase: SupabaseClient,
    leadId: string,
    conversationId: string,
    agentId: string,
    action: 'lead_qualified' | 'lead_transferred',
    previousValue?: Record<string, any>,
    newValue?: Record<string, any>
): void {
    writeAuditLogAsync(supabase, {
        action,
        entity_type: 'lead',
        entity_id: leadId,
        agent_id: agentId,
        conversation_id: conversationId,
        previous_value: previousValue,
        new_value: newValue
    });
}

/**
 * Log configuration change
 */
export async function logConfigChange(
    supabase: SupabaseClient,
    userId: string,
    entityType: 'agent' | 'config',
    entityId: string,
    previousValue: Record<string, any>,
    newValue: Record<string, any>
): Promise<void> {
    await writeAuditLog(supabase, {
        action: 'agent_config_changed',
        entity_type: entityType,
        entity_id: entityId,
        user_id: userId,
        previous_value: previousValue,
        new_value: newValue,
        is_sensitive: true
    });
}

/**
 * Log error event
 */
export function logError(
    supabase: SupabaseClient,
    error: Error,
    context: {
        agent_id?: string;
        conversation_id?: string;
        action?: string;
        metadata?: Record<string, any>;
    }
): void {
    writeAuditLogAsync(supabase, {
        action: 'error_occurred',
        entity_type: 'system',
        agent_id: context.agent_id,
        conversation_id: context.conversation_id,
        metadata: {
            error_name: error.name,
            error_message: error.message,
            error_stack: error.stack?.substring(0, 500),
            action: context.action,
            ...context.metadata
        }
    });
}

/**
 * Log API call
 */
export function logApiCall(
    supabase: SupabaseClient,
    apiName: string,
    agentId: string,
    metadata: {
        endpoint?: string;
        method?: string;
        status_code?: number;
        duration_ms?: number;
        tokens_used?: number;
        [key: string]: any;
    }
): void {
    writeAuditLogAsync(supabase, {
        action: 'api_called',
        entity_type: 'system',
        entity_id: apiName,
        agent_id: agentId,
        metadata
    });
}

/**
 * Log rate limit event
 */
export function logRateLimit(
    supabase: SupabaseClient,
    limitKey: string,
    agentId?: string,
    conversationId?: string
): void {
    writeAuditLogAsync(supabase, {
        action: 'rate_limited',
        entity_type: 'system',
        entity_id: limitKey,
        agent_id: agentId,
        conversation_id: conversationId
    });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Anonymize sensitive data for logging
 */
export function anonymize(data: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['phone', 'cpf', 'email', 'password', 'token', 'api_key'];
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
        const keyLower = key.toLowerCase();

        if (sensitiveKeys.some(sk => keyLower.includes(sk))) {
            if (typeof value === 'string') {
                result[key] = maskString(value);
            } else {
                result[key] = '[REDACTED]';
            }
        } else if (typeof value === 'object' && value !== null) {
            result[key] = anonymize(value);
        } else {
            result[key] = value;
        }
    }

    return result;
}

function maskString(str: string): string {
    if (str.length <= 4) return '****';
    return str.substring(0, 2) + '****' + str.substring(str.length - 2);
}

/**
 * Get audit summary for a conversation
 */
export async function getConversationAuditSummary(
    supabase: SupabaseClient,
    conversationId: string
): Promise<{
    total_events: number;
    messages_sent: number;
    messages_received: number;
    errors: number;
    timeline: string[];
}> {
    const logs = await queryAuditLogs(supabase, {
        conversation_id: conversationId,
        limit: 500
    });

    const summary = {
        total_events: logs.length,
        messages_sent: 0,
        messages_received: 0,
        errors: 0,
        timeline: [] as string[]
    };

    for (const log of logs) {
        if (log.action === 'message_sent') summary.messages_sent++;
        if (log.action === 'message_received') summary.messages_received++;
        if (log.action === 'error_occurred') summary.errors++;

        summary.timeline.push(
            `${new Date(log.created_at).toLocaleTimeString('pt-BR')}: ${log.action}`
        );
    }

    return summary;
}
