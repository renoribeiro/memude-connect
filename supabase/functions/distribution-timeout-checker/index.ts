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

    console.log('Verificando timeouts de distribuição...');

    // Buscar tentativas pendentes que expiraram
    // Usando queue_id como FK explícita (adicionada na Fase 1 do Sprint 5)
    const { data: expiredAttempts, error } = await supabase
      .from('distribution_attempts')
      .select(`
        *,
        distribution_queue!queue_id (
          id,
          status,
          current_attempt,
          lead_id
        ),
        lead:leads!lead_id (
          id,
          nome,
          empreendimento:empreendimentos!empreendimento_id (
            nome
          )
        ),
        corretor:corretores!corretor_id (
          id,
          whatsapp
        )
      `)
      .eq('status', 'pending')
      .lt('timeout_at', new Date().toISOString());

    if (error) {
      throw new Error(`Erro ao buscar tentativas expiradas: ${error.message}`);
    }

    if (!expiredAttempts || expiredAttempts.length === 0) {
      console.log('Nenhuma tentativa expirada encontrada');
      return new Response(
        JSON.stringify({ message: 'Nenhuma tentativa expirada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processando ${expiredAttempts.length} tentativas expiradas`);

    for (const attempt of expiredAttempts) {
      await processExpiredAttempt(supabase, attempt);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: expiredAttempts.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no checker de timeout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function processExpiredAttempt(supabase: any, attempt: any) {
  console.log(`Processando timeout para tentativa ${attempt.id}`);

  // Marcar tentativa como timeout
  await supabase
    .from('distribution_attempts')
    .update({ 
      status: 'timeout',
      response_type: 'timeout',
      response_received_at: new Date().toISOString()
    })
    .eq('id', attempt.id);

  // Buscar configurações
  const { data: settings } = await supabase
    .from('distribution_settings')
    .select('*')
    .single();

  const maxAttempts = settings?.max_attempts || 5;
  const currentAttempt = attempt.distribution_queue.current_attempt;

  if (currentAttempt >= maxAttempts) {
    // Todas as tentativas esgotadas
    console.log(`Máximo de tentativas (${maxAttempts}) atingido para lead ${attempt.lead.id}`);
    
    await supabase
      .from('distribution_queue')
      .update({ 
        status: 'failed',
        failure_reason: 'Todas as tentativas esgotadas',
        completed_at: new Date().toISOString()
      })
      .eq('id', attempt.distribution_queue.id);

    // Notificar admin
    await notifyAdminFailure(supabase, attempt.lead, 'Todas as tentativas esgotadas');
    
  } else {
    // Tentar próximo corretor
    console.log(`Tentando próximo corretor para lead ${attempt.lead.id}`);
    
    await supabase
      .from('distribution_queue')
      .update({ 
        current_attempt: currentAttempt + 1
      })
      .eq('id', attempt.distribution_queue.id);

    // Buscar próximo corretor elegível
    await distributeToNextCorretor(supabase, attempt.lead.id, currentAttempt + 1);
  }
}

async function distributeToNextCorretor(supabase: any, leadId: string, attemptNumber: number) {
  console.log(`Distribuindo para próximo corretor, tentativa ${attemptNumber}`);

  // Buscar corretores que ainda não receberam esta oportunidade
  const { data: usedCorretores } = await supabase
    .from('distribution_attempts')
    .select('corretor_id')
    .eq('lead_id', leadId);

  const usedIds = usedCorretores?.map((a: any) => a.corretor_id) || [];

  // Buscar lead com empreendimento
  const { data: lead } = await supabase
    .from('leads')
    .select(`
      *,
      empreendimento:empreendimentos!inner (
        id,
        nome,
        bairro_id,
        construtora_id
      )
    `)
    .eq('id', leadId)
    .single();

  if (!lead) {
    console.error('Lead não encontrado:', leadId);
    return;
  }

  // Buscar próximo corretor elegível
  const nextCorretor = await getNextEligibleCorretor(supabase, lead, usedIds);

  if (!nextCorretor) {
    console.log('Nenhum corretor elegível restante');
    
    await supabase
      .from('distribution_queue')
      .update({ 
        status: 'failed',
        failure_reason: 'Nenhum corretor elegível restante',
        completed_at: new Date().toISOString()
      })
      .eq('lead_id', leadId);

    await notifyAdminFailure(supabase, lead, 'Nenhum corretor elegível restante');
    return;
  }

  // Enviar para próximo corretor
  const { data: settings } = await supabase
    .from('distribution_settings')
    .select('*')
    .single();

  await sendDistributionMessage(supabase, leadId, nextCorretor, lead, settings, attemptNumber);
}

async function getNextEligibleCorretor(supabase: any, lead: any, excludeIds: string[]) {
  let query = supabase
    .from('corretores')
    .select(`
      id,
      profile_id,
      telefone,
      whatsapp,
      nota_media,
      total_visitas,
      corretor_bairros!inner (bairro_id),
      corretor_construtoras!inner (construtora_id)
    `)
    .eq('status', 'aprovado');

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data: corretores } = await query;

  if (!corretores || corretores.length === 0) {
    return null;
  }

  // Aplicar mesmo algoritmo de scoring
  const corretoresWithScore = [];

  for (const corretor of corretores) {
    let score = 0;

    // Prioridade bairro
    const hasBairroMatch = corretor.corretor_bairros.some(
      (cb: any) => cb.bairro_id === lead.empreendimento.bairro_id
    );
    
    if (hasBairroMatch) {
      score = 1000;
    } else {
      // Prioridade construtora
      const hasConstrutorMatch = corretor.corretor_construtoras.some(
        (cc: any) => cc.construtora_id === lead.empreendimento.construtora_id
      );
      
      if (hasConstrutorMatch) {
        score = 500;
      }
    }

    score += (corretor.nota_media || 0) * 20;
    const visitasPenalty = Math.min(corretor.total_visitas || 0, 50);
    score += (50 - visitasPenalty);

    corretoresWithScore.push({ ...corretor, score });
  }

  // Retornar o de maior score
  return corretoresWithScore.sort((a, b) => b.score - a.score)[0] || null;
}

async function sendDistributionMessage(
  supabase: any,
  leadId: string,
  corretor: any,
  lead: any,
  settings: any,
  attemptOrder: number
) {
  console.log(`Enviando mensagem para corretor ${corretor.id}, tentativa ${attemptOrder}`);

  const timeoutAt = new Date();
  timeoutAt.setMinutes(timeoutAt.getMinutes() + settings.timeout_minutes);

  // Registrar nova tentativa
  const { data: attempt, error: attemptError } = await supabase
    .from('distribution_attempts')
    .insert({
      lead_id: leadId,
      corretor_id: corretor.id,
      attempt_order: attemptOrder,
      timeout_at: timeoutAt.toISOString(),
      status: 'pending'
    })
    .select()
    .single();

  if (attemptError) {
    console.error('Erro ao registrar tentativa:', attemptError);
    return;
  }

  // Preparar e enviar mensagem
  const message = `🏠 *NOVA OPORTUNIDADE DE VISITA*

*Cliente:* ${lead.nome}
*Telefone:* ${lead.telefone}
*Empreendimento:* ${lead.empreendimento.nome}
*Data solicitada:* ${lead.data_visita_solicitada}
*Horário:* ${lead.horario_visita_solicitada}

Para aceitar, responda: *SIM*
Para recusar, responda: *NÃO*

⏰ Você tem ${settings.timeout_minutes} minutos para responder.`;

  try {
    // SPRINT 5 - FASE 4a: Migrado para evolution-send-whatsapp-v2
    const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke(
      'evolution-send-whatsapp-v2',
      {
        body: {
          phone: corretor.whatsapp,
          message: message,
          metadata: {
            lead_id: leadId,
            corretor_id: corretor.id,
            type: 'lead_distribution_retry'
          }
        }
      }
    );

    if (whatsappError) {
      throw whatsappError;
    }

    await supabase
      .from('distribution_attempts')
      .update({ 
        whatsapp_message_id: whatsappResult.messageId 
      })
      .eq('id', attempt.id);

  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    
    await supabase
      .from('distribution_attempts')
      .update({ 
        status: 'timeout',
        response_type: 'timeout',
        response_message: `Erro no envio: ${error.message}`
      })
      .eq('id', attempt.id);
  }
}

async function notifyAdminFailure(supabase: any, lead: any, reason: string) {
  console.log('Notificando admin sobre falha:', reason);
  
  // Buscar WhatsApp do admin nas configurações
  const { data: adminWhatsapp } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'admin_whatsapp')
    .single();

  if (adminWhatsapp?.value) {
    const adminMessage = `🚨 *FALHA NA DISTRIBUIÇÃO DE LEAD*

*Lead:* ${lead.nome}
*Telefone:* ${lead.telefone}
*Empreendimento:* ${lead.empreendimento.nome}
*Motivo:* ${reason}

É necessário atribuir manualmente este lead.`;

    try {
      // SPRINT 5 - FASE 4a: Migrado para evolution-send-whatsapp-v2
      await supabase.functions.invoke('evolution-send-whatsapp-v2', {
        body: {
          phone: adminWhatsapp.value,
          message: adminMessage,
          metadata: {
            lead_id: lead.id,
            type: 'admin_notification_failure'
          }
        }
      });
    } catch (error) {
      console.error('Erro ao notificar admin:', error);
    }
  }
}