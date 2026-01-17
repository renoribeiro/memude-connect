// Shared utility for structured logging
// Prevents circular dependencies and provides consistent logging across edge functions

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

interface LogEntry {
  level: LogLevel;
  function_name: string;
  event: string;
  message?: string;
  metadata?: Record<string, any>;
  user_id?: string;
  corretor_id?: string;
  lead_id?: string;
  error_stack?: string;
  request_id?: string;
  execution_time_ms?: number;
}

/**
 * Log structured data to application_logs table
 * Falls back to console.log if database insert fails
 */
export async function logStructured(
  supabase: any,
  entry: LogEntry
): Promise<void> {
  try {
    const { error } = await supabase
      .from('application_logs')
      .insert({
        timestamp: new Date().toISOString(),
        ...entry,
        metadata: entry.metadata || {},
        request_id: entry.request_id || crypto.randomUUID()
      });

    if (error) {
      console.error('Failed to insert structured log:', error);
      // Fallback to console
      console[entry.level === 'critical' || entry.level === 'error' ? 'error' : 'log'](
        `[${entry.level.toUpperCase()}] ${entry.function_name}:${entry.event}`,
        entry.message,
        entry.metadata
      );
    }
  } catch (err) {
    // Fallback to console if anything goes wrong
    console.error('Structured logging error:', err);
    console[entry.level === 'critical' || entry.level === 'error' ? 'error' : 'log'](
      `[${entry.level.toUpperCase()}] ${entry.function_name}:${entry.event}`,
      entry.message
    );
  }
}

/**
 * Create a timed logger that automatically tracks execution time
 */
export function createTimedLogger(
  supabase: any,
  function_name: string,
  request_id?: string
) {
  const startTime = Date.now();
  const reqId = request_id || crypto.randomUUID();

  return {
    log: (entry: Omit<LogEntry, 'function_name' | 'request_id' | 'execution_time_ms'>) => {
      return logStructured(supabase, {
        ...entry,
        function_name,
        request_id: reqId,
        execution_time_ms: Date.now() - startTime
      });
    },
    getExecutionTime: () => Date.now() - startTime,
    getRequestId: () => reqId
  };
}
