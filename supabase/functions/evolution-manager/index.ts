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

        // SECURITY: Verify caller is authenticated and is admin
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: No authorization header' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            );
        }

        // Get the user from the JWT token
        const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );

        if (authError || !callerUser) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: Invalid token' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            );
        }

        // Verify role admin before proceeding
        const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
            _user_id: callerUser.id,
            _role: 'admin'
        });

        if (roleError || !isAdmin) {
            return new Response(
                JSON.stringify({ error: 'Forbidden: Caller is not an administrator' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            );
        }

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
                    let errorMessage = responseData.message || responseData.error || (responseData.response?.message);
                    if (!errorMessage) {
                        if (response.status === 404) {
                            errorMessage = `Servidor Evolution API retornou 404 (Não Encontrado) para o endpoint '${endpoint}'. Certifique-se de que a URL base está correta e corresponde à versão V2.`;
                        } else if (response.status === 401 || response.status === 403) {
                            errorMessage = `Não autorizado (Status ${response.status}). A API Key configurada é inválida ou não possui permissão para esta ação.`;
                        } else {
                            errorMessage = `Erro ${response.status}: ${text || 'Sem resposta do servidor'}`;
                        }
                    } else if (typeof errorMessage === 'object') {
                        errorMessage = JSON.stringify(errorMessage);
                    }
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
            case 'create': {
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
                            token: payload.token || undefined,
                            qrcode: true,
                            integration: "WHATSAPP-BAILEYS"
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
                        if (strData.includes('already exists') || strData.includes('already in use')) {
                            console.log(`Instance ${instanceName} already exists/in-use in Evolution. Proceeding to register in DB.`);
                        } else {
                            let errMsg = '';
                            if (createData.response?.message) {
                                if (Array.isArray(createData.response.message)) {
                                    errMsg = createData.response.message.join(', ');
                                } else {
                                    errMsg = typeof createData.response.message === 'object'
                                        ? JSON.stringify(createData.response.message)
                                        : String(createData.response.message);
                                }
                            } else {
                                errMsg = createData.message || createData.error || 'Failed to create instance in Evolution API';
                            }
                            
                            if (createResponse.status === 401 || createResponse.status === 403) {
                                errMsg = `Não autorizado (Status ${createResponse.status}). A API Key ou token fornecido é inválido. Verifique suas credenciais. Detalhes: ${errMsg}`;
                            } else if (createResponse.status === 404) {
                                errMsg = `O endpoint de criação de instância retornou 404. Certifique-se de que a URL da API está correta (ex: https://sua-api.com) e corresponde à Evolution API V2. Detalhes: ${errMsg}`;
                            } else {
                                errMsg = `Erro ${createResponse.status}: ${errMsg}`;
                            }
                            throw new Error(errMsg);
                        }
                    }
                } catch (error: any) {
                    const errStr = error.message?.toLowerCase() || '';
                    if (errStr.includes('already exists') || errStr.includes('already in use')) {
                        console.log(`Instance ${instanceName} already exists/in-use (caught error). Proceeding to register in DB.`);
                    } else {
                        throw error;
                    }
                }

                // 2. Register in DB
                // EVO-05: Deactivate all other instances before creating a new active one
                await supabase
                    .from('evolution_instances')
                    .update({ is_active: false })
                    .neq('id', 'new'); // Updates all existing rows

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
            }

            case 'connect': {
                const instConnect = await getInstance(instance_id!);
                const connectData = await evoCall(instConnect, `/instance/connect/${instConnect.instance_name}`);
                result = connectData;
                break;
            }

            case 'connectionState': {
                const instState = await getInstance(instance_id!);
                const stateData = await evoCall(instState, `/instance/connectionState/${instState.instance_name}`);
                result = stateData;
                break;
            }

            case 'fetch': {
                const instFetch = await getInstance(instance_id!);
                let fetchData;
                try {
                    // Try V2 connectionState endpoint first
                    fetchData = await evoCall(instFetch, `/instance/connectionState/${instFetch.instance_name}`);
                } catch (e: any) {
                    console.log(`Failed to fetch connectionState, trying V2 list endpoint /instance: ${e.message}`);
                    try {
                        fetchData = await evoCall(instFetch, `/instance`);
                    } catch (e2: any) {
                        console.log(`Failed V2 list, falling back to V1 /instance/fetchInstances: ${e2.message}`);
                        fetchData = await evoCall(instFetch, `/instance/fetchInstances`);
                    }
                }
                
                if (Array.isArray(fetchData)) {
                    const match = fetchData.find((i: any) => i.instance?.instanceName === instFetch.instance_name || i.instanceName === instFetch.instance_name);
                    if (!match) {
                        throw new Error(`A instância '${instFetch.instance_name}' não foi encontrada no servidor Evolution API.`);
                    }
                    result = match;
                } else {
                    result = fetchData;
                }
                break;
            }

            case 'restart': {
                const instRestart = await getInstance(instance_id!);
                result = await evoCall(instRestart, `/instance/restart/${instRestart.instance_name}`, 'PUT');
                break;
            }

            case 'logout': {
                const instLogout = await getInstance(instance_id!);
                result = await evoCall(instLogout, `/instance/logout/${instLogout.instance_name}`, 'DELETE');
                break;
            }

            case 'delete': {
                const instDelete = await getInstance(instance_id!);
                // EVO-09: Surface Evolution API delete errors as warnings instead of swallowing
                let evoDeleteWarning: string | null = null;
                try {
                    await evoCall(instDelete, `/instance/delete/${instDelete.instance_name}`, 'DELETE');
                } catch (e: any) {
                    evoDeleteWarning = e.message || 'Failed to delete from Evolution API';
                    console.warn('Evolution API delete warning:', evoDeleteWarning);
                }

                const { error: delError } = await supabase
                    .from('evolution_instances')
                    .delete()
                    .eq('id', instance_id);

                if (delError) throw delError;
                result = {
                    success: true,
                    ...(evoDeleteWarning ? { warning: `Instance removed from DB. Evolution API note: ${evoDeleteWarning}` } : {})
                };
                break;
            }

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
                status: 200
            }
        );
    }
});
