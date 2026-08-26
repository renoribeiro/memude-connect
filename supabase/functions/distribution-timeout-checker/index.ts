import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authorize, handleOptions, readJson } from '../_shared/security.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'https://core.memudecore.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const access = await authorize(req, 'internal');
  if (access instanceof Response) return access;

  try {
    const { supabase } = access;

    let body: any = {};
    try {
      body = await readJson(req, 1024 * 1024);
    } catch {
      // Body is optional (e.g. cron triggers)
    }

    const forceLeadId = body?.force_lead_id || body?.force_process_lead;
    const forceAdvanceLeadId = body?.force_advance_lead_id;

    if (forceAdvanceLeadId) {
      if (!/^[0-9a-f-]{36}$/i.test(forceAdvanceLeadId)) {
        return new Response(JSON.stringify({ error: 'force_advance_lead_id inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const advanced = await advanceDistributionForLead(supabase, forceAdvanceLeadId);
      return new Response(JSON.stringify({ success: true, advanced }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (forceLeadId) {
      console.log(`Forçando processamento de timeout para lead: ${forceLeadId}`);
      const { data: forceAttempt, error: forceError } = await supabase
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
            telefone,
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
        .eq('lead_id', forceLeadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (forceError) throw forceError;

      if (forceAttempt) {
        console.log(`Processando tentativa forçada ${forceAttempt.id} para o lead ${forceLeadId}`);
        await processExpiredAttempt(supabase, forceAttempt);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Lead ${forceLeadId} processado com sucesso`,
            attempt_id: forceAttempt.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log(`Nenhuma tentativa pendente encontrada para o lead ${forceLeadId}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Nenhuma tentativa pendente para o lead ${forceLeadId}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

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
          telefone,
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

  const queue = attempt.distribution_queue || await findActiveQueue(supabase, attempt.lead_id);
  if (!queue) {
    console.error(`Fila ativa não encontrada para tentativa ${attempt.id}`);
    return;
  }

  await advanceDistributionQueue(supabase, queue, attempt.lead);
}

async function findActiveQueue(supabase: any, leadId: string) {
  const { data, error } = await supabase
    .from('distribution_queue')
    .select('id, status, current_attempt, lead_id')
    .eq('lead_id', leadId)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function advanceDistributionForLead(supabase: any, leadId: string) {
  const queue = await findActiveQueue(supabase, leadId);
  if (!queue) return false;

  const { data: lead, error } = await supabase
    .from('leads')
    .select('id, nome, telefone, empreendimento:empreendimentos!inner(id, nome, bairro_id, construtora_id)')
    .eq('id', leadId)
    .maybeSingle();
  if (error) throw error;
  if (!lead) return false;

  await advanceDistributionQueue(supabase, queue, lead);
  return true;
}

async function advanceDistributionQueue(supabase: any, queue: any, lead: any) {
  // Buscar configurações
  const { data: settings } = await supabase
    .from('distribution_settings')
    .select('*')
    .single();

  const maxAttempts = settings?.max_attempts || 5;
  const currentAttempt = queue.current_attempt || 1;

  if (currentAttempt >= maxAttempts) {
    // Todas as tentativas esgotadas
    console.log(`Máximo de tentativas (${maxAttempts}) atingido para lead ${lead.id}`);
    
    const { data: failedQueue, error: failError } = await supabase
      .from('distribution_queue')
      .update({ 
        status: 'failed',
        failure_reason: 'Todas as tentativas esgotadas',
        completed_at: new Date().toISOString()
      })
      .eq('id', queue.id)
      .in('status', ['pending', 'in_progress'])
      .select('id')
      .maybeSingle();
    if (failError) throw failError;
    if (!failedQueue) return;

    // Notificar admin
    await notifyAdminFailure(supabase, lead, 'Todas as tentativas esgotadas');
    
  } else {
    // Tentar próximo corretor
    console.log(`Tentando próximo corretor para lead ${lead.id}`);
    
    const { data: claimedQueue, error: claimError } = await supabase
      .from('distribution_queue')
      .update({ 
        current_attempt: currentAttempt + 1
      })
      .eq('id', queue.id)
      .eq('current_attempt', currentAttempt)
      .select('id')
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimedQueue) {
      console.log(`Fila ${queue.id} já foi avançada por outro processo`);
      return;
    }

    // Buscar próximo corretor elegível
    await distributeToNextCorretor(supabase, queue.id, lead.id, currentAttempt + 1);
  }
}

async function distributeToNextCorretor(supabase: any, queueId: string, leadId: string, attemptNumber: number) {
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

  const { data: settings } = await supabase
    .from('distribution_settings')
    .select('*')
    .single();

  // Buscar próximo corretor elegível
  const nextCorretor = await getNextEligibleCorretor(supabase, lead, usedIds, settings);

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
  const sent = await sendDistributionMessage(supabase, queueId, leadId, nextCorretor, lead, settings, attemptNumber);
  if (!sent) {
    const queue = await findActiveQueue(supabase, leadId);
    if (queue) await advanceDistributionQueue(supabase, queue, lead);
  }
}

async function getNextEligibleCorretor(supabase: any, lead: any, excludeIds: string[], settings: any) {
  let query = supabase
    .from('corretores')
    .select(`
      id,
      profile_id,
      telefone,
      whatsapp,
      nota_media,
      total_visitas,
      corretor_bairros (bairro_id),
      corretor_construtoras (construtora_id)
    `)
    .eq('status', 'ativo');

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
    const hasBairroMatch = corretor.corretor_bairros?.some(
      (cb: any) => cb.bairro_id === lead.empreendimento.bairro_id
    ) || false;
    
    if (hasBairroMatch) {
      score = settings?.score_match_bairro ?? 10000;
    } else {
      // Prioridade construtora
      const hasConstrutorMatch = corretor.corretor_construtoras?.some(
        (cc: any) => cc.construtora_id === lead.empreendimento.construtora_id
      ) || false;
      
      if (hasConstrutorMatch) {
        score = settings?.score_match_construtora ?? 10000;
      }
    }

    score += (corretor.nota_media || 0) * (settings?.score_nota_multiplier ?? 100);
    const visitasPenalty = (corretor.total_visitas || 0) * (settings?.score_visitas_multiplier ?? 10);
    score += 1000 - Math.min(visitasPenalty, 1000);

    corretoresWithScore.push({ ...corretor, score });
  }

  // Retornar o de maior score
  return corretoresWithScore.sort((a, b) => b.score - a.score)[0] || null;
}

async function sendDistributionMessage(
  supabase: any,
  queueId: string,
  leadId: string,
  corretor: any,
  lead: any,
  settings: any,
  attemptOrder: number
): Promise<boolean> {
  console.log(`Enviando mensagem para corretor ${corretor.id}, tentativa ${attemptOrder}`);

  const timeoutAt = new Date();
  timeoutAt.setMinutes(timeoutAt.getMinutes() + settings.timeout_minutes);

  // Registrar nova tentativa
  const { data: attempt, error: attemptError } = await supabase
    .from('distribution_attempts')
    .insert({
      queue_id: queueId,
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
    return false;
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

    const messageId = whatsappResult?.result?.key?.id || whatsappResult?.queue_id || whatsappResult?.messageId || whatsappResult?.message_id;

    await supabase
      .from('distribution_attempts')
      .update({ 
        whatsapp_message_id: messageId
      })
      .eq('id', attempt.id);

    return true;

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
    return false;
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
