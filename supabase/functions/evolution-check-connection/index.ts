
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔧 Supabase client initialized');

    let instance_id;
    try {
      const body = await req.json();
      instance_id = body.instance_id;
    } catch (e) {
      // Body might be empty or invalid, ignore
    }

    let settingsMap: any = {};
    let usingLegacySettings = false;

    // 1. Try to get specific instance or active instance from DB
    let instanceData;

    if (instance_id) {
      const { data } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('id', instance_id)
        .single();
      instanceData = data;
    } else {
      // If no ID, try to find the first ACTIVE instance
      const { data } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      instanceData = data;
    }

    if (instanceData) {
      settingsMap = {
        evolution_api_url: instanceData.api_url,
        evolution_api_key: instanceData.api_token,
        evolution_instance_name: instanceData.instance_name
      };
      console.log(`Using Evolution Instance from DB: ${instanceData.name}`);
    } else {
      // 2. Fallback to system_settings
      console.log('No active instance found in DB. Falling back to system_settings.');
      usingLegacySettings = true;

      const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

      if (settingsError) throw settingsError;

      if (!settings || settings.length === 0) {
        throw new Error('Nenhuma configuração encontrada (Nem instância ativa, nem settings legados).');
      }

      settingsMap = settings.reduce((acc: any, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});
    }

    // Validar configurações
    const requiredSettings = {
      evolution_api_url: settingsMap.evolution_api_url?.trim(),
      evolution_api_key: settingsMap.evolution_api_key?.trim(),
      evolution_instance_name: settingsMap.evolution_instance_name?.trim()
    };

    const missingSettings = Object.entries(requiredSettings)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingSettings.length > 0) {
      // EVO-08: Only log which keys are missing, never log actual values
      console.error('Missing settings:', missingSettings.join(', '));
      throw new Error(`Configurações vazias ou faltando: ${missingSettings.join(', ')}.`);
    }

    // Validar formato da URL
    try {
      new URL(settingsMap.evolution_api_url);
    } catch {
      throw new Error('URL da Evolution API inválida. Use formato: https://sua-api.com');
    }

    console.log('Testing Evolution API V2 connection:', {
      url: settingsMap.evolution_api_url,
      instance: settingsMap.evolution_instance_name
    });

    // Check instance status - Evolution API V2
    const apiUrl = settingsMap.evolution_api_url.replace(/\/$/, '');

    // Use AbortSignal.timeout for simpler timeout handling
    try {
      const instanceUrl = `${apiUrl}/instance/fetchInstances?instanceName=${settingsMap.evolution_instance_name}`;

      let evolutionResponse = await fetch(instanceUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settingsMap.evolution_api_key,
        },
        signal: AbortSignal.timeout(10000)
      });

      // Handle 404 by trying to list all
      if (evolutionResponse.status === 404) {
        console.log('Specific instance not found, fetching all instances...');
        evolutionResponse = await fetch(`${apiUrl}/instance/fetchInstances`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': settingsMap.evolution_api_key,
          },
          signal: AbortSignal.timeout(10000)
        });
      }

      const text = await evolutionResponse.text();
      let evolutionData;
      try {
        evolutionData = text ? JSON.parse(text) : {};
      } catch (e) {
        evolutionData = { raw: text };
      }

      if (!evolutionResponse.ok) {
        if (evolutionResponse.status === 401 || evolutionResponse.status === 403) {
          throw new Error('API Key inválida.');
        }
        throw new Error(`Erro de conexão (${evolutionResponse.status}): ${evolutionData?.message || text}`);
      }

      // Logic to extract instance info
      let instanceInfo: any;
      if (Array.isArray(evolutionData)) {
        if (evolutionData.length === 0) throw new Error('Nenhuma instância encontrada na Evolution API');

        // Try to match name
        const match = evolutionData.find((i: any) => i.instance?.instanceName === settingsMap.evolution_instance_name || i.instanceName === settingsMap.evolution_instance_name);
        instanceInfo = match || evolutionData[0];
      } else {
        instanceInfo = evolutionData;
      }

      // Check connection status
      // V2 usually has instance: { ... } inside payload or flat.
      // normalize
      const status = instanceInfo?.instance?.state || instanceInfo?.state || instanceInfo?.connectionStatus || 'unknown';
      const isConnected = status === 'open';

      return new Response(
        JSON.stringify({
          success: true,
          connected: isConnected,
          instance_state: status,
          instance_name: settingsMap.evolution_instance_name,
          data: instanceInfo
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
        throw new Error('Timeout: Evolution API não respondeu em 10 segundos.');
      }
      throw new Error(`Erro ao conectar: ${fetchError.message}`);
    }

  } catch (error: any) {
    console.error('Error in evolution-check-connection:', error);
    // EVO-03: Return proper HTTP error status so errors are surfaced correctly
    return new Response(
      JSON.stringify({
        success: false,
        connected: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});