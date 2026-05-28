import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// AI FOLLOWUP CHECKER
// Cron job que verifica conversas inativas e envia follow-ups
// VERSÃO 2.0 - Suporte a áudio pré-gravado + bugs corrigidos
// Executar a cada 5 minutos via pg_cron ou webhook externo
// ============================================================

// ============================================================
// BUG-03 FIX: Retorna hora atual no fuso do agente (padrão: UTC-3 Brasília)
// ============================================================
function getCurrentHourInTimezone(timezoneOffset: number = -3): number {
    const utcMs = Date.now();
    const localMs = utcMs + timezoneOffset * 60 * 60 * 1000;
    return new Date(localMs).getUTCHours();
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();

    // ============================================================
    // CRON AUTHENTICATION
    // Permite autenticação via CRON_SECRET, SERVICE_ROLE, ou INTERNAL_DB_SECRET
    // ============================================================
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        serviceRoleKey ?? ''
    );

    const token = authHeader?.replace('Bearer ', '');
    const isValidCronAuth = token === cronSecret;
    const isValidServiceAuth = token === serviceRoleKey;

    let isValidInternalAuth = false;

    if (!isValidCronAuth && !isValidServiceAuth && token) {
        try {
            const { data: internalSecret } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'cron_secret')
                .single();

            if (internalSecret && internalSecret.value === token) {
                isValidInternalAuth = true;
            }
        } catch (e) {
            console.warn('Erro ao verificar internal cron secret:', e);
        }
    }

    if (!isValidCronAuth && !isValidServiceAuth && !isValidInternalAuth) {
        console.warn('⚠️ Tentativa de acesso não autorizada ao ai-followup-checker');
        return new Response(
            JSON.stringify({ error: 'Unauthorized', message: 'Valid CRON_SECRET, SERVICE_ROLE_KEY or INTERNAL_DB_SECRET required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`🔐 Auth válida: ${isValidCronAuth ? 'CRON_SECRET' : isValidServiceAuth ? 'SERVICE_ROLE_KEY' : 'INTERNAL_DB_SECRET'}`);

    try {
        const now = new Date();

        console.log(`🔄 Follow-up Checker executando às ${now.toISOString()}`);

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
        presented_properties,
        ai_agents!inner ( evolution_instance_id, timezone_offset, max_followup_attempts, followup_pause_stages )
      `)
            .eq('status', 'active')
            .lt('last_message_at', oneHourAgo)
            .order('last_message_at', { ascending: true })
            .limit(50);

        if (convError) {
            throw new Error(`Erro ao buscar conversas: ${convError.message}`);
        }

        // Buscar qualifications para filtro de temperatura
        const conversationIds = inactiveConversations?.map(c => c.id) || [];
        const qualificationsMap: Record<string, any> = {};

        if (conversationIds.length > 0) {
            const { data: quals } = await supabase
                .from('ai_lead_qualification')
                .select('conversation_id, lead_temperature, bant_total_score')
                .in('conversation_id', conversationIds);

            if (quals) {
                for (const q of quals) {
                    qualificationsMap[q.conversation_id] = q;
                }
            }
        }

        console.log(`📋 Encontradas ${inactiveConversations?.length || 0} conversas inativas`);

        const results = {
            checked: inactiveConversations?.length || 0,
            followupsSent: 0,
            audiosSent: 0,
            skipped: 0,
            errors: 0
        };

        for (const conv of inactiveConversations || []) {
            try {
                const agentConfig = conv.ai_agents as any;

                // BUG-03 FIX: Usar fuso horário configurado no agente
                const timezoneOffset = agentConfig?.timezone_offset ?? -3;
                const currentHour = getCurrentHourInTimezone(timezoneOffset);

                // Verificar limite máximo de follow-ups do agente
                const maxAttempts = agentConfig?.max_followup_attempts ?? 5;
                const pauseStages: string[] = agentConfig?.followup_pause_stages ?? ['closing'];

                // Pausar se o lead está em estágio avançado
                if (pauseStages.includes(conv.current_stage)) {
                    console.log(`  ⏸️ ${conv.phone_number}: Pausado (estágio ${conv.current_stage})`);
                    results.skipped++;
                    continue;
                }

                // 2. Buscar follow-ups já enviados para esta conversa
                const { data: sentFollowups } = await supabase
                    .from('agent_followup_log')
                    .select('sequence_order')
                    .eq('conversation_id', conv.id)
                    .order('sequence_order', { ascending: false })
                    .limit(1);

                const lastSentSequence = sentFollowups?.[0]?.sequence_order || 0;
                const totalSent = await supabase
                    .from('agent_followup_log')
                    .select('*', { count: 'exact', head: true })
                    .eq('conversation_id', conv.id);

                // Verificar limite máximo de tentativas
                if ((totalSent.count || 0) >= maxAttempts) {
                    console.log(`  🚫 ${conv.phone_number}: Limite de ${maxAttempts} follow-ups atingido`);
                    results.skipped++;
                    continue;
                }

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

                // 5. Verificar horário comercial (BUG-03 CORRIGIDO: usa fuso do agente)
                const sendAfterHour = nextFollowup.send_after_hour ?? 8;
                const sendBeforeHour = nextFollowup.send_before_hour ?? 20;

                if (currentHour < sendAfterHour || currentHour >= sendBeforeHour) {
                    console.log(`  🌙 ${conv.phone_number}: Fora do horário (${currentHour}h BRT, permitido: ${sendAfterHour}h-${sendBeforeHour}h)`);
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

                // 6.5 Verificar filtro de temperatura
                const leadQual = qualificationsMap[conv.id];
                const leadTemperature = leadQual?.lead_temperature || 'cold';

                if (nextFollowup.use_for_temperature && nextFollowup.use_for_temperature.length > 0) {
                    if (!nextFollowup.use_for_temperature.includes(leadTemperature)) {
                        console.log(`  🌡️ ${conv.phone_number}: Temperatura ${leadTemperature} não elegível para este followup`);
                        results.skipped++;
                        continue;
                    }
                }

                // 6.6 Verificar filtro por objeção
                const lastObjection = conv.qualification_data?.last_objection;
                if (nextFollowup.use_after_objection && lastObjection) {
                    if (nextFollowup.use_after_objection !== lastObjection) {
                        console.log(`  ⚠️ ${conv.phone_number}: Objeção ${lastObjection} não match`);
                        results.skipped++;
                        continue;
                    }
                }

                // Determinar tipo de mídia do follow-up
                const mediaType = nextFollowup.media_type || 'text';
                console.log(`  📤 ${conv.phone_number}: Enviando follow-up #${nextFollowup.sequence_order} (tipo: ${mediaType})`);

                let sendError: any = null;
                let audioWasSent = false;

                if (mediaType === 'audio' && nextFollowup.audio_url) {
                    // =====================================================
                    // NOVA FEATURE: Envio de áudio pré-gravado
                    // =====================================================
                    console.log(`  🎵 ${conv.phone_number}: Enviando áudio pré-gravado: ${nextFollowup.audio_url}`);

                    const audioResult = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
                        body: {
                            phone_number: conv.phone_number,
                            audio_url: nextFollowup.audio_url,
                            media_type: 'audio',
                            instance_id: agentConfig?.evolution_instance_id
                        }
                    });
                    sendError = audioResult.error;
                    audioWasSent = !sendError;

                    // Se tem mensagem de texto junto com o áudio, enviar após delay
                    if (!sendError && nextFollowup.message_template) {
                        await new Promise(r => setTimeout(r, 1500));
                        const personalizedMessage = await personalizeMessage(
                            supabase,
                            nextFollowup.message_template,
                            conv,
                            nextFollowup.include_property_reminder
                        );
                        if (personalizedMessage.trim()) {
                            await supabase.functions.invoke('evolution-send-whatsapp-v2', {
                                body: {
                                    phone_number: conv.phone_number,
                                    message: personalizedMessage,
                                    typing_delay_ms: 1500,
                                    instance_id: agentConfig?.evolution_instance_id
                                }
                            });
                        }
                    }

                } else if (mediaType === 'image' && nextFollowup.image_url) {
                    // =====================================================
                    // Envio de imagem com legenda
                    // =====================================================
                    const imageCaption = nextFollowup.image_caption || nextFollowup.message_template || '';
                    const personalizedCaption = imageCaption
                        ? await personalizeMessage(supabase, imageCaption, conv, false)
                        : '';

                    const imageResult = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
                        body: {
                            phone_number: conv.phone_number,
                            image_url: nextFollowup.image_url,
                            caption: personalizedCaption,
                            media_type: 'image',
                            typing_delay_ms: 2000 + Math.random() * 2000,
                            instance_id: agentConfig?.evolution_instance_id
                        }
                    });
                    sendError = imageResult.error;

                } else {
                    // =====================================================
                    // Envio de mensagem de texto (padrão)
                    // =====================================================
                    const personalizedMessage = await personalizeMessage(
                        supabase,
                        nextFollowup.message_template,
                        conv,
                        nextFollowup.include_property_reminder
                    );

                    const textResult = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
                        body: {
                            phone_number: conv.phone_number,
                            message: personalizedMessage,
                            typing_delay_ms: 2000 + Math.random() * 2000,
                            instance_id: agentConfig?.evolution_instance_id
                        }
                    });
                    sendError = textResult.error;
                }

                if (sendError) {
                    console.error(`  ❌ Erro ao enviar: ${sendError.message}`);
                    results.errors++;
                    continue;
                }

                // Personalizar mensagem de texto para registro
                const messageForLog = mediaType === 'audio'
                    ? `[ÁUDIO] ${nextFollowup.audio_url}`
                    : mediaType === 'image'
                        ? `[IMAGEM] ${nextFollowup.image_url}`
                        : await personalizeMessage(supabase, nextFollowup.message_template, conv, false);

                // BUG-01/07 FIX: Coluna correta 'message_sent' (não 'sent_message')
                await supabase.from('agent_followup_log').insert({
                    conversation_id: conv.id,
                    followup_id: nextFollowup.id,
                    sequence_order: nextFollowup.sequence_order,
                    message_sent: messageForLog,  // ← CORRIGIDO
                    media_type: mediaType,
                    audio_sent: audioWasSent,
                    lead_responded: false
                });

                // BUG-05 FIX: Usar 'followup_sent' — agora válido na constraint
                await supabase.from('agent_messages').insert({
                    conversation_id: conv.id,
                    role: 'assistant',
                    content: messageForLog,
                    intent_detected: 'followup',
                    action_taken: 'followup_sent'  // ← agora válido
                });

                // BUG-02 FIX: Remover atualização manual de total_messages
                // O trigger trg_update_conversation_metrics já faz isso automaticamente
                // Apenas atualizar last_message_at para rastrear que um followup foi enviado
                await supabase
                    .from('agent_conversations')
                    .update({
                        last_message_at: new Date().toISOString()
                        // REMOVIDO: total_messages manual (era double-counting)
                    })
                    .eq('id', conv.id);

                results.followupsSent++;
                if (audioWasSent) results.audiosSent++;
                console.log(`  ✅ Follow-up #${nextFollowup.sequence_order} enviado para ${conv.phone_number} (${mediaType})`);

            } catch (convError: any) {
                console.error(`  ❌ Erro ao processar ${conv.phone_number}: ${convError.message}`);
                results.errors++;
            }
        }

        console.log(`\n📊 Resultado: ${results.followupsSent} enviados (${results.audiosSent} áudios), ${results.skipped} pulados, ${results.errors} erros`);

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

