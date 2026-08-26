import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { handleOptions, jsonResponse, verifyWebhook } from '../_shared/security.ts';
import { analyzeDistributionResponse } from '../_shared/distribution-response.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'https://core.memudecore.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface WebhookData {
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
    };
    messageTimestamp: number;
    pushName: string;
  };
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const rawBody = await req.text();
    if (!await verifyWebhook(req, rawBody)) {
      console.warn('Webhook de distribuição rejeitado: assinatura inválida');
      return jsonResponse(req, { error: 'Não autorizado' }, 401);
    }

    const webhookData: WebhookData = JSON.parse(rawBody);
    console.log('Webhook de distribuição recebido', {
      event_id: webhookData.data?.key?.id,
      from_me: webhookData.data?.key?.fromMe,
    });

    // Ignorar mensagens enviadas pela própria aplicação
    if (webhookData.data.key.fromMe) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'fromMe' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extrair número do telefone (remover @s.whatsapp.net)
    const phoneNumber = webhookData.data.key.remoteJid.split('@')[0];

    // Extrair texto da mensagem com suporte a vários formatos
    const message = webhookData.data.message;
    let messageText = '';

    if (message?.conversation) {
      messageText = message.conversation;
    } else if (message?.extendedTextMessage?.text) {
      messageText = message.extendedTextMessage.text;
    } else if (message?.buttonsResponseMessage?.selectedButtonId) {
      messageText = message.buttonsResponseMessage.selectedButtonId; // ID do botão clicado
    } else if (message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
      messageText = message.listResponseMessage.singleSelectReply.selectedRowId; // ID da lista
    } else if (message?.templateButtonReplyMessage?.selectedId) {
      messageText = message.templateButtonReplyMessage.selectedId;
    }

    console.log('Mensagem de distribuição analisada', {
      phone_length: phoneNumber.length,
      message_length: messageText.length,
      message_types: Object.keys(message || {}),
    });

    // Verificar se é uma resposta a uma distribuição pendente (Lead ou Visita)
    const response = await processDistributionResponse(supabase, phoneNumber, messageText);

    if (response) {
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Se não foi uma resposta de distribuição, apenas logar
    await supabase
      .from('communication_log')
      .insert({
        type: 'whatsapp',
        direction: 'inbound',
        content: messageText,
        phone_number: phoneNumber,
        message_id: webhookData.data.key.id,
        status: 'received',
        metadata: webhookData
      });

    return new Response(JSON.stringify({ status: 'logged' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro no webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processDistributionResponse(supabase: any, phoneNumber: string, messageText: string) {
  console.log('Processando possível resposta de distribuição...');

  // 1. Tentar buscar em LEADS (distribution_attempts)
  const { data: pendingAttempt, error } = await supabase
    .from('distribution_attempts')
    .select(
      `
      *, 
      lead:leads!inner (
        id,
        nome,
        telefone,
        empreendimento:empreendimentos!inner (
          nome
        )
      ),
      corretor:corretores!inner (
        id,
        whatsapp,
        profile:profiles!inner (
          first_name,
          last_name
        )
      ),
      distribution_queue!inner (
        id,
        status
      )
    `)
    .eq('status', 'pending')
    .eq('corretores.whatsapp', phoneNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Se encontrou LEAD
  if (pendingAttempt) {
    console.log('Tentativa de LEAD encontrada:', pendingAttempt.id);
    return await handleLeadResponse(supabase, pendingAttempt, messageText, phoneNumber);
  }

  // 2. Tentar buscar em VISITAS (visit_distribution_attempts)
  const { data: pendingVisitAttempt } = await supabase
    .from('visit_distribution_attempts')
    .select(
      `
      *, 
      visita:visitas!inner (
        id,
        data_visita,
        horario_visita,
        lead:leads!inner (
          id,
          nome,
          telefone,
          email
        ),
        empreendimento:empreendimentos!inner (
          nome,
          endereco
        )
      ),
      corretor:corretores!inner (
        id,
        whatsapp,
        profile:profiles!inner (
          first_name,
          last_name
        )
      ),
      visit_distribution_queue!inner (
        id,
        status
      )
    `)
    .eq('status', 'pending')
    .eq('corretores.whatsapp', phoneNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Se encontrou VISITA
  if (pendingVisitAttempt) {
    console.log('Tentativa de VISITA encontrada:', pendingVisitAttempt.id);
    return await handleVisitResponse(supabase, pendingVisitAttempt, messageText, phoneNumber);
  }

  console.log('Nenhuma tentativa pendente encontrada para a mensagem recebida');
  return null;
}

// ==========================================
// LÓGICA DE VISITAS
// ==========================================

async function handleVisitResponse(supabase: any, attempt: any, messageText: string, phoneNumber: string) {
  const response = analyzeDistributionResponse(messageText);
  console.log('Resposta analisada (Visita):', response);

  if (response.type === 'accepted') {
    // SEC-02: Atomic acceptance using transactional PostgreSQL RPC to prevent race conditions
    const { data: success, error: rpcError } = await supabase.rpc('accept_visit_distribution', {
      p_attempt_id: attempt.id,
      p_corretor_id: attempt.corretor.id
    });

    if (rpcError) {
      console.error('Erro ao executar RPC accept_visit_distribution:', rpcError);
      throw new Error(`Erro transacional ao aceitar visita: ${rpcError.message}`);
    }

    if (!success) {
      console.log(`Oportunidade de visita ${attempt.visita.id} já aceita por outro corretor.`);
      const takenMessage = `❌ *OPORTUNIDADE INDISPONÍVEL*\n\nDesculpe! A oportunidade de visita com o cliente *${attempt.visita.lead.nome}* já foi aceita por outro corretor. Fique atento para as próximas!`;
      await supabase.functions.invoke('evolution-send-whatsapp-v2', {
        body: {
          phone: phoneNumber,
          message: takenMessage,
          metadata: { type: 'visit_already_taken' }
        }
      });

      // Update attempt to prevent it from hanging as pending
      await supabase
        .from('visit_distribution_attempts')
        .update({
          status: 'timeout',
          response_type: 'timeout',
          response_message: 'Indisponível - já aceito por outro corretor',
          response_received_at: new Date().toISOString()
        })
        .eq('id', attempt.id);

      return {
        status: 'processed',
        type: 'visit',
        response_type: 'rejected',
        attempt_id: attempt.id
      };
    }

    // Successfully accepted (db updates occurred in RPC)! Send notifications.
    await acceptVisit(supabase, attempt);
    await sendVisitConfirmation(supabase, attempt);
  } else if (response.type === 'rejected') {
    // Atualizar tentativa
    await supabase
      .from('visit_distribution_attempts')
      .update({
        status: 'rejected',
        response_type: response.type,
        response_message: messageText,
        response_received_at: new Date().toISOString()
      })
      .eq('id', attempt.id);

    await rejectVisit(supabase, attempt);
  } else {
    // Pedir clarificação (Opcional, pode usar a mesma lógica de lead ou criar uma específica)
    await requestClarification(supabase, attempt.lead, attempt.corretor, phoneNumber, 'visita');
  }

  return {
    status: 'processed',
    type: 'visit',
    response_type: response.type,
    attempt_id: attempt.id
  };
}

async function acceptVisit(supabase: any, attempt: any) {
  console.log('Visita confirmada de forma atômica. Enviando notificações para cliente/admin.');

  // 5. Notificar CLIENTE
  try {
    const calendarLink = generateGoogleCalendarLink(attempt.visita);
    const leadMessage = `🎉 *VISITA CONFIRMADA!*

Olá ${attempt.visita.lead.nome}, sua visita ao *${attempt.visita.empreendimento.nome}* está confirmada!

🗓 Data: ${new Date(attempt.visita.data_visita).toLocaleDateString('pt-BR')}
🕒 Horário: ${attempt.visita.horario_visita}
📍 Endereço: ${attempt.visita.empreendimento.endereco || 'Consulte o corretor'}

Seu corretor:
👤 *${attempt.corretor.profile.first_name}*
📱 ${attempt.corretor.whatsapp}

Ele entrará em contato em breve.

📅 Adicione ao seu calendário:
${calendarLink}`;

    await supabase.functions.invoke('evolution-send-whatsapp-v2', {
      body: {
        phone: attempt.visita.lead.telefone,
        message: leadMessage,
        metadata: {
          lead_id: attempt.visita.lead.id,
          visita_id: attempt.visita.id,
          type: 'visit_confirmation_client'
        }
      }
    });
  } catch (err) {
    console.error('Erro ao notificar cliente (visita):', err);
  }

  // 6. Notificar ADMIN
  try {
    const { data: adminSettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'admin_whatsapp')
      .single();

    if (adminSettings?.value) {
      const adminMessage = `🚀 *VISITA AGENDADA*

Lead: ${attempt.visita.lead.nome}
Empreendimento: ${attempt.visita.empreendimento.nome}
Corretor: ${attempt.corretor.profile.first_name}
Data: ${new Date(attempt.visita.data_visita).toLocaleDateString('pt-BR')} ${attempt.visita.horario_visita}

Status: Confirmada ✅`;

      await supabase.functions.invoke('evolution-send-whatsapp-v2', {
        body: {
          phone: adminSettings.value,
          message: adminMessage,
          metadata: {
            lead_id: attempt.visita.lead.id,
            visita_id: attempt.visita.id,
            type: 'admin_notification_visit_confirmed'
          }
        }
      });
    }
  } catch (err) {
    console.error('Erro ao notificar admin (visita):', err);
  }
}

async function rejectVisit(supabase: any, attempt: any) {
  console.log('Visita rejeitada pelo corretor:', attempt.corretor.id);
  const { error } = await supabase.functions.invoke(
    'visit-distribution-timeout-checker',
    { body: { force_advance_visita_id: attempt.visita.id } }
  );
  if (error) throw error;
}

async function sendVisitConfirmation(supabase: any, attempt: any) {
  const calendarLink = generateGoogleCalendarLink(attempt.visita);
  const confirmationMessage = `✅ *VISITA AGENDADA COM SUCESSO*

Você aceitou a visita!

*Cliente:* ${attempt.visita.lead.nome}
*Telefone:* ${attempt.visita.lead.telefone}
*Local:* ${attempt.visita.empreendimento.nome}
*Endereço:* ${attempt.visita.empreendimento.endereco || 'Endereço não cadastrado'}
*Data:* ${new Date(attempt.visita.data_visita).toLocaleDateString('pt-BR')}
*Horário:* ${attempt.visita.horario_visita}

👉 Entre em contato com o cliente agora mesmo para confirmar.

📅 Adicione ao seu calendário:
${calendarLink}`;

  try {
    await supabase.functions.invoke('evolution-send-whatsapp-v2', {
      body: {
        phone: attempt.corretor.whatsapp,
        message: confirmationMessage,
        metadata: {
          lead_id: attempt.visita.lead.id,
          visita_id: attempt.visita.id,
          type: 'visit_accepted_confirmation'
        }
      }
    });
  } catch (error) {
    console.error('Erro ao enviar confirmação de visita ao corretor:', error);
  }
}


// ==========================================
async function handleLeadResponse(supabase: any, attempt: any, messageText: string, phoneNumber: string) {
  const response = analyzeDistributionResponse(messageText);
  console.log('Resposta analisada (Lead):', response);

  if (response.type === 'accepted') {
    // SEC-02: Atomic acceptance using transactional PostgreSQL RPC to prevent race conditions
    const { data: success, error: rpcError } = await supabase.rpc('accept_lead_distribution', {
      p_attempt_id: attempt.id,
      p_corretor_id: attempt.corretor.id
    });

    if (rpcError) {
      console.error('Erro ao executar RPC accept_lead_distribution:', rpcError);
      throw new Error(`Erro transacional ao aceitar lead: ${rpcError.message}`);
    }

    if (!success) {
      console.log(`Oportunidade de lead ${attempt.lead.id} já aceita por outro corretor.`);
      const takenMessage = `❌ *OPORTUNIDADE INDISPONÍVEL*\n\nDesculpe! A oportunidade com o cliente *${attempt.lead.nome}* já foi aceita por outro corretor. Fique atento para as próximas!`;
      await supabase.functions.invoke('evolution-send-whatsapp-v2', {
        body: {
          phone: phoneNumber,
          message: takenMessage,
          metadata: { type: 'lead_already_taken' }
        }
      });

      // Update attempt to prevent it from hanging as pending
      await supabase
        .from('distribution_attempts')
        .update({
          status: 'timeout',
          response_type: 'timeout',
          response_message: 'Indisponível - já aceito por outro corretor',
          response_received_at: new Date().toISOString()
        })
        .eq('id', attempt.id);

      return {
        status: 'processed',
        type: 'lead',
        response_type: 'rejected',
        attempt_id: attempt.id
      };
    }

    // Successfully accepted (db updates occurred in RPC)! Send notifications.
    await acceptLead(supabase, attempt);
    await sendLeadConfirmation(supabase, attempt);
  } else if (response.type === 'rejected') {
    // Atualizar tentativa
    await supabase
      .from('distribution_attempts')
      .update({
        status: 'responded',
        response_type: response.type,
        response_message: messageText,
        response_received_at: new Date().toISOString()
      })
      .eq('id', attempt.id);

    await rejectLead(supabase, attempt);
  } else {
    await requestClarification(supabase, attempt.lead, attempt.corretor, phoneNumber, 'lead');
  }

  return {
    status: 'processed',
    type: 'lead',
    response_type: response.type,
    attempt_id: attempt.id
  };
}

// ... (Funções acceptLead, rejectLead, sendLeadConfirmation originais mantidas ou levemente ajustadas abaixo)

async function acceptLead(supabase: any, attempt: any) {
  console.log('Lead confirmado de forma atômica. Enviando notificações para cliente/admin.');

  // --- NOTIFICAÇÃO LEAD ---
  try {
    const leadMessage = `🎉 *VISITA CONFIRMADA!*

Olá ${attempt.lead.nome}, sua visita ao *${attempt.lead.empreendimento.nome}* está confirmada!

O corretor responsável será:
👤 *${attempt.corretor.profile.first_name} ${attempt.corretor.profile.last_name}*
📱 ${attempt.corretor.whatsapp}

Ele entrará em contato em breve.`;

    await supabase.functions.invoke('evolution-send-whatsapp-v2', {
      body: { phone: attempt.lead.telefone, message: leadMessage, metadata: { lead_id: attempt.lead.id, type: 'lead_confirmation_client' } }
    });
  } catch (err) { console.error(err); }

  // --- NOTIFICAÇÃO ADMIN ---
  try {
    const { data: adminSettings } = await supabase.from('system_settings').select('value').eq('key', 'admin_whatsapp').single();
    if (adminSettings?.value) {
      const adminMessage = `🚀 *MATCH REALIZADO*

Lead: ${attempt.lead.nome}
Empreendimento: ${attempt.lead.empreendimento.nome}
Corretor: ${attempt.corretor.profile.first_name}

Acompanhe no dashboard.`;
      await supabase.functions.invoke('evolution-send-whatsapp-v2', {
        body: { phone: adminSettings.value, message: adminMessage, metadata: { lead_id: attempt.lead.id, type: 'admin_notification_match' } }
      });
    }
  } catch (err) { console.error(err); }
}

async function rejectLead(supabase: any, attempt: any) {
  const { error } = await supabase.functions.invoke(
    'distribution-timeout-checker',
    { body: { force_advance_lead_id: attempt.lead.id } }
  );
  if (error) throw error;
}

async function sendLeadConfirmation(supabase: any, attempt: any) {
  // Lógica original de confirmação
  const msg = `✅ *LEAD CONFIRMADO*\n\nParabéns! Lead atribuído:\n${attempt.lead.nome}\n${attempt.lead.empreendimento.nome}\n\nBoa sorte!`;
  await supabase.functions.invoke('evolution-send-whatsapp-v2', {
    body: { phone: attempt.corretor.whatsapp, message: msg, metadata: { lead_id: attempt.lead.id, type: 'lead_accepted_confirmation' } }
  });
}

async function requestClarification(supabase: any, lead: any, corretor: any, phoneNumber: string, context: string) {
  const msg = `❓ *RESPOSTA NÃO COMPREENDIDA*\n\nResponda *SIM* para aceitar ou *NÃO* para recusar.`;
  await supabase.functions.invoke('evolution-send-whatsapp-v2', {
    body: { phone: phoneNumber, message: msg, metadata: { type: 'clarification' } }
  });
}

function generateGoogleCalendarLink(visita: any) {
  if (!visita.data_visita || !visita.horario_visita) return '';
  const datePart = visita.data_visita.split('T')[0];
  const [year, month, day] = datePart.split('-');
  const [hour, minute] = visita.horario_visita.split(':');
  
  const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour) + 3, parseInt(minute)));
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatGoogleDate = (d: Date) => {
    return d.getUTCFullYear().toString() +
           (d.getUTCMonth() + 1).toString().padStart(2, '0') +
           d.getUTCDate().toString().padStart(2, '0') + 'T' +
           d.getUTCHours().toString().padStart(2, '0') +
           d.getUTCMinutes().toString().padStart(2, '0') +
           '00Z';
  };

  const startStr = formatGoogleDate(startDate);
  const endStr = formatGoogleDate(endDate);

  const title = encodeURIComponent('Visita Memude');
  const details = encodeURIComponent(`Visita ao empreendimento ${visita.empreendimento?.nome}`);
  const location = encodeURIComponent(visita.empreendimento?.endereco || '');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
}
