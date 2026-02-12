import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManagerRequest {
    action: 'create' | 'connect' | 'items' | 'restart' | 'logout' | 'delete' | 'fetch' | 'connectionState';
    instance_id?: string;
    payload?: any;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { action, instance_id, payload }: ManagerRequest = await req.json();

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
        const evoCall = async (instance: any, endpoint: string, method: string = 'GET', body?: any) => {
            const url = `${instance.api_url.replace(/\/$/, '')}${endpoint}`;
            console.log(`📡 Evo Call: ${method} ${url}`);

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': instance.api_token
                },
                body: body ? JSON.stringify(body) : undefined
            });

            const text = await response.text();
            let data;
            try {
                data = text ? JSON.parse(text) : {};
            } catch (e) {
                // If not JSON, wrapped in object
                data = { raw: text };
            }

            if (!response.ok) {
                const errorMessage = data.message || data.error || (data.response?.message) || `Error ${response.status}: ${text}`;
                throw new Error(errorMessage);
            }
            return data;
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
                        })
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
                        // Check if instance already exists
                        if (strData.includes('already exists')) {
                            console.log(`Instance ${instanceName} already exists in Evolution. Proceeding to register in DB.`);
                        } else {
                            const errMsg = createData.message || createData.error || 'Failed to create instance in Evolution API';
                            throw new Error(errMsg);
                        }
                    }
                } catch (error: any) {
                    // Check if instance already exists (fallback for network level checks or standard errors)
                    if (error.message?.toLowerCase().includes('already exists')) {
                        console.log(`Instance ${instanceName} already exists (caught error). Proceeding to register in DB.`);
                    } else {
                        // If it fails to connect to Evolution, we might still want to register IF the user insists, but typically not.
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
                result = stateData; // { instance: ..., state: "open" | "close" | "connecting" }
                break;

            case 'fetch':
                const instFetch = await getInstance(instance_id!);
                const fetchData = await evoCall(instFetch, `/instance/fetchInstances?instanceName=${instFetch.instance_name}`);
                // Evolution V2 returns array for this endpoint if no instanceName, or if instanceName is provided it returns object OR array of 1.
                // Safely handle both.
                if (Array.isArray(fetchData)) {
                    // Try to find the specific instance in the array
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
                // 1. Delete from Evolution
                try {
                    await evoCall(instDelete, `/instance/delete/${instDelete.instance_name}`, 'DELETE');
                } catch (e) {
                    console.warn('Failed to delete from Evolution (might not exist):', e);
                }

                // 2. Delete from DB
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
        console.error(`❌ Manager Error (${req.url}):`, error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            }
        );
    }
});
