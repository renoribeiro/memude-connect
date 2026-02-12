
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== CONFIGURANDO WEBHOOK EVOLUTION API V2 ===');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let body;
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    let apiUrl: string | undefined;
    let apiKey: string | undefined;
    let instanceName: string | undefined;

    // 1. Try to get from body (frontend passing explicit config)
    if (body?.instance_config) {
      apiUrl = body.instance_config.api_url;
      apiKey = body.instance_config.api_key || body.instance_config.api_token;
      instanceName = body.instance_config.instance_name;
      console.log('Using config from request body');
    }

    // 2. If missing, try to find an ACTIVE instance in DB (best practice)
    if (!apiUrl || !apiKey || !instanceName) {
      const { data: activeInstance } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (activeInstance) {
        apiUrl = activeInstance.api_url;
        apiKey = activeInstance.api_token;
        instanceName = activeInstance.instance_name;
        console.log(`Using ACTIVE Evolution Instance: ${activeInstance.name} (${instanceName})`);
      }
    }

    // 3. Fallback to system_settings (Legacy)
    if (!apiUrl || !apiKey || !instanceName) {
      console.log('Fallback to system_settings');
      const { data: settings } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

      const settingsMap = new Map(settings?.map((s: any) => [s.key, s.value]) || []);
      apiUrl = apiUrl || settingsMap.get('evolution_api_url');
      apiKey = apiKey || settingsMap.get('evolution_api_key');
      instanceName = instanceName || settingsMap.get('evolution_instance_name');
    }

    // Trim whitespace and trailing slashes
    apiUrl = apiUrl?.trim()?.replace(/\/$/, '');
    apiKey = apiKey?.trim();
    instanceName = instanceName?.trim();

    console.log('Configurações Evolution API:', {
      apiUrl: apiUrl ? '✓' : '✗',
      apiKey: apiKey ? '✓' : '✗',
      instanceName: instanceName || 'não encontrado'
    });

    if (!apiUrl || !apiKey || !instanceName) {
      throw new Error('Configurações da Evolution API não encontradas. Configure primeiro a API URL, Key e Instance Name.');
    }

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/evolution-webhook-handler`;

    console.log('Configurando webhook:', webhookUrl);
    console.log('Instance:', instanceName);

    // Evolution API V2 webhook endpoint
    // Standard V2: /webhook/set/{instance}
    // Also try /webhook/set if the first one 404s? No, let's stick to standard behavior first.
    let evolutionUrl = `${apiUrl}/webhook/set/${instanceName}`;

    console.log('Chamando Evolution API:', evolutionUrl);

    // Payload conforme docs V2
    const webhookPayload = {
      enabled: true,
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: [
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'CONNECTION_UPDATE'
      ]
    };

    console.log('Payload:', JSON.stringify(webhookPayload));

    let response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(webhookPayload),
      signal: AbortSignal.timeout(15000)
    });

    // Handle 404 - Retry with /webhook/set (global/legacy depending on version)
    if (response.status === 404) {
      console.warn('Got 404 on /webhook/set/{instance}. Retrying with /webhook/set (Global/Legacy)...');
      evolutionUrl = `${apiUrl}/webhook/set`;
      response = await fetch(evolutionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify({
          ...webhookPayload,
          // Some versions require instance name in body for global set? Unlikely for "set", usually "find".
          // But let's try standard payload first.
        }),
        signal: AbortSignal.timeout(15000)
      });
    }

    const responseText = await response.text();
    console.log('Resposta Evolution API:', {
      status: response.status,
      statusText: response.statusText,
      body: responseText
    });

    if (!response.ok) {
      let errorDetail = responseText;
      try {
        const parsed = JSON.parse(responseText);
        errorDetail = parsed.message || parsed.error || responseText;
      } catch { /* keep raw text */ }

      throw new Error(`Evolution API retornou erro (${response.status}): ${errorDetail}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    console.log('Webhook configurado com sucesso:', result);

    // Save webhook config to system_settings
    const { error: updateError } = await supabase
      .from('system_settings')
      .upsert([
        {
          key: 'evolution_webhook_url',
          value: webhookUrl,
          description: 'URL do webhook configurado na Evolution API'
        },
        {
          key: 'evolution_webhook_enabled',
          value: 'true',
          description: 'Indica se o webhook está ativo e configurado'
        }
      ], { onConflict: 'key' });

    if (updateError) {
      console.error('Erro ao atualizar system_settings:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        webhook_url: webhookUrl,
        instance: instanceName,
        events: webhookPayload.events,
        evolution_response: result,
        message: 'Webhook configurado com sucesso na Evolution API V2!'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('❌ Erro ao configurar webhook:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});
