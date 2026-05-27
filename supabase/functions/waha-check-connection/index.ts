import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch WAHA settings
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['waha_api_url', 'waha_api_key']);

    if (settingsError) throw settingsError;

    const settingsMap = new Map(settings?.map((s: any) => [s.key, s.value]) || []);
    const wahaUrl = settingsMap.get('waha_api_url')?.trim().replace(/\/$/, '');
    const wahaKey = settingsMap.get('waha_api_key')?.trim();

    if (!wahaUrl) {
      throw new Error('URL da API WAHA não configurada nas preferências do sistema.');
    }

    try {
      new URL(wahaUrl);
    } catch {
      throw new Error('URL do WAHA inválida. Use formato: http://ip-ou-host:porta');
    }

    const wahaHeaders: any = { 'Content-Type': 'application/json' };
    if (wahaKey) {
      wahaHeaders['X-Api-Key'] = wahaKey;
    }

    console.log('Testing WAHA connection to:', wahaUrl);

    try {
      const response = await fetch(`${wahaUrl}/api/sessions?all=true`, {
        method: 'GET',
        headers: wahaHeaders,
        signal: AbortSignal.timeout(10000)
      });

      const responseText = await response.text();
      console.log('📥 WAHA sessions response:', responseText);

      let sessionsData;
      try {
        sessionsData = responseText ? JSON.parse(responseText) : [];
      } catch {
        sessionsData = { raw: responseText };
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Chave de API do WAHA (X-Api-Key) inválida.');
        }
        throw new Error(`Erro retornado pelo WAHA (status ${response.status}): ${sessionsData?.message || responseText}`);
      }

      // Procura a sessão default
      let defaultSession: any = null;
      if (Array.isArray(sessionsData)) {
        defaultSession = sessionsData.find((s: any) => s.name === 'default');
      }

      const status = defaultSession?.status || 'STOPPED';
      const isConnected = status === 'WORKING';

      return new Response(
        JSON.stringify({
          success: true,
          connected: isConnected,
          instance_state: status,
          instance_name: 'default',
          data: defaultSession || sessionsData
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
        throw new Error('Timeout: O servidor WAHA não respondeu em 10 segundos.');
      }
      throw new Error(`Não foi possível conectar ao WAHA: ${fetchError.message}`);
    }

  } catch (error: any) {
    console.error('Error in waha-check-connection:', error);
    return new Response(
      JSON.stringify({
        success: false,
        connected: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 with success: false for friendly UI toast
      }
    );
  }
});
