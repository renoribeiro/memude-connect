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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { phone, message } = await req.json();

    if (!phone || !message) {
      throw new Error('Telefone e mensagem são obrigatórios');
    }

    // 1. Obter configurações
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'whatsapp_provider', 
        'evolution_api_url', 'evolution_api_key', 'evolution_instance_name',
        'waha_api_url', 'waha_api_key'
      ]);

    const config = new Map(settings?.map(s => [s.key, s.value]) || []);
    const provider = config.get('whatsapp_provider') || 'evolution'; // Default Evolution

    console.log(`📨 Enviando via ${provider.toUpperCase()} para ${phone}`);

    let result;

    if (provider === 'waha') {
        result = await sendViaWAHA(config, phone, message);
    } else {
        result = await sendViaEvolution(config, phone, message);
    }

    // Log comunicação
    await supabase.from('communication_log').insert({
        type: 'whatsapp',
        direction: 'outbound',
        phone_number: phone,
        content: message,
        status: result.success ? 'sent' : 'failed',
        metadata: { provider, result }
    });

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function sendViaEvolution(config: Map<string, string>, phone: string, message: string) {
    const url = config.get('evolution_api_url');
    const key = config.get('evolution_api_key');
    const instance = config.get('evolution_instance_name');

    if (!url || !key || !instance) throw new Error("Configuração Evolution incompleta");

    const endpoint = `${url}/message/sendText/${instance}`;
    const body = {
        number: phone, // Evolution V2 usa 'number'
        text: message,
        options: { delay: 1200, presence: 'composing' }
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': key },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    return { success: response.ok, provider: 'evolution', data };
}

async function sendViaWAHA(config: Map<string, string>, phone: string, message: string) {
    const url = config.get('waha_api_url');
    const key = config.get('waha_api_key'); // Opcional se usar sessão padrão sem auth

    if (!url) throw new Error("URL do WAHA não configurada");

    // WAHA usa chatId formato 558599999999@c.us
    // Remover + e caracteres especiais
    const cleanPhone = phone.replace(/\D/g, '');
    const chatId = `${cleanPhone}@c.us`;

    const endpoint = `${url}/api/send/text`;
    const body = {
        chatId: chatId,
        text: message,
        session: 'default' 
    };

    const headers: any = { 'Content-Type': 'application/json' };
    if (key) headers['X-Api-Key'] = key;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    const data = await response.json();
    return { success: response.ok, provider: 'waha', data };
}
