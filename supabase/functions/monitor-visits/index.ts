import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Iniciando monitoramento de visitas (Lembretes e Pós-Venda)...');

    const results = {
      reminders_24h: 0,
      reminders_today: 0,
      post_visit: 0
    };

    // 1. Lembrete 24h Antes
    // Buscamos visitas agendadas para AMANHÃ que ainda não receberam lembrete
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    results.reminders_24h = await processReminders(supabase, tomorrowStr, 'reminder_24h');

    // 2. Lembrete Hoje (Manhã)
    // Buscamos visitas agendadas para HOJE
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    results.reminders_today = await processReminders(supabase, todayStr, 'reminder_today');

    // 3. Pós-Visita (Feedback)
    results.post_visit = await processPostVisitFeedback(supabase);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro no monitor-visits:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processReminders(supabase: any, dateStr: string, type: 'reminder_24h' | 'reminder_today') {
  console.log(`Processando ${type} para data ${dateStr}`);

  // Buscar visitas confirmadas para a data
  const { data: visitas, error } = await supabase
    .from('visitas')
    .select(`
      id,
      data_visita,
      horario_visita,
      lead:leads!inner (id, nome, telefone),
      corretor:corretores!inner (id, whatsapp, profiles(first_name)),
      empreendimento:empreendimentos!inner (nome)
    `)
    .eq('data_visita', dateStr)
    .eq('status', 'agendada'); // Apenas agendadas

  if (error) {
    console.error(`Erro ao buscar visitas para ${type}:`, error);
    return 0;
  }

  let count = 0;

  for (const visita of visitas) {
    // Verificar se já enviamos este lembrete
    const alreadySent = await checkCommunicationLog(supabase, visita.id, type);
    if (alreadySent) continue;

    // Enviar para Corretor e Cliente
    await sendReminderMessages(supabase, visita, type);
    count++;
  }

  return count;
}

async function processPostVisitFeedback(supabase: any) {
  console.log('Processando feedbacks pós-visita...');
  
  // Buscar visitas 'agendada' ou 'realizada' que já passaram do horário
  // Nota: Idealmente o status muda para 'realizada' manualmente, mas vamos pegar pelo horário também
  // para garantir automação.
  
  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3h atrás
  
  // Vamos buscar visitas de hoje e ontem (para cobrir o caso de "dia seguinte 8h")
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const { data: visitas, error } = await supabase
    .from('visitas')
    .select(`
      id,
      data_visita,
      horario_visita,
      status,
      lead:leads!inner (id, nome, telefone),
      corretor:corretores!inner (id, whatsapp, profiles(first_name)),
      empreendimento:empreendimentos!inner (nome)
    `)
    .in('data_visita', [todayStr, yesterdayStr])
    .neq('status', 'cancelada');

  if (error) return 0;

  let count = 0;

  for (const visita of visitas) {
    // Construir data/hora da visita
    // horario_visita é string "HH:MM" ou "HH:MM:SS"
    const [hours, minutes] = visita.horario_visita.split(':');
    const visitDateTime = new Date(visita.data_visita);
    visitDateTime.setHours(parseInt(hours), parseInt(minutes), 0);

    // Calcular tempo decorrido
    const diffMs = now.getTime() - visitDateTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // Regra: Enviar 3h depois. Se 3h depois for > 19h, enviar 8h do dia seguinte.
    if (diffHours < 3) continue; // Ainda não passou 3h

    // Verificar horário atual
    const currentHour = now.getHours();
    
    // Se a visita foi hoje e 3h depois cai após as 19h, só enviamos se agora for amanhã > 8h
    // Simplificação: Se agora é > 19h e < 8h, não enviamos (janela de silêncio)
    if (currentHour >= 19 || currentHour < 8) {
      continue; // Esperar horário comercial
    }

    // Verificar se já enviamos
    const alreadySent = await checkCommunicationLog(supabase, visita.id, 'post_visit_feedback');
    if (alreadySent) continue;

    // Enviar Feedback
    await sendFeedbackRequest(supabase, visita);
    count++;
  }

  return count;
}

