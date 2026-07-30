
import { logIntegration } from '../_shared/integration-logger.ts';
import { DbEvolutionInstance } from '../_shared/types/evolution.ts';
import { authorize, handleOptions, validateExternalHttpUrl } from '../_shared/security.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'https://core.memudecore.com.br',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    const optionsResponse = handleOptions(req);
    if (optionsResponse) return optionsResponse;

    try {
        const access = await authorize(req, 'admin-or-internal');
        if (access instanceof Response) return access;
        const { supabase } = access;

        // 1. Get all active instances
        const { data: instances, error } = await supabase
            .from('evolution_instances')
            .select('*')
            .eq('is_active', true);

        if (error) throw error;

        const results = [];

        for (const instance of (instances as DbEvolutionInstance[])) {
            const startTime = Date.now();
            let status = 'unknown';
            let responseData: any = {};
            let statusCode = 0;

            try {
                const baseUrl = validateExternalHttpUrl(instance.api_url).toString().replace(/\/$/, '');
                const url = `${baseUrl}/instance/connectionState/${encodeURIComponent(instance.instance_name)}`;
                console.log(`Checking health for ${instance.instance_name} at ${url}`);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'apikey': instance.api_token,
                        'Content-Type': 'application/json'
                    },
                    signal: AbortSignal.timeout(10000) // 10s timeout
                });

                statusCode = response.status;
                const text = await response.text();
                try {
                    responseData = JSON.parse(text);
                } catch {
                    responseData = { raw: text };
                }

                if (response.ok) {
                    // V2 response structure: { instance: { state: "open" } } or just { state: "open" } ?
                    // Based on doc: usually { instance: { state: 'open' }, ... }
                    status = responseData?.instance?.state || responseData?.state || 'unknown';
                } else {
                    status = 'error';
                }

            } catch (err: any) {
                console.error(`Health check failed for ${instance.instance_name}:`, err);
                status = 'unreachable';
                responseData = { error: err.message };
            } finally {
                // 3. Auto-Reconnect Logic (Self-Healing)
                if (status === 'close' || status === 'unreachable') {
                    console.log(`⚠️ Instance ${instance.instance_name} is ${status}. Attempting auto-restart...`);

                    try {
                        const baseUrl = validateExternalHttpUrl(instance.api_url).toString().replace(/\/$/, '');
                        const restartUrl = `${baseUrl}/instance/restart/${encodeURIComponent(instance.instance_name)}`;
                        // EVO-04: Capture actual response status code
                        const restartResponse = await fetch(restartUrl, {
                            method: 'PUT',
                            headers: {
                                'apikey': instance.api_token,
                                'Content-Type': 'application/json'
                            },
                            signal: AbortSignal.timeout(10000)
                        });

                        console.log(`✅ Auto-restart command sent for ${instance.instance_name} (status: ${restartResponse.status})`);

                        // Log restart attempt with actual status code
                        await logIntegration(supabase, {
                            service: 'evolution-api',
                            endpoint: '/instance/restart',
                            method: 'PUT',
                            status_code: restartResponse.status,
                            duration_ms: Date.now() - startTime,
                            metadata: {
                                instance_name: instance.instance_name,
                                check_type: 'auto_healing',
                                reason: `Status was ${status}`
                            }
                        });

                    } catch (restartError: any) {
                        console.error(`❌ Auto-restart failed for ${instance.instance_name}:`, restartError);

                        await logIntegration(supabase, {
                            service: 'evolution-api',
                            endpoint: '/instance/restart',
                            method: 'PUT',
                            status_code: 500,
                            response_body: { error: restartError.message },
                            duration_ms: Date.now() - startTime,
                            metadata: {
                                instance_name: instance.instance_name,
                                check_type: 'auto_healing_failed',
                            }
                        });
                    }
                }

                // Log integration (Health Check)
                await logIntegration(supabase, {
                    service: 'evolution-api',
                    endpoint: '/instance/connectionState',
                    method: 'GET',
                    status_code: statusCode,
                    response_body: responseData,
                    duration_ms: Date.now() - startTime,
                    metadata: {
                        instance_name: instance.instance_name,
                        check_type: 'health_check',
                        final_status: status
                    }
                });

                // Update DB
                await supabase
                    .from('evolution_instances')
                    .update({
                        connection_status: status,
                        last_health_check: new Date().toISOString()
                    })
                    .eq('id', instance.id);

                results.push({
                    instance: instance.instance_name,
                    status,
                    auto_reconnect_attempted: (status === 'close' || status === 'unreachable'),
                    last_check: new Date().toISOString()
                });
            }
        }

        return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Health check global error:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
