import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizePhoneNumber, isValidBrazilianPhone } from '../_shared/phoneHelpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== EVOLUTION CHECK NUMBER ===');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { phone_number } = await req.json();

    if (!phone_number) {
      throw new Error('Número de telefone é obrigatório');
    }

    // Normalizar número
    const normalizedPhone = normalizePhoneNumber(phone_number);
    
    console.log('Checking phone:', normalizedPhone);

    if (!isValidBrazilianPhone(normalizedPhone)) {
      return new Response(
        JSON.stringify({
          success: false,
          exists: false,
          phone_number: normalizedPhone,
          error: 'Número de telefone inválido'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar cache primeiro
    const { data: cachedVerification } = await supabase
      .from('whatsapp_number_verification')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .single();

    // Se tem cache válido (< 24h), retornar
    if (cachedVerification) {
      const cacheAge = Date.now() - new Date(cachedVerification.last_verified_at).getTime();
      const oneDayInMs = 24 * 60 * 60 * 1000;

      if (cacheAge < oneDayInMs) {
        console.log('Using cached verification:', cachedVerification);
        return new Response(
          JSON.stringify({
            success: true,
            exists: cachedVerification.exists_on_whatsapp,
            phone_number: normalizedPhone,
            cached: true,
            last_verified_at: cachedVerification.last_verified_at
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Buscar configurações da Evolution API
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

    const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
    
    const apiUrl = settingsMap.get('evolution_api_url');
    const apiKey = settingsMap.get('evolution_api_key');
    const instanceName = settingsMap.get('evolution_instance_name');

    if (!apiUrl || !apiKey || !instanceName) {
      throw new Error('Configurações da Evolution API não encontradas');
    }

    console.log('Checking with Evolution API...');

    // Verificar se número existe no WhatsApp via Evolution API
    // Endpoint: POST /message/exists/{instance}
    const response = await fetch(`${apiUrl}/chat/whatsappNumbers/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        numbers: [normalizedPhone]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Evolution API error:', errorText);
      throw new Error(`Erro ao verificar número: ${errorText}`);
    }

    const result = await response.json();
    console.log('Evolution API result:', result);

    // Resultado da API: array com {jid, exists}
    const numberExists = result && result.length > 0 && result[0].exists === true;

    // Salvar/atualizar cache
    await supabase
      .from('whatsapp_number_verification')
      .upsert({
        phone_number: normalizedPhone,
        exists_on_whatsapp: numberExists,
        last_verified_at: new Date().toISOString()
      }, { onConflict: 'phone_number' });

    return new Response(
      JSON.stringify({
        success: true,
        exists: numberExists,
        phone_number: normalizedPhone,
        cached: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao verificar número:', error);
    
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
