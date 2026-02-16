
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { logIntegration } from '../_shared/integration-logger.ts';
import { DbEvolutionInstance } from '../_shared/types/evolution.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    // Basic CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log('👷 Evolution Queue Worker started');

        // 1. Fetch pending messages (limit 10 per run to avoid timeouts)
        // Ideally use RPC for atomic lock, but simple update loop works for low volume

        // Fetch pending items
        const { data: pendingItems, error: fetchError } = await supabase
            .from('message_queue')
            .select('*')
            .eq('status', 'pending')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(10);

        if (fetchError) throw fetchError;

        if (!pendingItems || pendingItems.length === 0) {
            console.log('📭 Queue is empty');
            return new Response(JSON.stringify({ message: 'Queue empty' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`Processing ${pendingItems.length} messages...`);
        const results = [];

        for (const item of pendingItems) {
            const startTime = Date.now();
            let processStatus = 'failed';
            let errorMsg = null;
            let responseData = null;

            try {
                // Lock item
                await supabase.from('message_queue').update({ status: 'processing', last_attempt: new Date().toISOString() }).eq('id', item.id);

                // Get instance
                let instance: DbEvolutionInstance | null = null;
                if (item.instance_id) {
                    const { data } = await supabase.from('evolution_instances').select('*').eq('id', item.instance_id).single();
                    instance = data;
                } else {
                    // Get active
                    const { data } = await supabase.from('evolution_instances').select('*').eq('is_active', true).maybeSingle();
                    instance = data;
                }

                if (!instance) throw new Error('No active Evolution instance found');

                // Determine payload from message_queue.message_body
                const payload = item.message_body;

                // Construct URL
                // We assume payload has 'type' ('text', 'media', 'list') to know endpoint, or just direct pass if we standardized before queueing.
                // Let's standardise the queue payload to match `evolution-send-whatsapp-v2` logic or just map it here.
                // Better: The queue payload should have `type`, `endpoint` (suffix), and `body`.

                let endpoint = '';
                let apiBody = {};

                if (payload.type === 'text') {
                    endpoint = `/message/sendText/${instance.instance_name}`;
                    apiBody = {
                        number: item.phone_number,
                        text: payload.text || payload.message
                    };
                } else if (payload.type === 'media') {
                    endpoint = `/message/sendMedia/${instance.instance_name}`;
                    apiBody = {
                        number: item.phone_number,
                        mediatype: payload.media?.type || 'image',
                        media: payload.media?.url,
                        caption: payload.media?.caption,
                        fileName: payload.media?.filename
                    };
                } else if (payload.type === 'list') {
                    endpoint = `/message/sendList/${instance.instance_name}`;
                    apiBody = {
                        number: item.phone_number,
                        title: payload.list?.title,
                        description: payload.list?.description,
                        buttonText: payload.list?.buttonText,
                        sections: payload.list?.sections
                    };
                } else if (payload.type === 'buttons') {
                    endpoint = `/message/sendButtons/${instance.instance_name}`;
                    apiBody = {
                        number: item.phone_number,
                        title: 'Opções',
                        description: payload.message || '',
                        buttons: payload.buttons.map((b: any) => ({
                            id: b.id,
                            displayText: b.text || b.displayText
                        }))
                    };
                } else {
                    // Fallback generic
                    endpoint = `/message/sendText/${instance.instance_name}`;
                    apiBody = { number: item.phone_number, text: JSON.stringify(payload) };
                }

                const url = `${instance.api_url.replace(/\/$/, '')}${endpoint}`;

                // Send
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': instance.api_token },
                    body: JSON.stringify(apiBody),
                    signal: AbortSignal.timeout(15000)
                });

                const text = await response.text();
                try { responseData = JSON.parse(text); } catch { responseData = { raw: text }; }

                if (!response.ok) {
                    throw new Error(responseData?.message || `API Error ${response.status}`);
                }

                processStatus = 'completed';
                results.push({ id: item.id, status: 'success', data: responseData });

            } catch (err: any) {
                console.error(`Failed to process message ${item.id}:`, err);
                errorMsg = err.message;
                processStatus = 'failed';
                results.push({ id: item.id, status: 'error', error: err.message });
            } finally {
                // Update queue
                const updateData: any = {
                    status: processStatus,
                    processed_at: new Date().toISOString(),
                    attempts: (item.attempts || 0) + 1
                };

                if (processStatus === 'failed') {
                    updateData.error_message = errorMsg;
                    if ((item.attempts || 0) < 3) {
                        updateData.status = 'pending'; // Retry later
                    } else {
                        // EVO-06: Dead-letter alerting — log permanently failed messages
                        await supabase.from('agent_activity_log').insert({
                            activity_type: 'dead_letter',
                            activity_data: {
                                queue_id: item.id,
                                phone_number: item.phone_number,
                                error: errorMsg,
                                attempts: (item.attempts || 0) + 1,
                                message_type: item.message_type || 'text',
                                alert: 'Message permanently failed after max retries'
                            }
                        }).catch((e: any) => console.warn('Dead-letter log error:', e));
                    }
                }

                await supabase.from('message_queue').update(updateData).eq('id', item.id);

                // Log integration
                if (item.instance_id || item.phone_number) { // Only if we have some context
                    await logIntegration(supabase, {
                        service: 'evolution-api-queue',
                        endpoint: 'worker',
                        method: 'PROCESS',
                        status_code: processStatus === 'completed' ? 200 : 500,
                        duration_ms: Date.now() - startTime,
                        metadata: { queue_id: item.id, error: errorMsg }
                    });
                }
            }
        }

        return new Response(JSON.stringify({ success: true, processed: results.length, details: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