async function checkCommunicationLog(supabase: any, visitaId: string, type: string) {
  const { data } = await supabase
    .from('communication_log')
    .select('id')
    .eq('metadata->visita_id', visitaId) // Assumindo que salvamos visita_id no metadata
    .eq('metadata->type', type)
    .limit(1);
    
  return data && data.length > 0;
}

async function sendReminderMessages(supabase: any, visita: any, type: 'reminder_24h' | 'reminder_today') {
  const isToday = type === 'reminder_today';
  const timeText = isToday ? "é HOJE" : "é AMANHÃ";
  
  // Mensagem para Cliente
  const msgClient = `⏰ *LEMBRETE DE VISITA*

Olá ${visita.lead.nome}, lembre-se que sua visita ao *${visita.empreendimento.nome}* ${timeText}.

🕒 Horário: ${visita.horario_visita}
📍 Corretor: ${visita.corretor.profiles.first_name}

Qualquer imprevisto, avise seu corretor.`;

  // Mensagem para Corretor
  const msgCorretor = `⏰ *LEMBRETE DE VISITA*

Corretor(a) ${visita.corretor.profiles.first_name}, sua visita com o cliente *${visita.lead.nome}* ${timeText}.

🏢 Empreendimento: ${visita.empreendimento.nome}
🕒 Horário: ${visita.horario_visita}

Esteja preparado!`;

  // Enviar
  await sendWhatsapp(supabase, visita.lead.telefone, msgClient, visita, type, 'client');
  await sendWhatsapp(supabase, visita.corretor.whatsapp, msgCorretor, visita, type, 'corretor');
}

async function sendFeedbackRequest(supabase: any, visita: any) {
  // Feedback Cliente
  const msgClient = `👋 Olá ${visita.lead.nome}!

Esperamos que sua visita ao *${visita.empreendimento.nome}* tenha sido ótima.

Poderia nos responder rapidinho?
1. O que achou do empreendimento? (Gostou?)
2. De 0 a 10, qual sua nota para o atendimento do corretor ${visita.corretor.profiles.first_name}?

Sua opinião é muito importante pra gente! 💙`;

  // Feedback Corretor
  const msgCorretor = `👋 Olá ${visita.corretor.profiles.first_name}, como foi a visita com *${visita.lead.nome}*?

Por favor, nos envie um breve feedback (texto ou áudio) sobre:
- O cliente demonstrou interesse real?
- Qual a probabilidade de fechamento?
- Próximos passos agendados?

Isso ajuda a calibrar nossos leads! 🚀`;

  await sendWhatsapp(supabase, visita.lead.telefone, msgClient, visita, 'post_visit_feedback', 'client');
  await sendWhatsapp(supabase, visita.corretor.whatsapp, msgCorretor, visita, 'post_visit_feedback', 'corretor');
}

async function sendWhatsapp(supabase: any, phone: string, message: string, visita: any, type: string, target: string) {
  try {
    await supabase.functions.invoke('evolution-send-whatsapp-v2', {
      body: {
        phone: phone,
        message: message,
        metadata: {
          visita_id: visita.id,
          lead_id: visita.lead.id,
          type: type,
          target: target
        }
      }
    });
    
    // Log manual se necessário, mas o send-whatsapp-v2 já deve logar ou o webhook de retorno loga
    // Vamos garantir log local para o checkCommunicationLog funcionar
    await supabase.from('communication_log').insert({
      type: 'whatsapp',
      direction: 'outbound',
      phone_number: phone,
      content: message,
      status: 'sent',
      metadata: {
        visita_id: visita.id,
        type: type,
        target: target
      }
    });

  } catch (error) {
    console.error(`Erro ao enviar ${type} para ${target}:`, error);
  }
}