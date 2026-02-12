
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { normalizePhoneNumber, isValidBrazilianPhone } from '../_shared/phoneHelpers.ts';

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
    console.log('=== EVOLUTION CHECK NUMBER ===');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let body;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error('Invalid JSON payload');
    }
    const { phone_number } = body;

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
    // 1. Try to find an ACTIVE instance first (Best practice)
    let apiUrl = '';
    let apiKey = '';
    let instanceName = '';

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
    } else {
      // Fallback to system_settings
      const { data: settings } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

      const settingsMap = new Map(settings?.map((s: any) => [s.key, s.value]) || []);

      apiUrl = settingsMap.get('evolution_api_url');
      apiKey = settingsMap.get('evolution_api_key');
      instanceName = settingsMap.get('evolution_instance_name');
    }

    if (!apiUrl || !apiKey || !instanceName) {
      throw new Error('Configurações da Evolution API não encontradas');
    }

    // Normalize URL
    apiUrl = apiUrl.trim().replace(/\/$/, '');
    instanceName = instanceName.trim();

    console.log('Checking with Evolution API...', { apiUrl, instanceName });

    // Verificar se número existe no WhatsApp via Evolution API
    // Endpoint: POST /message/exists/{instance} or legacy /checkNumber ?
    // V2 suggests: /chat/whatsappNumbers/{instance} OR /chat/checkNumber/{instance} ? 
    // Evolution V2 usually has /chat/checkNumber or /chat/whatsappNumbers
    // The previous code used /chat/whatsappNumbers/{instance}
    // Let's stick to that but handle errors gracefully.

    // NOTE: Some Evolution versions uses /chat/checkNumber
    // Let's try standard V2 endpoint.

    const response = await fetch(`${apiUrl}/chat/whatsappNumbers/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        numbers: [normalizedPhone]
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Evolution API error:', errorText);
      // Fail gracefully? No, verification failure is important. But maybe just log and return success=false?
      // If ABI fails, we can't verify.
      throw new Error(`Erro ao verificar número: ${errorText}`);
    }

    const result = await response.json();
    console.log('Evolution API result:', result);

    // Resultado da API: array com {jid, exists}
    const numberExists = result && Array.isArray(result) && result.length > 0 && result[0].exists === true;

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

  } catch (error: any) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.error('Evolution API Timeout during check-number');
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution API Timeout' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 504 }
      );
    }
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