async function personalizeMessage(
    supabase: any,
    template: string,
    conversation: any,
    includePropertyReminder: boolean = false
): Promise<string> {
    if (!template) return '';

    let message = template;

    // Substituir variáveis padrão
    const replacements: Record<string, string> = {
        '{{nome}}': conversation.customer_name || 'amigo(a)',
        '{{telefone}}': conversation.phone_number || '',
        '{{estagio}}': conversation.current_stage || 'conversa',
        '{{mensagens}}': String(conversation.total_messages || 0)
    };

    // Extrair dados de qualificação se disponíveis
    const qualData = conversation.qualification_data || {};
    if (qualData.preferred_neighborhood || qualData.neighborhood) {
        replacements['{{bairro}}'] = qualData.preferred_neighborhood || qualData.neighborhood;
    }
    if (qualData.property_type) {
        replacements['{{tipo_imovel}}'] = qualData.property_type;
    }
    if (qualData.max_price || qualData.price_max) {
        const price = qualData.max_price || qualData.price_max;
        if (price >= 1_000_000) {
            replacements['{{orcamento}}'] = `R$ ${(price / 1_000_000).toFixed(1)}M`;
        } else {
            replacements['{{orcamento}}'] = `R$ ${Math.round(price / 1000)}k`;
        }
    }

    // Adicionar lembrete de imóvel se habilitado
    if (includePropertyReminder && conversation.presented_properties?.length > 0) {
        try {
            const lastPropertyId = conversation.presented_properties.slice(-1)[0];
            const { data: property } = await supabase
                .from('empreendimentos')
                .select('nome, bairro, valor_min, valor_max')
                .eq('id', lastPropertyId)
                .single();

            if (property) {
                const formatPrice = (v: number) =>
                    v >= 1_000_000
                        ? `R$ ${(v / 1_000_000).toFixed(1)}M`
                        : `R$ ${(v / 1000).toFixed(0)}k`;

                const priceRange = property.valor_min && property.valor_max
                    ? `${formatPrice(property.valor_min)} - ${formatPrice(property.valor_max)}`
                    : property.valor_max ? formatPrice(property.valor_max) : '';

                replacements['{{ultimo_imovel}}'] = property.nome;
                replacements['{{bairro_imovel}}'] = property.bairro || '';
                replacements['{{preco_imovel}}'] = priceRange;

                // Adicionar lembrete no final se o template não usa a variável
                if (!template.includes('{{ultimo_imovel}}')) {
                    message += `\n\nLembrei aqui do ${property.nome}${property.bairro ? ` no ${property.bairro}` : ''}... Ainda tem interesse? 🏠`;
                }
            }
        } catch (e) {
            console.warn('Property reminder error:', e);
        }
    }

    // Aplicar substituições
    for (const [variable, value] of Object.entries(replacements)) {
        message = message.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    // Remover variáveis não substituídas
    message = message.replace(/\{\{[^}]+\}\}/g, '');

    return message.trim();
}
