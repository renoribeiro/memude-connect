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
    // CRÍTICO: Usar SERVICE_ROLE_KEY para acessar system_settings
    // ANON_KEY não bypassa RLS, causando erro "Nenhuma configuração encontrada"
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log de diagnóstico para confirmar qual chave está sendo usada
    console.log('🔧 Supabase client initialized:', {
      url: !!Deno.env.get('SUPABASE_URL'),
      keyType: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'SERVICE_ROLE ✅' : 
               Deno.env.get('SUPABASE_ANON_KEY') ? 'ANON ❌' : 'NONE ❌',
      timestamp: new Date().toISOString()
    });

    // Get Evolution API settings
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

    if (settingsError) throw settingsError;

    // FASE 2: Log da query de settings
    console.log('Settings query result:', {
      count: settings?.length,
      keys: settings?.map(s => s.key),
      hasData: !!settings && settings.length > 0
    });

    // FASE 2: Verificar se a query retornou dados
    if (!settings || settings.length === 0) {
      throw new Error('Nenhuma configuração encontrada no banco de dados. Verifique as políticas RLS da tabela system_settings.');
    }

    const settingsMap = settings.reduce((acc: any, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    // Validar configurações
    const requiredSettings = {
      evolution_api_url: settingsMap.evolution_api_url?.trim(),
      evolution_api_key: settingsMap.evolution_api_key?.trim(),
      evolution_instance_name: settingsMap.evolution_instance_name?.trim()
    };

    const missingSettings = Object.entries(requiredSettings)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    // FASE 2: Melhorar mensagem de erro
    if (missingSettings.length > 0) {
      console.error('Missing settings details:', requiredSettings);
      throw new Error(`Configurações vazias ou faltando: ${missingSettings.join(', ')}. Valores recebidos: ${JSON.stringify(requiredSettings)}`);
    }

    // Validar formato da URL
    try {
      new URL(settingsMap.evolution_api_url);
    } catch {
      throw new Error('URL da Evolution API inválida. Use formato: https://sua-api.com');
    }

    console.log('Testing Evolution API V2 connection:', {
      url: settingsMap.evolution_api_url,
      instance: settingsMap.evolution_instance_name,
      hasApiKey: !!settingsMap.evolution_api_key
    });

    // Check instance status - Evolution API V2
    const apiUrl = settingsMap.evolution_api_url.replace(/\/$/, '');
    
    console.log('=== EVOLUTION API DEBUG ===');
    console.log('1. URL Base:', apiUrl);
    console.log('2. Instance Name:', settingsMap.evolution_instance_name);
    console.log('3. API Key present:', !!settingsMap.evolution_api_key);
    
    // FASE 6: Adicionar timeout de 10 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let evolutionResponse;
    let evolutionData;
    let instanceInfo: any;

    try {
      // FASE 6: Teste básico de conectividade
      try {
        const pingResponse = await fetch(`${apiUrl}/`, {
          method: 'GET',
          signal: controller.signal
        });
        console.log('4. API base URL accessible:', pingResponse.status !== 404);
      } catch (err) {
        console.warn('Could not reach API base URL');
      }

      // FASE 1: Endpoint correto - /instance/fetchInstances
      const instanceUrl = `${apiUrl}/instance/fetchInstances?instanceName=${settingsMap.evolution_instance_name}`;
      console.log('5. Full Endpoint:', instanceUrl);

      evolutionResponse = await fetch(instanceUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settingsMap.evolution_api_key,
        },
        signal: controller.signal
      });
      
      evolutionData = await evolutionResponse.json();
      
      console.log('6. Response Status:', evolutionResponse.status);
      console.log('7. Response OK:', evolutionResponse.ok);
      console.log('8. Response Data Type:', Array.isArray(evolutionData) ? 'array' : typeof evolutionData);
      console.log('9. Response Keys:', evolutionData ? Object.keys(evolutionData) : 'null');
      console.log('===========================');

      // FASE 2: Fallback para listar todas as instâncias se 404
      if (evolutionResponse.status === 404) {
        console.log('Specific instance not found, fetching all instances...');
        clearTimeout(timeoutId);
        const timeoutId2 = setTimeout(() => controller.abort(), 10000);
        
        evolutionResponse = await fetch(`${apiUrl}/instance/fetchInstances`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': settingsMap.evolution_api_key,
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId2);
        
        if (evolutionResponse.ok) {
          const allInstances = await evolutionResponse.json();
          console.log('All instances fetched:', Array.isArray(allInstances) ? allInstances.length : 'not an array');
          
          if (Array.isArray(allInstances)) {
            const targetInstance = allInstances.find(
              (inst: any) => inst.instance?.instanceName === settingsMap.evolution_instance_name
            );
            
            if (!targetInstance) {
              throw new Error(`Instância "${settingsMap.evolution_instance_name}" não encontrada. Verifique o nome da instância nas configurações da Evolution API.`);
            }
            
            evolutionData = targetInstance;
          } else {
            evolutionData = allInstances;
          }
        }
      }
      
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Timeout: Evolution API não respondeu em 10 segundos. Verifique se a URL está correta.');
      }
      throw new Error(`Erro ao conectar: ${fetchError.message}`);
    }

    if (!evolutionResponse.ok) {
      console.error('Evolution API connection error:', {
        status: evolutionResponse.status,
        statusText: evolutionResponse.statusText,
        data: evolutionData
      });
      
      if (evolutionResponse.status === 404) {
        throw new Error(`Endpoint não encontrado. Verifique se a URL está correta: ${apiUrl}/instance/fetchInstances`);
      }
      
      if (evolutionResponse.status === 401 || evolutionResponse.status === 403) {
        throw new Error('API Key inválida. Verifique a chave de API nas configurações.');
      }
      
      throw new Error(`Erro de conexão (${evolutionResponse.status}): ${evolutionData?.message || evolutionData?.error || 'API inacessível'}`);
    }

    // FASE 3: Validar estrutura da resposta
    if (Array.isArray(evolutionData)) {
      if (evolutionData.length === 0) {
        throw new Error('Nenhuma instância encontrada na Evolution API');
      }
      // A API retorna array de instâncias, pegar a primeira
      instanceInfo = evolutionData[0];
    } else {
      // Se não for array, assumir que é objeto único
      instanceInfo = evolutionData;
    }

    // Validar que tem os campos necessários
    if (!instanceInfo?.name && !instanceInfo?.connectionStatus) {
      console.error('Unexpected API response structure:', evolutionData);
      throw new Error('Estrutura de resposta inesperada da Evolution API');
    }

    console.log('Connection check successful:', instanceInfo);
    
    // FASE 4: Logging de debug do connectionStatus
    console.log('Instance validation:', {
      hasConnectionStatus: !!instanceInfo?.connectionStatus,
      connectionStatus: instanceInfo?.connectionStatus,
      instanceName: instanceInfo?.name,
      isConnected: instanceInfo?.connectionStatus === 'open'
    });
    
    const isConnected = instanceInfo?.connectionStatus === 'open';

    return new Response(
      JSON.stringify({ 
        success: true,
        connected: isConnected,
        instance_state: instanceInfo?.connectionStatus || 'unknown',
        instance_name: settingsMap.evolution_instance_name,
        data: instanceInfo
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in evolution-check-connection function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        connected: false,
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 but with success: false
      }
    );
  }
});