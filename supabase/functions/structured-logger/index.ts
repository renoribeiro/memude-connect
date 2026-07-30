import {
  authorize,
  handleOptions,
  jsonResponse,
  readJson,
  safeError,
} from '../_shared/security.ts';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

interface LogEntry {
  level?: LogLevel;
  function_name?: string;
  event?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  error_stack?: string;
  request_id?: string;
  execution_time_ms?: number;
}

interface BatchLogRequest {
  logs?: LogEntry[];
}

const ALLOWED_LEVELS = new Set<LogLevel>([
  'debug',
  'info',
  'warn',
  'error',
  'critical',
]);
const SENSITIVE_KEY = /(password|senha|token|secret|authorization|cookie|cpf|email|phone|telefone|whatsapp)/i;

function cleanString(value: unknown, maxLength: number): string | null {
  return typeof value === 'string'
    ? Array.from(value, (character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? ' ' : character;
    }).join('').trim().slice(0, maxLength)
    : null;
}

function sanitizeMetadata(
  value: unknown,
  depth = 0,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 2) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .slice(0, 40)
      .map(([key, item]) => {
        const safeKey = cleanString(key, 80) || 'field';
        if (typeof item === 'string') return [safeKey, cleanString(item, 500)];
        if (typeof item === 'number' || typeof item === 'boolean' || item === null) {
          return [safeKey, item];
        }
        if (Array.isArray(item)) {
          return [safeKey, item.slice(0, 20).map((entry) =>
            typeof entry === 'string' ? cleanString(entry, 200) : entry
          )];
        }
        return [safeKey, sanitizeMetadata(item, depth + 1)];
      }),
  );
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Método não permitido' }, 405, {
      Allow: 'POST, OPTIONS',
    });
  }

  const access = await authorize(req, 'internal');
  if (access instanceof Response) return access;

  try {
    const body = await readJson<LogEntry | BatchLogRequest>(req, 64 * 1024);
    const requestedLogs = 'logs' in body ? body.logs : [body];
    if (!Array.isArray(requestedLogs) || requestedLogs.length === 0) {
      return jsonResponse(req, { error: 'Nenhum log informado' }, 400);
    }
    if (requestedLogs.length > 100) {
      return jsonResponse(req, { error: 'O lote excede 100 registros' }, 400);
    }

    const logs = requestedLogs.map((log) => {
      const level = log.level;
      const functionName = cleanString(log.function_name, 120);
      const event = cleanString(log.event, 160);
      if (!level || !ALLOWED_LEVELS.has(level) || !functionName || !event) {
        throw new Error('Registro de log inválido');
      }

      return {
        timestamp: new Date().toISOString(),
        level,
        function_name: functionName,
        event,
        message: cleanString(log.message, 2000),
        metadata: sanitizeMetadata(log.metadata),
        error_stack: cleanString(log.error_stack, 8000),
        request_id: cleanString(log.request_id, 128) || crypto.randomUUID(),
        execution_time_ms: Number.isFinite(log.execution_time_ms)
          ? Math.max(0, Math.min(Number(log.execution_time_ms), 86_400_000))
          : null,
        // Identidades não são aceitas do chamador para impedir falsificação.
        user_id: null,
        corretor_id: null,
        lead_id: null,
      };
    });

    const { error } = await access.supabase
      .from('application_logs')
      .insert(logs);
    if (error) throw error;

    return jsonResponse(req, {
      success: true,
      logs_inserted: logs.length,
    });
  } catch (error) {
    const message = safeError(error);
    console.error('Falha no logger estruturado:', message);
    const status = message.includes('inválido')
      || message.includes('excede')
      || message.includes('JSON')
      ? 400
      : 500;
    return jsonResponse(req, {
      error: status === 500 ? 'Falha interna ao registrar logs' : message,
    }, status);
  }
});
