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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get Evolution API settings
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

    if (settingsError) throw settingsError;

    const settingsMap = settings.reduce((acc: any, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    const { phone_number, message, lead_id, corretor_id } = await req.json();

    console.log('Sending WhatsApp message to:', phone_number);

    if (!settingsMap.evolution_api_url || !settingsMap.evolution_api_key || !settingsMap.evolution_instance_name) {
      throw new Error('Evolution API não configurada');
    }

    // Send message via Evolution API V2
    const apiUrl = settingsMap.evolution_api_url.replace(/\/$/, '');
    const evolutionResponse = await fetch(
      `${apiUrl}/message/sendText/${settingsMap.evolution_instance_name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settingsMap.evolution_api_key,
        },
        body: JSON.stringify({
          number: phone_number.replace(/\D/g, ''),
          options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: false
          },
          textMessage: {
            text: message
          }
        })
      }
    );

    const evolutionData = await evolutionResponse.json();

    if (!evolutionResponse.ok) {
      console.error('Evolution API error:', evolutionData);

      // Log failure in communication_log for debugging
      await supabase.from('communication_log').insert({
        lead_id,
        corretor_id,
        type: 'whatsapp',
        direction: 'enviado',
        content: message,
        phone_number,
        status: 'failed',
        metadata: { error: evolutionData, status_code: evolutionResponse.status }
      });

      throw new Error(`Evolution API error: ${evolutionData.message || JSON.stringify(evolutionData)}`);
    }

    console.log('Message sent successfully:', evolutionData);

    // Log communication
    const { error: logError } = await supabase
      .from('communication_log')
      .insert({
        lead_id,
        corretor_id,
        type: 'whatsapp',
        direction: 'enviado',
        content: message,
        phone_number,
        message_id: evolutionData.key?.id || null,
        status: 'sent',
        metadata: evolutionData
      });

    if (logError) {
      console.error('Error logging communication:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: evolutionData.key?.id,
        data: evolutionData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in evolution-send-whatsapp function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});