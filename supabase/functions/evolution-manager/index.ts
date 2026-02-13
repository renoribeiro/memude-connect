import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { logIntegration } from '../_shared/integration-logger.ts';
import { DbEvolutionInstance } from '../_shared/types/evolution.ts';


const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManagerRequest {
    action: 'create' | 'connect' | 'items' | 'restart' | 'logout' | 'delete' | 'fetch' | 'connectionState';
    instance_id?: string;
    payload?: any;
}

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

        let body;
        try {
            body = await req.json();
        } catch (e) {
            throw new Error('Invalid JSON payload');
        }

        const { action, instance_id, payload } = body as ManagerRequest;

        console.log(`🤖 Evolution Manager: ${action}`, { instance_id });

        // Helper to get instance data
        const getInstance = async (id: string) => {
            const { data, error } = await supabase
                .from('evolution_instances')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !data) throw new Error(`Instance not found: ${id}`);
            return data;
        };

        // Helper to make Evolution API calls

        const evoCall = async (instance: DbEvolutionInstance, endpoint: string, method: string = 'GET', body?: any) => {
            const url = `${instance.api_url.replace(/\/$/, '')}${endpoint}`;
            console.log(`📡 Evo Call: ${method} ${url}`);

            const startTime = Date.now();
            let responseStatus = 0;
            let responseData: any = null;

            try {
                const response = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': instance.api_token
                    },
                    body: body ? JSON.stringify(body) : undefined,
                    signal: AbortSignal.timeout(15000) // 15s timeout
                });

                responseStatus = response.status;
                const text = await response.text();

                try {
                    responseData = text ? JSON.parse(text) : {};
                } catch (e) {
                    responseData = { raw: text };
                }

                if (!response.ok) {
                    const errorMessage = responseData.message || responseData.error || (responseData.response?.message) || `Error ${response.status}: ${text}`;
                    throw new Error(errorMessage);
                }
                return responseData;
            } catch (err: any) {
                if (err.name === 'AbortError' || err.name === 'TimeoutError') {
                    responseData = { error: 'Timeout' };
                    throw new Error(`Evolution API timed out after 15s`);
                }
                responseData = { error: err.message };
                throw err;
            } finally {
                // Log the integration event
                await logIntegration(supabase, {
                    service: 'evolution-api',
                    endpoint: endpoint,
                    method: method,
                    status_code: responseStatus,
                    request_payload: body,
                    response_body: responseData,
                    duration_ms: Date.now() - startTime,
                    metadata: { instance_name: instance.instance_name }
                });
            }
        };

        let result;

        switch (action) {
            case 'create':
                const { instanceName, raw_url, raw_apikey } = payload;
                if (!instanceName || !raw_url || !raw_apikey) {
                    throw new Error("Missing required fields: instanceName, raw_url, raw_apikey");
                }
                const apiUrl = raw_url.replace(/\/$/, '');

                // 1. Try to create in Evolution API
                try {
                    const createResponse = await fetch(`${apiUrl}/instance/create`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': raw_apikey
                        },
                        body: JSON.stringify({
                            instanceName: instanceName,
                            token: payload.token,
                            qrcode: true
                        }),
                        signal: AbortSignal.timeout(10000)
                    });

                    const text = await createResponse.text();
                    let createData;
                    try {
                        createData = JSON.parse(text);
                    } catch (e) {
                        createData = { message: text };
                    }

                    if (!createResponse.ok) {
                        const strData = JSON.stringify(createData).toLowerCase();
                        if (strData.includes('already exists')) {
                            console.log(`Instance ${instanceName} already exists in Evolution. Proceeding to register in DB.`);
                        } else {
                            const errMsg = createData.message || createData.error || 'Failed to create instance in Evolution API';
                            throw new Error(errMsg);
                        }
                    }
                } catch (error: any) {
                    if (error.message?.toLowerCase().includes('already exists')) {
                        console.log(`Instance ${instanceName} already exists (caught error). Proceeding to register in DB.`);
                    } else {
                        // Throw unless it's a fetch error that we want to bypass? No, creation failure is usually fatal.
                        // But if we can't reach the API, we definitely shouldn't create in DB? 
                        // Actually, user might want to register valid instance even if currently offline? 
                        // Let's stick to throwing error for safety.
                        throw error;
                    }
                }

                // 2. Register in DB
                const { data: newInstance, error: dbError } = await supabase
                    .from('evolution_instances')
                    .insert({
                        name: payload.name || instanceName,
                        instance_name: instanceName,
                        api_url: apiUrl,
                        api_token: raw_apikey,
                        is_active: true
                    })
                    .select()
                    .single();

                if (dbError) throw dbError;
                result = newInstance;
                break;

            case 'connect':
                const instConnect = await getInstance(instance_id!);
                const connectData = await evoCall(instConnect, `/instance/connect/${instConnect.instance_name}`);
                result = connectData;
                break;

            case 'connectionState':
                const instState = await getInstance(instance_id!);
                const stateData = await evoCall(instState, `/instance/connectionState/${instState.instance_name}`);
                result = stateData;
                break;

            case 'fetch':
                const instFetch = await getInstance(instance_id!);
                const fetchData = await evoCall(instFetch, `/instance/fetchInstances?instanceName=${instFetch.instance_name}`);
                if (Array.isArray(fetchData)) {
                    result = fetchData.find((i: any) => i.instance?.instanceName === instFetch.instance_name || i.instanceName === instFetch.instance_name) || fetchData[0];
                } else {
                    result = fetchData;
                }
                break;

            case 'restart':
                const instRestart = await getInstance(instance_id!);
                result = await evoCall(instRestart, `/instance/restart/${instRestart.instance_name}`, 'PUT');
                break;

            case 'logout':
                const instLogout = await getInstance(instance_id!);
                result = await evoCall(instLogout, `/instance/logout/${instLogout.instance_name}`, 'DELETE');
                break;

            case 'delete':
                const instDelete = await getInstance(instance_id!);
                try {
                    await evoCall(instDelete, `/instance/delete/${instDelete.instance_name}`, 'DELETE');
                } catch (e) {
                    console.warn('Failed to delete from Evolution (might not exist):', e);
                }

                const { error: delError } = await supabase
                    .from('evolution_instances')
                    .delete()
                    .eq('id', instance_id);

                if (delError) throw delError;
                result = { success: true };
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(
            JSON.stringify({ success: true, data: result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error(`❌ Manager Error:`, error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            }
        );
    }
});
