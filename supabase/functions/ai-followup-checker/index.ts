import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// AI FOLLOWUP CHECKER
// Cron job que verifica conversas inativas e envia follow-ups
// Executar a cada 5 minutos via pg_cron ou webhook externo
// ============================================================

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const currentHour = new Date().getHours();
        const now = new Date();

        console.log(`🔄 Follow-up Checker executando às ${now.toISOString()}, hora local: ${currentHour}h`);

        // 1. Buscar conversas ativas que estão inativas há pelo menos 1 hora
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        const { data: inactiveConversations, error: convError } = await supabase
            .from('agent_conversations')
            .select(`
        id,
        phone_number,
        agent_id,
        last_message_at,
        current_stage,
        qualification_data,
        lead_score,
        customer_name,
        total_messages,
        ai_agents!inner ( evolution_instance_id )
      `)
            .eq('status', 'active')
            .lt('last_message_at', oneHourAgo)
            .order('last_message_at', { ascending: true })
            .limit(50);

        if (convError) {
            throw new Error(`Erro ao buscar conversas: ${convError.message}`);
        }

        console.log(`📋 Encontradas ${inactiveConversations?.length || 0} conversas inativas`);

        const results = {
            checked: inactiveConversations?.length || 0,
            followupsSent: 0,
            skipped: 0,
            errors: 0
        };

        for (const conv of inactiveConversations || []) {
            try {
                // 2. Buscar follow-ups já enviados para esta conversa
                const { data: sentFollowups } = await supabase
                    .from('agent_followup_log')
                    .select('sequence_order')
                    .eq('conversation_id', conv.id)
                    .order('sequence_order', { ascending: false })
                    .limit(1);

                const lastSentSequence = sentFollowups?.[0]?.sequence_order || 0;

                // 3. Buscar próximo follow-up na sequência
                const { data: nextFollowup } = await supabase
                    .from('agent_followups')
                    .select('*')
                    .eq('agent_id', conv.agent_id)
                    .eq('sequence_order', lastSentSequence + 1)
                    .eq('is_active', true)
                    .single();

                if (!nextFollowup) {
                    console.log(`  ⏭️ ${conv.phone_number}: Sem mais follow-ups configurados`);
                    results.skipped++;
                    continue;
                }

                // 4. Calcular tempo desde última mensagem
                const lastMessageTime = new Date(conv.last_message_at).getTime();
                const hoursSinceLastMessage = (Date.now() - lastMessageTime) / (1000 * 60 * 60);

                if (hoursSinceLastMessage < nextFollowup.delay_hours) {
                    console.log(`  ⏰ ${conv.phone_number}: Aguardando (${hoursSinceLastMessage.toFixed(1)}h < ${nextFollowup.delay_hours}h)`);
                    results.skipped++;
                    continue;
                }

                // 5. Verificar horário comercial
                if (currentHour < nextFollowup.send_after_hour || currentHour >= nextFollowup.send_before_hour) {
                    console.log(`  🌙 ${conv.phone_number}: Fora do horário (${currentHour}h, permitido: ${nextFollowup.send_after_hour}-${nextFollowup.send_before_hour}h)`);
                    results.skipped++;
                    continue;
                }

                // 6. Verificar condições especiais
                if (nextFollowup.skip_if_qualified && conv.lead_score && conv.lead_score >= 70) {
                    console.log(`  ✅ ${conv.phone_number}: Lead já qualificado, pulando`);
                    results.skipped++;
                    continue;
                }

                if (nextFollowup.only_if_stages && nextFollowup.only_if_stages.length > 0) {
                    if (!nextFollowup.only_if_stages.includes(conv.current_stage)) {
                        console.log(`  📍 ${conv.phone_number}: Estágio ${conv.current_stage} não elegível`);
                        results.skipped++;
                        continue;
                    }
                }

                // 7. Personalizar mensagem
                const personalizedMessage = personalizeMessage(
                    nextFollowup.message_template,
                    conv
                );

                // 8. Enviar follow-up
                console.log(`  📤 ${conv.phone_number}: Enviando follow-up #${nextFollowup.sequence_order}`);

                const { error: sendError } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
                    body: {
                        phone_number: conv.phone_number,
                        message: personalizedMessage,
                        typing_delay_ms: 2000 + Math.random() * 2000, // 2-4s delay humanizado
                        instance_id: (conv.ai_agents as any)?.evolution_instance_id
                    }
                });

                if (sendError) {
                    console.error(`  ❌ Erro ao enviar: ${sendError.message}`);
                    results.errors++;
                    continue;
                }

                // 9. Registrar no log
                await supabase.from('agent_followup_log').insert({
                    conversation_id: conv.id,
                    followup_id: nextFollowup.id,
                    sequence_order: nextFollowup.sequence_order,
                    message_sent: personalizedMessage
                });

                // 10. Salvar mensagem no histórico
                await supabase.from('agent_messages').insert({
                    conversation_id: conv.id,
                    role: 'assistant',
                    content: personalizedMessage,
                    intent_detected: 'followup',
                    action_taken: 'followup_sent'
                });

                // 11. Atualizar last_message_at
                await supabase
                    .from('agent_conversations')
                    .update({
                        last_message_at: new Date().toISOString(),
                        total_messages: (conv.total_messages || 0) + 1
                    })
                    .eq('id', conv.id);

                results.followupsSent++;
                console.log(`  ✅ Follow-up #${nextFollowup.sequence_order} enviado para ${conv.phone_number}`);

            } catch (convError: any) {
                console.error(`  ❌ Erro ao processar ${conv.phone_number}: ${convError.message}`);
                results.errors++;
            }
        }

        console.log(`\n📊 Resultado: ${results.followupsSent} enviados, ${results.skipped} pulados, ${results.errors} erros`);

        return new Response(
            JSON.stringify({
                success: true,
                ...results,
                duration: Date.now() - startTime
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('❌ Erro no Follow-up Checker:', error);

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                duration: Date.now() - startTime
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        );
    }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function personalizeMessage(template: string, conversation: any): string {
    let message = template;

    // Substituir variáveis
    const replacements: Record<string, string> = {
        '{{nome}}': conversation.customer_name || 'amigo(a)',
        '{{telefone}}': conversation.phone_number || '',
        '{{estagio}}': conversation.current_stage || 'conversa',
        '{{mensagens}}': String(conversation.total_messages || 0)
    };

    // Extrair dados de qualificação se disponíveis
    const qualData = conversation.qualification_data || {};
    if (qualData.preferred_neighborhood) {
        replacements['{{bairro}}'] = qualData.preferred_neighborhood;
    }
    if (qualData.property_type) {
        replacements['{{tipo_imovel}}'] = qualData.property_type;
    }
    if (qualData.max_price) {
        const priceK = Math.round(qualData.max_price / 1000);
        replacements['{{orcamento}}'] = `${priceK}k`;
    }

    for (const [variable, value] of Object.entries(replacements)) {
        message = message.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    // Remover variáveis não substituídas
    message = message.replace(/\{\{[^}]+\}\}/g, '');

    return message.trim();
}
