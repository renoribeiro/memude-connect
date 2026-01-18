import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduleVisitRequest {
    conversation_id: string;
    phone_number: string;
    action_data?: {
        empreendimento_id?: string;
        preferred_date?: string;
        preferred_time?: string;
        lead_name?: string;
    };
}

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

        const { conversation_id, phone_number, action_data }: ScheduleVisitRequest = await req.json();

        if (!conversation_id || !phone_number) {
            throw new Error('conversation_id e phone_number são obrigatórios');
        }

        console.log(`📅 AI Schedule Visit: Processando para conversa ${conversation_id}`);

        // 1. Get conversation data
        const { data: conversation, error: convError } = await supabase
            .from('agent_conversations')
            .select(`
        *,
        agent:ai_agents(name)
      `)
            .eq('id', conversation_id)
            .single();

        if (convError || !conversation) {
            throw new Error(`Conversa não encontrada: ${convError?.message}`);
        }

        // 2. Get or create lead
        let leadId = conversation.lead_id;

        if (!leadId) {
            // Check if lead exists by phone
            const { data: existingLead } = await supabase
                .from('leads')
                .select('id')
                .eq('telefone', phone_number)
                .maybeSingle();

            if (existingLead) {
                leadId = existingLead.id;
            } else {
                // Create new lead
                const leadName = action_data?.lead_name ||
                    conversation.qualification_data?.nome ||
                    `Lead WhatsApp ${phone_number.slice(-4)}`;

                const { data: newLead, error: leadError } = await supabase
                    .from('leads')
                    .insert({
                        nome: leadName,
                        telefone: phone_number,
                        status: 'novo',
                        origem: 'whatsapp_ai',
                        data_visita_solicitada: action_data?.preferred_date || getNextAvailableDate(),
                        horario_visita_solicitada: action_data?.preferred_time || '10:00',
                        empreendimento_id: action_data?.empreendimento_id || getFirstInterestedProperty(conversation),
                        observacoes: `Lead qualificado pelo agente de IA "${conversation.agent?.name}". Score: ${conversation.lead_score || 0}`
                    })
                    .select('id')
                    .single();

                if (leadError) {
                    throw new Error(`Erro ao criar lead: ${leadError.message}`);
                }

                leadId = newLead.id;
                console.log(`✅ Lead criado: ${leadId}`);

                // Update conversation with lead_id
                await supabase
                    .from('agent_conversations')
                    .update({ lead_id: leadId })
                    .eq('id', conversation_id);
            }
        }

        // 3. Get empreendimento
        let empreendimentoId = action_data?.empreendimento_id;

        if (!empreendimentoId) {
            // Try to get from interested properties
            empreendimentoId = getFirstInterestedProperty(conversation);

            // Or from presented properties
            if (!empreendimentoId && conversation.presented_properties?.length > 0) {
                empreendimentoId = conversation.presented_properties[0];
            }
        }

        // 4. Create visita
        const visitDate = action_data?.preferred_date || getNextAvailableDate();
        const visitTime = action_data?.preferred_time || '10:00';

        const { data: visita, error: visitaError } = await supabase
            .from('visitas')
            .insert({
                lead_id: leadId,
                empreendimento_id: empreendimentoId,
                data_visita: visitDate,
                horario_visita: visitTime,
                status: 'pendente'
            })
            .select('id')
            .single();

        if (visitaError) {
            throw new Error(`Erro ao criar visita: ${visitaError.message}`);
        }

        console.log(`✅ Visita criada: ${visita.id}`);

        // 5. Start distribution process
        try {
            const { data: distResult } = await supabase.functions.invoke('distribute-visit', {
                body: { visita_id: visita.id }
            });

            console.log('📤 Distribuição iniciada:', distResult);
        } catch (distError) {
            console.error('⚠️ Erro na distribuição (continuando):', distError);
            // Don't fail the whole process if distribution fails
        }

        // 6. Update conversation status
        await supabase
            .from('agent_conversations')
            .update({
                status: 'completed',
                current_stage: 'scheduled',
                completed_at: new Date().toISOString()
            })
            .eq('id', conversation_id);

        // 7. Update lead status
        await supabase
            .from('leads')
            .update({ status: 'visita_agendada' })
            .eq('id', leadId);

        // 8. Send confirmation message
        const confirmationMessage = formatConfirmationMessage(visitDate, visitTime, empreendimentoId);

        await supabase.functions.invoke('evolution-send-whatsapp-v2', {
            body: {
                phone_number: phone_number,
                message: confirmationMessage
            }
        });

        // 9. Create notification for admin
        await createAdminNotification(supabase, leadId, visita.id, conversation);

        return new Response(
            JSON.stringify({
                success: true,
                lead_id: leadId,
                visita_id: visita.id,
                scheduled_date: visitDate,
                scheduled_time: visitTime,
                duration: Date.now() - startTime
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('❌ Erro ao agendar visita:', error);

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

function getNextAvailableDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 1); // Tomorrow

    // Skip weekends
    while (date.getDay() === 0 || date.getDay() === 6) {
        date.setDate(date.getDate() + 1);
    }

    return date.toISOString().split('T')[0];
}

function getFirstInterestedProperty(conversation: any): string | null {
    if (conversation.interested_properties?.length > 0) {
        return conversation.interested_properties[0];
    }
    return null;
}

function formatConfirmationMessage(date: string, time: string, empreendimentoId: string | null): string {
    const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

    let message = `🎉 *VISITA CONFIRMADA!*

📅 *Data:* ${formattedDate}
⏰ *Horário:* ${time}

Um de nossos corretores entrará em contato para confirmar os detalhes.

Qualquer dúvida, estou à disposição! 😊`;

    return message;
}

async function createAdminNotification(
    supabase: any,
    leadId: string,
    visitaId: string,
    conversation: any
) {
    try {
        // Get admin users
        const { data: admins } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin');

        if (!admins || admins.length === 0) return;

        // Create notification for first admin
        await supabase.functions.invoke('create-notification', {
            body: {
                user_id: admins[0].user_id,
                type: 'new_visit',
                title: '🤖 Visita Agendada por IA',
                message: `O agente de IA "${conversation.agent?.name || 'AI Agent'}" qualificou e agendou uma nova visita.`,
                metadata: {
                    source: 'ai_agent',
                    agent_name: conversation.agent?.name,
                    lead_score: conversation.lead_score,
                    qualification_data: conversation.qualification_data
                },
                related_lead_id: leadId,
                related_visit_id: visitaId
            }
        });
    } catch (error) {
        console.error('Erro ao criar notificação admin:', error);
    }
}
