import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

export interface LogEntry {
  service: string;
  endpoint: string;
  method: string;
  status_code: number;
  request_payload?: unknown;
  response_body?: unknown;
  duration_ms: number;
  metadata?: unknown;
}

const SENSITIVE_KEY =
  /(authorization|apikey|api_key|password|senha|secret|token|cookie|cpf|email|phone|telefone|whatsapp|number|message|text|content|body|sender|jid|pushname|customer_name)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[TRUNCATED]';
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.length > 1000 ? `${value.slice(0, 1000)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  }
  if (typeof value !== 'object') return String(value);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 100)
      .map(([key, item]) => [
        key.slice(0, 100),
        SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitize(item, depth + 1),
      ]),
  );
}

export async function logIntegration(
  supabase: SupabaseClient,
  entry: LogEntry,
): Promise<void> {
  try {
    const { error } = await supabase.from('integration_logs').insert({
      service: entry.service.slice(0, 100),
      endpoint: entry.endpoint.slice(0, 500),
      method: entry.method.slice(0, 16),
      status_code: entry.status_code,
      request_payload: sanitize(entry.request_payload),
      response_body: sanitize(entry.response_body),
      duration_ms: Math.max(0, Math.min(entry.duration_ms, 86_400_000)),
      metadata: sanitize(entry.metadata),
    });

    if (error) {
      console.error('Falha ao persistir log de integração:', error.message);
    }
  } catch {
    console.error('Falha inesperada ao registrar integração');
  }
}
