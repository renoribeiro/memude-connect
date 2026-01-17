import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const webhookData: WebhookData = await req.json();
    console.log('Webhook recebido:', JSON.stringify(webhookData, null, 2));

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

    console.log(`Mensagem extraída de ${phoneNumber}: "${messageText}"`);
    console.log('Tipo de mensagem detectado:', Object.keys(message || {}).join(', '));

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
  let { data: pendingAttempt, error } = await supabase
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
  let { data: pendingVisitAttempt } = await supabase
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

  console.log('Nenhuma tentativa pendente (Lead ou Visita) encontrada para:', phoneNumber);
  return null;
}

// ==========================================
// LÓGICA DE VISITAS
// ==========================================

async function handleVisitResponse(supabase: any, attempt: any, messageText: string, phoneNumber: string) {
  const response = analyzeResponse(messageText);
  console.log('Resposta analisada (Visita):', response);

  // Atualizar tentativa
  await supabase
    .from('visit_distribution_attempts')
    .update({
      status: 'responded',
      response_type: response.type,
      response_message: messageText,
      response_received_at: new Date().toISOString()
    })
    .eq('id', attempt.id);

  if (response.type === 'accepted') {
    await acceptVisit(supabase, attempt);
    await sendVisitConfirmation(supabase, attempt);
  } else if (response.type === 'rejected') {
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
  console.log('Visita aceita pelo corretor:', attempt.corretor.id);

  // 1. Atualizar status da visita
  await supabase
    .from('visitas')
    .update({
      corretor_id: attempt.corretor.id,
      status: 'confirmada'
    })
    .eq('id', attempt.visita.id);
    
  // 2. Atualizar status do lead (se necessário)
  await supabase
    .from('leads')
    .update({
        corretor_designado_id: attempt.corretor.id,
        status: 'visita_agendada'
    })
    .eq('id', attempt.visita.lead.id);

  // 3. Finalizar fila de distribuição
  await supabase
    .from('visit_distribution_queue')
    .update({
      status: 'completed',
      assigned_corretor_id: attempt.corretor.id,
      completed_at: new Date().toISOString()
    })
    .eq('visita_id', attempt.visita.id);

  // 4. Cancelar outras tentativas pendentes para esta visita
  await supabase
    .from('visit_distribution_attempts')
    .update({
      status: 'timeout',
      response_type: 'cancelled',
      response_message: 'Cancelado - visita aceita por outro corretor'
    })
    .eq('visita_id', attempt.visita.id)
    .eq('status', 'pending')
    .neq('id', attempt.id);

  console.log('Visita confirmada e atribuída com sucesso');

  // 5. Notificar CLIENTE
  try {
    const leadMessage = `🎉 *VISITA CONFIRMADA!*

Olá ${attempt.visita.lead.nome}, sua visita ao *${attempt.visita.empreendimento.nome}* está confirmada!

🗓 Data: ${new Date(attempt.visita.data_visita).toLocaleDateString('pt-BR')}
🕒 Horário: ${attempt.visita.horario_visita}
📍 Endereço: ${attempt.visita.empreendimento.endereco || 'Consulte o corretor'}

Seu corretor:
👤 *${attempt.corretor.profile.first_name}*
📱 ${attempt.corretor.whatsapp}

Ele entrará em contato em breve.`;

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

  const { data: settings } = await supabase
    .from('distribution_settings')
    .select('*')
    .single();

  const maxAttempts = settings?.max_attempts || 5;
  const currentAttempt = attempt.visit_distribution_queue.current_attempt || 1; // Ajustado para pegar da queue correta

  // Se temos fila, atualizamos a fila
  // Nota: A lógica de tentar o próximo corretor é acionada pelo 'visit-distribution-timeout-checker'
  // mas podemos acionar imediatamente aqui para agilizar.
  
  if (currentAttempt >= maxAttempts) {
      await supabase
      .from('visit_distribution_queue')
      .update({
        status: 'failed',
        failure_reason: 'Todos os corretores rejeitaram a visita',
        completed_at: new Date().toISOString()
      })
      .eq('id', attempt.visit_distribution_queue.id);
      
      // Notificar Admin
      // ... (implementar notificação de falha se desejar)
  } else {
      // Incrementar tentativa na fila e Trigger next
      await supabase
        .from('visit_distribution_queue')
        .update({ current_attempt: currentAttempt + 1 })
        .eq('id', attempt.visit_distribution_queue.id);

      // Chamar checker imediatamente para enviar para o próximo
      await supabase.functions.invoke('visit-distribution-timeout-checker');
  }
}

async function sendVisitConfirmation(supabase: any, attempt: any) {
  const confirmationMessage = `✅ *VISITA AGENDADA COM SUCESSO*

Você aceitou a visita!

*Cliente:* ${attempt.visita.lead.nome}
*Telefone:* ${attempt.visita.lead.telefone}
*Local:* ${attempt.visita.empreendimento.nome}
*Endereço:* ${attempt.visita.empreendimento.endereco || 'Endereço não cadastrado'}
*Data:* ${new Date(attempt.visita.data_visita).toLocaleDateString('pt-BR')}
*Horário:* ${attempt.visita.horario_visita}

👉 Entre em contato com o cliente agora mesmo para confirmar.`;

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
// LÓGICA DE LEADS (Existente, encapsulada)
// ==========================================

async function handleLeadResponse(supabase: any, attempt: any, messageText: string, phoneNumber: string) {
  const response = analyzeResponse(messageText);
  console.log('Resposta analisada (Lead):', response);

  await supabase
    .from('distribution_attempts')
    .update({
      status: 'responded',
      response_type: response.type,
      response_message: messageText,
      response_received_at: new Date().toISOString()
    })
    .eq('id', attempt.id);

  if (response.type === 'accepted') {
    await acceptLead(supabase, attempt);
    await sendLeadConfirmation(supabase, attempt);
  } else if (response.type === 'rejected') {
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

function analyzeResponse(message: string): { type: 'accepted' | 'rejected' | 'unclear', confidence: number } {
  const text = message.toLowerCase().trim();
  const acceptWords = ['sim', 'yes', 'aceito', 'quero', 'vou', 'posso', 'ok', 'pode', 'confirmo', 'topo'];
  const rejectWords = ['não', 'nao', 'no', 'recuso', 'negativo', 'impossível', 'impossivel', 'ocupado', 'nem'];
  
  const acceptScore = acceptWords.reduce((score, word) => text.includes(word) ? score + 1 : score, 0);
  const rejectScore = rejectWords.reduce((score, word) => text.includes(word) ? score + 1 : score, 0);
  
  if (acceptScore > rejectScore && acceptScore > 0) return { type: 'accepted', confidence: acceptScore };
  else if (rejectScore > acceptScore && rejectScore > 0) return { type: 'rejected', confidence: rejectScore };
  else return { type: 'unclear', confidence: 0 };
}

async function acceptLead(supabase: any, attempt: any) {
  // Lógica original de Lead
  await supabase.from('leads').update({ corretor_designado_id: attempt.corretor.id, status: 'em_contato' }).eq('id', attempt.lead.id);
  await supabase.from('distribution_queue').update({ status: 'completed', assigned_corretor_id: attempt.corretor.id, completed_at: new Date().toISOString() }).eq('lead_id', attempt.lead.id);
  await supabase.from('distribution_attempts').update({ status: 'timeout', response_type: 'cancelled' }).eq('lead_id', attempt.lead.id).eq('status', 'pending').neq('id', attempt.id);
  
  // Notificações (Simplificadas aqui, mas completas na implementação real acima)
  // ... (Notificar Lead e Admin conforme seu pedido anterior)
  // Vou reincluir a lógica completa de notificação que fiz no passo anterior para garantir que não se perca.
  
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
    // Lógica original de rejectLead
    const { data: settings } = await supabase.from('distribution_settings').select('*').single();
    const { data: currentQueue } = await supabase.from('distribution_queue').select('current_attempt').eq('lead_id', attempt.lead.id).single();
    const maxAttempts = settings?.max_attempts || 5;
    const currentAttempt = currentQueue?.current_attempt || 1;

    if (currentAttempt >= maxAttempts) {
        await supabase.from('distribution_queue').update({ status: 'failed', failure_reason: 'Todos rejeitaram', completed_at: new Date().toISOString() }).eq('lead_id', attempt.lead.id);
        // Notify admin rejection...
    } else {
        await supabase.from('distribution_queue').update({ current_attempt: currentAttempt + 1 }).eq('lead_id', attempt.lead.id);
        await supabase.functions.invoke('distribution-timeout-checker');
    }
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
