
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface LogEntry {
    service: string;
    endpoint: string;
    method: string;
    status_code: number;
    request_payload?: any;
    response_body?: any;
    duration_ms: number;
    metadata?: any;
}

export async function logIntegration(supabase: SupabaseClient, entry: LogEntry) {
    try {
        // Truncate payloads if too large (e.g. > 10KB) to save DB space/bandwidth if needed
        // For now, we store as is, but we could implement truncation here.

        const { error } = await supabase.from('integration_logs').insert({
            service: entry.service,
            endpoint: entry.endpoint,
            method: entry.method,
            status_code: entry.status_code,
            request_payload: entry.request_payload,
            response_body: entry.response_body,
            duration_ms: entry.duration_ms,
            metadata: entry.metadata
        });

        if (error) {
            console.error('Failed to write integration log:', error);
        }
    } catch (err) {
        console.error('Error logging integration:', err);
    }
}
