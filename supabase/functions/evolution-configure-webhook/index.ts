import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== CONFIGURANDO WEBHOOK EVOLUTION API V2 ===');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar configurações da Evolution API
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

    if (settingsError) {
      throw new Error(`Erro ao buscar configurações: ${settingsError.message}`);
    }

    const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
    
    const apiUrl = settingsMap.get('evolution_api_url');
    const apiKey = settingsMap.get('evolution_api_key');
    const instanceName = settingsMap.get('evolution_instance_name');

    console.log('Configurações Evolution API:', {
      apiUrl: apiUrl ? '✓' : '✗',
      apiKey: apiKey ? '✓' : '✗',
      instanceName: instanceName || 'não encontrado'
    });

    if (!apiUrl || !apiKey || !instanceName) {
      throw new Error('Configurações da Evolution API não encontradas. Configure primeiro a API URL, Key e Instance Name.');
    }

    // URL do webhook (evolution-webhook-handler)
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/evolution-webhook-handler`;

    console.log('Configurando webhook:', webhookUrl);
    console.log('Instance:', instanceName);

    // Configurar webhook na Evolution API V2
    // Docs: https://doc.evolution-api.com/v2/pt/configuration/webhooks
    const evolutionUrl = `${apiUrl}/webhook/set/${instanceName}`;
    
    console.log('Chamando Evolution API:', evolutionUrl);

    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false, 
        events: [
          'MESSAGES_UPSERT',      
          'MESSAGES_UPDATE',       
          'CONNECTION_UPDATE'      
        ]
      })
    });

    const responseText = await response.text();
    console.log('Resposta Evolution API:', {
      status: response.status,
      statusText: response.statusText,
      body: responseText
    });

    if (!response.ok) {
      throw new Error(`Erro ao configurar webhook (${response.status}): ${responseText}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    console.log('Webhook configurado com sucesso:', result);

    // Atualizar configurações no banco
    const { error: updateError } = await supabase
      .from('system_settings')
      .upsert([
        { 
          key: 'evolution_webhook_url', 
          value: webhookUrl,
          description: 'URL do webhook configurado na Evolution API para receber eventos'
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
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
        message: 'Webhook configurado com sucesso na Evolution API V2!'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
