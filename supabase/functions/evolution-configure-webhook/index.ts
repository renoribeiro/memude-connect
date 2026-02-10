import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== CONFIGURANDO WEBHOOK EVOLUTION API V2 ===');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Optionally accept instance config from body (for multi-instance)
    let apiUrl: string | undefined;
    let apiKey: string | undefined;
    let instanceName: string | undefined;

    try {
      const body = await req.json();
      if (body?.instance_config) {
        apiUrl = body.instance_config.api_url;
        apiKey = body.instance_config.api_key || body.instance_config.api_token;
        instanceName = body.instance_config.instance_name;
      }
    } catch {
      // No body or invalid JSON — use system_settings
    }

    // Fallback to system_settings if not passed via body
    if (!apiUrl || !apiKey || !instanceName) {
      const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

      if (settingsError) {
        throw new Error(`Erro ao buscar configurações: ${settingsError.message}`);
      }

      const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
      apiUrl = apiUrl || settingsMap.get('evolution_api_url');
      apiKey = apiKey || settingsMap.get('evolution_api_key');
      instanceName = instanceName || settingsMap.get('evolution_instance_name');
    }

    // Trim whitespace
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
    const evolutionUrl = `${apiUrl}/webhook/set/${instanceName}`;
    console.log('Chamando Evolution API:', evolutionUrl);

    // Payload conforme docs V2: https://doc.evolution-api.com/v2/pt/configuration/webhooks
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(webhookPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    console.log('Resposta Evolution API:', {
      status: response.status,
      statusText: response.statusText,
      body: responseText
    });

    if (!response.ok) {
      // Try to extract a useful error message
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

  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error);

    // Return 200 with success: false so supabase.functions.invoke() 
    // passes the error details to the frontend instead of throwing generic error
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
