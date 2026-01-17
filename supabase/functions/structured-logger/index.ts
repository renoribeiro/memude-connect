import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

interface BatchLogRequest {
  logs: LogEntry[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json() as LogEntry | BatchLogRequest;
    
    // Verifica se é batch ou log único
    const logs = 'logs' in body ? body.logs : [body];

    // Valida estrutura básica
    for (const log of logs) {
      if (!log.level || !log.function_name || !log.event) {
        return new Response(
          JSON.stringify({ 
            error: 'Missing required fields: level, function_name, event' 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }
    }

    // Insere logs no banco
    const { data, error } = await supabase
      .from('application_logs')
      .insert(logs.map(log => ({
        timestamp: new Date().toISOString(),
        level: log.level,
        function_name: log.function_name,
        event: log.event,
        message: log.message,
        metadata: log.metadata || {},
        user_id: log.user_id,
        corretor_id: log.corretor_id,
        lead_id: log.lead_id,
        error_stack: log.error_stack,
        request_id: log.request_id || crypto.randomUUID(),
        execution_time_ms: log.execution_time_ms,
      })))
      .select();

    if (error) {
      console.error('Error inserting logs:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to insert logs', details: error.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        logs_inserted: data?.length || 0,
        message: 'Logs inserted successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Structured logger error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
