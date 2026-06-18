
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { normalizePhoneNumber, isValidBrazilianPhone } from '../_shared/phoneHelpers.ts';
import { logIntegration } from '../_shared/integration-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppMessage {
  phone_number?: string;
  phone?: string; // Fallback field
  message?: string;
  text?: string;  // Fallback field
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
  async?: boolean;
  metadata?: any; // To capture and forward logging metadata
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== EVOLUTION API V2 - SEND WHATSAPP MESSAGE ===');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: WhatsAppMessage;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error('Invalid JSON payload');
    }

    const phone_number = body.phone_number || body.phone;
    const message = body.message || body.text;
    const { media, buttons, list, async } = body;
    const lead_id = body.lead_id || body.metadata?.lead_id;
    const corretor_id = body.corretor_id || body.metadata?.corretor_id;

    if (!phone_number) {
      throw new Error('Número de telefone é obrigatório (use phone_number ou phone)');
    }

    // Normalizar número
    const normalizedPhone = normalizePhoneNumber(phone_number);

    console.log('Sending to:', normalizedPhone);

    if (!isValidBrazilianPhone(normalizedPhone)) {
      throw new Error('Número de telefone inválido');
    }

    // 0. Async Queue Handling
    if (async) {
      console.log('🔄 Async mode: Enqueuing message for', normalizedPhone);

      // Determine message body for queue
      const queuePayload = {
        type: media ? 'media' : list ? 'list' : (buttons && buttons.length > 0) ? 'buttons' : 'text',
        message: message,
        media: media,
        list: list,
        buttons: buttons // Stored for worker
      };

      const { data: queueItem, error: queueError } = await supabase
        .from('message_queue')
        .insert({
          instance_id: body.instance_id || null, // If null, worker picks active
          phone_number: normalizedPhone,
          message_body: queuePayload,
          status: 'pending',
          priority: 0
        })
        .select('id')
        .single();

      if (queueError) throw queueError;

      // Log in communication_log as 'queued'
      await supabase.from('communication_log').insert({
        type: 'whatsapp',
        direction: 'enviado',
        phone_number: normalizedPhone,
        content: message || (media ? 'Media (Queued)' : 'List (Queued)'),
        status: 'queued',
        corretor_id: corretor_id || null,
        lead_id: lead_id || null,
        metadata: {
          ...(body.metadata || {}),
          queue_id: queueItem.id,
          async: true
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          queued: true,
          queue_id: queueItem.id,
          message: 'Message queued for async delivery'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Get WhatsApp provider settings
    const { data: systemSettings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['whatsapp_provider', 'waha_api_url', 'waha_api_key']);

    const systemConfig = new Map(systemSettings?.map((s: any) => [s.key, s.value]) || []);
    const provider = systemConfig.get('whatsapp_provider') || 'evolution';

    if (provider === 'waha') {
      const wahaUrl = systemConfig.get('waha_api_url')?.trim().replace(/\/$/, '');
      const wahaKey = systemConfig.get('waha_api_key')?.trim();

      if (!wahaUrl) {
        throw new Error('Configuração URL da API WAHA não encontrada');
      }

      console.log('🤖 Roteamento WAHA ativo para:', normalizedPhone);

      const wahaChatId = `${normalizedPhone.replace(/\D/g, '')}@c.us`;
      let wahaEndpoint = '';
      let wahaPayload: any = {};
      let isButtons = false;

      if (media) {
        wahaEndpoint = media.type === 'image' ? '/api/sendImage' 
                     : media.type === 'video' ? '/api/sendVideo' 
                     : media.type === 'audio' ? '/api/sendVoice' 
                     : '/api/sendFile';
        wahaPayload = {
          session: 'default',
          chatId: wahaChatId,
          file: {
            url: media.url,
            filename: media.filename || `file_${Date.now()}`,
          },
          ...(media.caption && { caption: media.caption })
        };
      } else if (list) {
        wahaEndpoint = '/api/sendList';
        wahaPayload = {
          session: 'default',
          chatId: wahaChatId,
          buttonText: list.buttonText,
          title: list.title,
          description: list.description || '',
          sections: list.sections.map(s => ({
            title: s.title,
            rows: s.rows.map(r => ({
              id: r.id,
              title: r.title,
              description: r.description || ''
            }))
          }))
        };
      } else if (buttons && buttons.length > 0) {
        isButtons = true;
        wahaEndpoint = '/api/sendButtons';
        wahaPayload = {
          session: 'default',
          chatId: wahaChatId,
          body: message || '',
          buttons: buttons.map(b => ({
            type: 'reply',
            id: b.id,
            text: b.text
          }))
        };
      } else {
        wahaEndpoint = '/api/sendText';
        wahaPayload = {
          session: 'default',
          chatId: wahaChatId,
          text: message || ''
        };
      }

      const wahaHeaders: any = { 'Content-Type': 'application/json' };
      if (wahaKey) {
        wahaHeaders['X-Api-Key'] = wahaKey;
      }

      const startTime = Date.now();
      let responseStatus = 0;
      let responseBody: any = null;

      try {
        console.log(`📤 Enviando via WAHA (${wahaEndpoint}):`, JSON.stringify(wahaPayload));
        let response = await fetch(`${wahaUrl}${wahaEndpoint}`, {
          method: 'POST',
          headers: wahaHeaders,
          body: JSON.stringify(wahaPayload),
          signal: AbortSignal.timeout(15000)
        });

        responseStatus = response.status;

        // FALLBACK DE BOTÕES SE FALHAR
        if (!response.ok && isButtons) {
          console.warn('⚠️ WAHA /api/sendButtons falhou. Tentando fallback para sendText...');
          const fallbackText = `${message}\n\nResponda com o número da opção desejada:\n` +
            buttons.map((b, idx) => `[${idx + 1}] ${b.text}`).join('\n');
          
          wahaEndpoint = '/api/sendText';
          wahaPayload = {
            session: 'default',
            chatId: wahaChatId,
            text: fallbackText
          };

          response = await fetch(`${wahaUrl}${wahaEndpoint}`, {
            method: 'POST',
            headers: wahaHeaders,
            body: JSON.stringify(wahaPayload),
            signal: AbortSignal.timeout(15000)
          });
          responseStatus = response.status;
        }

        const responseText = await response.text();
        console.log('📥 WAHA Response:', responseText);

        try {
          responseBody = responseText ? JSON.parse(responseText) : { raw: responseText };
        } catch {
          responseBody = { raw: responseText };
        }

        if (!response.ok) {
          // Salvar falha no log de comunicação
          await supabase.from('communication_log').insert({
            type: 'whatsapp',
            direction: 'enviado',
            phone_number: normalizedPhone,
            content: message || 'Mídia falhou (WAHA)',
            status: 'failed',
            corretor_id: corretor_id || null,
            lead_id: lead_id || null,
            metadata: {
              ...(body.metadata || {}),
              provider: 'waha',
              error: responseText,
              status_code: response.status,
              endpoint: wahaEndpoint
            }
          });

          throw new Error(`Erro ao enviar mensagem via WAHA (status ${response.status}): ${responseText}`);
        }

        // Registrar sucesso no communication_log
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
          message_id: responseBody?.id || responseBody?.messageId || null,
          status: 'sent',
          corretor_id: corretor_id || null,
          lead_id: lead_id || null,
          metadata: {
            ...(body.metadata || {}),
            provider: 'waha',
            media_type: media?.type,
            has_list: !!list,
            endpoint: wahaEndpoint,
            response: responseBody
          }
        });

        // Log da integração
        await logIntegration(supabase, {
          service: 'waha-api',
          endpoint: wahaEndpoint,
          method: 'POST',
          status_code: responseStatus,
          request_payload: wahaPayload,
          response_body: responseBody,
          duration_ms: Date.now() - startTime,
          metadata: { phone: normalizedPhone }
        });

        return new Response(
          JSON.stringify({
            success: true,
            message_id: responseBody?.id || responseBody?.messageId,
            phone_number: normalizedPhone,
            result: responseBody
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (err: any) {
        await logIntegration(supabase, {
          service: 'waha-api',
          endpoint: wahaEndpoint,
          method: 'POST',
          status_code: responseStatus,
          request_payload: wahaPayload,
          response_body: { error: err.message },
          duration_ms: Date.now() - startTime,
          metadata: { phone: normalizedPhone }
        });
        throw err;
      }
    }

    // 1. Get instance configuration (Evolution V2 fallback)
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

        const settingsMap = new Map(settings?.map((s: any) => [s.key, s.value]) || []);

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
    } else if (buttons && buttons.length > 0) {
      // Enviar botões
      endpoint = `/message/sendButtons/${instanceName}`;
      payload = {
        number: normalizedPhone,
        title: 'Opções', // Title is often required
        description: message || '',
        buttons: buttons.map(b => ({
          id: b.id,
          displayText: b.text // Evolution usually expects "displayText" for Baileys, or "text" depending on version. Using "displayText" is safer for buttons.
        }))
      };
      // Note: Some Evolution versions use "text" instead of "displayText" inside button object. 
      // Evolution V2 often uses { id, displayText } for reply buttons.
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

    const startTime = Date.now();
    let responseStatus = 0;
    let responseBody: any = null;

    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });

      responseStatus = response.status;
      console.log('📥 Response status:', response.status);
      const responseText = await response.text();
      console.log('📥 Response body:', responseText);

      try {
        responseBody = responseText ? JSON.parse(responseText) : { raw: responseText };
      } catch {
        responseBody = { raw: responseText };
      }

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
            ...(body.metadata || {}),
            error: responseText,
            status_code: response.status,
            endpoint: endpoint,
            api_version: 'v2'
          }
        });

        throw new Error(`Erro ao enviar mensagem (status ${response.status}): ${responseText}`);
      }

      console.log('✅ Message sent successfully:', responseBody);

      // === LID-to-Phone Mapping ===
      // Evolution API V2 returns remoteJid in the response.
      // We capture this mapping so the webhook handler can resolve LIDs to real phones later.
      if (responseBody?.key?.remoteJid) {
        try {
          const remoteJid = responseBody.key.remoteJid as string;
          const jidPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');

          // Only map if remoteJid contains a real phone (not already a LID)
          if (remoteJid.includes('@s.whatsapp.net') && /^\d{10,15}$/.test(jidPhone)) {
            await supabase.from('lid_phone_map').upsert({
              lid: jidPhone,
              phone: normalizedPhone,
              instance_name: instanceName,
              updated_at: new Date().toISOString()
            }, { onConflict: 'lid' });
            console.log(`🗺️ LID mapping saved: ${jidPhone} → ${normalizedPhone}`);
          }
        } catch (mapErr) {
          console.warn('⚠️ Failed to save LID mapping (non-critical):', mapErr);
        }
      }

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
        message_id: responseBody?.key?.id || responseBody?.messageId || null,
        status: 'sent',
        corretor_id: corretor_id || null,
        lead_id: lead_id || null,
        metadata: {
          ...(body.metadata || {}),
          media_type: media?.type,
          has_list: !!list,
          api_version: 'v2',
          endpoint: endpoint,
          response: responseBody,
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          message_id: responseBody?.key?.id || responseBody?.messageId,
          phone_number: normalizedPhone,
          result: responseBody
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error: any) {
      responseBody = { error: error.message };
      throw error;
    } finally {
      await logIntegration(supabase, {
        service: 'evolution-api',
        endpoint: endpoint,
        method: 'POST',
        status_code: responseStatus,
        request_payload: payload,
        response_body: responseBody,
        duration_ms: Date.now() - startTime,
        metadata: {
          instance_name: instanceName,
          phone: normalizedPhone
        }
      });
    }


  } catch (error: any) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.error('❌ Evolution API Timeout');
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution API Timeout' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 504 }
      );
    }
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
