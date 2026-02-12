import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizePhoneNumber, isValidBrazilianPhone } from '../_shared/phoneHelpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppMessage {
  phone_number: string;
  message?: string;
  media?: {
    type: 'image' | 'video' | 'document' | 'audio';
    url: string;
    caption?: string;
    filename?: string;
  };
  buttons?: Array<{
    id: string;
    text: string;
  }>;
  list?: {
    title: string;
    description?: string;
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  };
  lead_id?: string;
  corretor_id?: string;
  instance_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== EVOLUTION API V2 - SEND WHATSAPP MESSAGE ===');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: WhatsAppMessage = await req.json();
    const { phone_number, message, media, buttons, list, lead_id, corretor_id } = body;

    if (!phone_number) {
      throw new Error('Número de telefone é obrigatório');
    }

    // Normalizar número
    const normalizedPhone = normalizePhoneNumber(phone_number);

    console.log('Sending to:', normalizedPhone);

    if (!isValidBrazilianPhone(normalizedPhone)) {
      throw new Error('Número de telefone inválido');
    }

    // 1. Get instance configuration
    let apiUrl = '';
    let apiKey = '';
    let instanceName = '';

    const { instance_id } = body;

    if (instance_id) {
      // Fetch specific instance
      const { data: instance, error } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('id', instance_id)
        .single();

      if (error || !instance) {
        throw new Error(`Instance not found: ${instance_id}`);
      }

      apiUrl = instance.api_url;
      apiKey = instance.api_token;
      instanceName = instance.instance_name;
      console.log(`Using specific Evolution Instance: ${instance.name} (${instanceName})`);

    } else {
      // No instance_id provided. Try to find an ACTIVE instance first.
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
      } else {
        // Fallback: Fetch from system_settings (Legacy)
        console.log('No active instance found in DB. Falling back to system_settings.');
        const { data: settings } = await supabase
          .from('system_settings')
          .select('key, value')
          .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

        const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);

        apiUrl = settingsMap.get('evolution_api_url');
        apiKey = settingsMap.get('evolution_api_key');
        instanceName = settingsMap.get('evolution_instance_name');
      }
    }

    if (!apiUrl || !apiKey || !instanceName) {
      throw new Error('Configurações da Evolution API não encontradas');
    }

    // Trim trailing slash from API URL to prevent double slashes
    apiUrl = apiUrl.trim().replace(/\/$/, '');
    instanceName = instanceName.trim();

    let endpoint = '';
    let payload: any = {};

    // Evolution API v2: Suporte para diferentes tipos de mensagem
    if (media) {
      // Enviar mídia
      endpoint = `/message/sendMedia/${instanceName}`;
      payload = {
        number: normalizedPhone,
        mediatype: media.type,
        media: media.url,
        ...(media.caption && { caption: media.caption }),
        ...(media.filename && { fileName: media.filename }),
      };
    } else if (list) {
      // Enviar mensagem com lista
      endpoint = `/message/sendList/${instanceName}`;
      payload = {
        number: normalizedPhone,
        title: list.title,
        description: list.description || '',
        buttonText: list.buttonText,
        sections: list.sections,
      };
    } else {
      // Enviar mensagem de texto simples
      // IMPORTANTE: Evolution API V2 aceita APENAS "number" e "text" nas rotas /message/sendText
      endpoint = `/message/sendText/${instanceName}`;
      payload = {
        number: normalizedPhone,
        text: message || '',
      };
    }

    // Log detalhado do request
    console.log('📤 Request para Evolution API v2:', {
      url: `${apiUrl}${endpoint}`,
      method: 'POST',
      payload: payload,
      headers: { 'Content-Type': 'application/json', 'apikey': '***' }
    });

    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(payload)
    });

    console.log('📥 Response status:', response.status);
    const responseText = await response.text();
    console.log('📥 Response body:', responseText);

    if (!response.ok) {
      console.error('❌ Evolution API error:', responseText);

      // Log failure in communication_log for debugging
      await supabase.from('communication_log').insert({
        type: 'whatsapp',
        direction: 'enviado',
        phone_number: normalizedPhone,
        content: message || `Mídia/Lista falhou`,
        status: 'failed',
        corretor_id: corretor_id || null,
        lead_id: lead_id || null,
        metadata: {
          error: responseText,
          status_code: response.status,
          endpoint: endpoint,
          api_version: 'v2'
        }
      });

      throw new Error(`Erro ao enviar mensagem (status ${response.status}): ${responseText}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    console.log('✅ Message sent successfully:', result);

    // Registrar no communication_log
    const logContent = media
      ? `Mídia (${media.type}): ${media.caption || media.url}`
      : list
        ? `Lista: ${list.title}`
        : message || '';

    await supabase.from('communication_log').insert({
      type: 'whatsapp',
      direction: 'enviado',
      phone_number: normalizedPhone,
      content: logContent,
      message_id: result.key?.id || result.messageId || null,
      status: 'sent',
      corretor_id: corretor_id || null,
      lead_id: lead_id || null,
      metadata: {
        media_type: media?.type,
        has_list: !!list,
        api_version: 'v2',
        endpoint: endpoint,
        response: result,
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message_id: result.key?.id || result.messageId,
        phone_number: normalizedPhone,
        result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro ao enviar mensagem:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
