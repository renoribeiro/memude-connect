import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logStructured, createTimedLogger } from '../_shared/structuredLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadDistributionRequest {
  lead_id: string;
}

interface CorretorWithScore {
  id: string;
  profile_id: string;
  telefone: string;
  whatsapp: string;
  nota_media: number;
  total_visitas: number;
  score: number;
  match_type: 'bairro' | 'construtora' | 'geral';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // SECURITY: Verify caller is authenticated and is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Get the user from the JWT token
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Check if caller has admin role
    const { data: callerRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !callerRoles) {
      console.error('Role check error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // Rate limiting: 10 distribuições por minuto por usuário
    const { data: rateLimit } = await supabase.rpc('increment_rate_limit', {
      p_key: `distribute_lead:${callerUser.id}`,
      p_max: 10,
      p_window_seconds: 60
    });

    if (rateLimit && !rateLimit[0]?.is_allowed) {
      await logStructured(supabase, {
        level: 'warn',
        function_name: 'distribute-lead',
        event: 'rate_limit_exceeded',
        message: 'Rate limit exceeded for lead distribution',
        user_id: callerUser.id,
        request_id: requestId,
        execution_time_ms: Date.now() - startTime,
        metadata: { current_count: rateLimit[0]?.current_count }
      });

      return new Response(
        JSON.stringify({
          error: 'Muitas requisições. Aguarde um momento.',
          retry_after: 60
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      );
    }

    const { lead_id }: LeadDistributionRequest = await req.json();

    console.log('Iniciando distribuição para lead:', lead_id);

    // Buscar o lead com empreendimento
    const { data: lead, error: leadError } = await supabase
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
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      throw new Error(`Lead não encontrado: ${leadError?.message}`);
    }

    // Buscar configurações de distribuição
    const { data: settings } = await supabase
      .from('distribution_settings')
      .select('*')
      .single();

    if (!settings?.auto_distribution_enabled) {
      return new Response(
        JSON.stringify({ error: 'Distribuição automática desabilitada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Buscar corretores elegíveis
    const corretores = await getEligibleCorretores(supabase, lead, settings);

    if (corretores.length === 0) {
      console.log('Nenhum corretor elegível encontrado');
      await notifyAdmin(supabase, lead_id, 'Nenhum corretor elegível encontrado');
      return new Response(
        JSON.stringify({ error: 'Nenhum corretor elegível' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Adicionar à fila de distribuição
    const { data: queueItem, error: queueError } = await supabase
      .from('distribution_queue')
      .insert({
        lead_id: lead_id,
        status: 'pending'
      })
      .select()
      .single();

    if (queueError) {
      throw new Error(`Erro ao adicionar à fila: ${queueError.message}`);
    }

    // Iniciar processo de distribuição
    await startDistributionProcess(supabase, queueItem.id, corretores, lead, settings);

    await logStructured(supabase, {
      level: 'info',
      function_name: 'distribute-lead',
      event: 'distribution_started',
      message: 'Lead distribution started successfully',
      user_id: callerUser.id,
      lead_id: lead_id,
      request_id: requestId,
      execution_time_ms: Date.now() - startTime,
      metadata: {
        queue_id: queueItem.id,
        eligible_corretores: corretores.length
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        queue_id: queueItem.id,
        eligible_corretores: corretores.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na distribuição de lead:', error);

    await logStructured(supabase, {
      level: 'error',
      function_name: 'distribute-lead',
      event: 'distribution_failed',
      message: error.message,
      error_stack: error.stack,
      request_id: requestId,
      execution_time_ms: Date.now() - startTime
    });

    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function getEligibleCorretores(supabase: any, lead: any, settings: any) {
  console.log('Buscando corretores elegíveis para lead:', lead.id);

  // Buscar corretores ativos
  const { data: allCorretores, error } = await supabase
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

  if (error) {
    console.error('Erro ao buscar corretores:', error);
    return [];
  }

  const corretoresWithScore: CorretorWithScore[] = [];

  // Configurações de pontuação (com valores padrão caso não estejam definidos)
  const SCORE_MATCH_BAIRRO = settings?.score_match_bairro ?? 10000;
  const SCORE_MATCH_CONSTRUTORA = settings?.score_match_construtora ?? 10000;
  const SCORE_NOTA_MULTIPLIER = settings?.score_nota_multiplier ?? 100;
  const SCORE_VISITAS_MULTIPLIER = settings?.score_visitas_multiplier ?? 10;

  for (const corretor of allCorretores) {
    let matchType: 'bairro' | 'construtora' | 'geral' = 'geral';
    let score = 0;

    // Prioridade 1: Compatibilidade (Bairro ou Construtora) - Peso Absoluto
    const hasBairroMatch = corretor.corretor_bairros?.some(
      (cb: any) => cb.bairro_id === lead.empreendimento.bairro_id
    ) || false;

    const hasConstrutorMatch = corretor.corretor_construtoras?.some(
      (cc: any) => cc.construtora_id === lead.empreendimento.construtora_id
    ) || false;

    if (hasBairroMatch) {
      matchType = 'bairro';
      score += SCORE_MATCH_BAIRRO;
    } else if (hasConstrutorMatch) {
      matchType = 'construtora';
      score += SCORE_MATCH_CONSTRUTORA;
    }

    // Prioridade 2: Reputação Profissional (Nota Média)
    score += (corretor.nota_media || 0) * SCORE_NOTA_MULTIPLIER;

    // Prioridade 3: Equilíbrio de Oportunidades (Menor número de visitas)
    const visitasPenalty = (corretor.total_visitas || 0) * SCORE_VISITAS_MULTIPLIER;
    score += (1000 - Math.min(visitasPenalty, 1000));

    corretoresWithScore.push({
      ...corretor,
      score,
      match_type: matchType
    });
  }

  // Ordenar por score (maior primeiro)
  return corretoresWithScore.sort((a, b) => b.score - a.score);
}

async function startDistributionProcess(
  supabase: any,
  queueId: string,
  corretores: CorretorWithScore[],
  lead: any,
  settings: any
) {
  console.log('Iniciando processo de distribuição para queue:', queueId);

  // Atualizar status da fila
  await supabase
    .from('distribution_queue')
    .update({ status: 'in_progress' })
    .eq('id', queueId);

  // Enviar para o primeiro corretor
  const firstCorretor = corretores[0];
  await sendDistributionMessage(supabase, queueId, firstCorretor, lead, settings, 1);
}

async function sendDistributionMessage(
  supabase: any,
  queueId: string,
  corretor: CorretorWithScore,
  lead: any,
  settings: any,
  attemptOrder: number
) {
  console.log(`Enviando mensagem para corretor ${corretor.id}, tentativa ${attemptOrder}`);

  const timeoutAt = new Date();
  timeoutAt.setMinutes(timeoutAt.getMinutes() + settings.timeout_minutes);

  // Registrar tentativa
  const { data: attempt, error: attemptError } = await supabase
    .from('distribution_attempts')
    .insert({
      lead_id: lead.id,
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

  // Fase 3: Verificar se o número existe no WhatsApp antes de enviar
  console.log(`🔍 Verificando número WhatsApp: ${corretor.whatsapp}`);

  try {
    const { data: checkResult, error: checkError } = await supabase.functions.invoke(
      'evolution-check-number',
      {
        body: { phone_number: corretor.whatsapp }
      }
    );

    if (checkError || !checkResult?.success || !checkResult?.exists) {
      console.error(`❌ Número não existe no WhatsApp: ${corretor.whatsapp}`, checkError);

      // Registrar erro no communication_log
      await supabase.from('communication_log').insert({
        type: 'whatsapp',
        direction: 'enviado',
        phone_number: corretor.whatsapp,
        content: 'Verificação de número falhou',
        status: 'failed',
        corretor_id: corretor.id,
        metadata: {
          error: 'number_not_on_whatsapp',
          check_error: checkError?.message,
          lead_id: lead.id
        }
      });

      // Marcar tentativa como falhada
      await supabase
        .from('distribution_attempts')
        .update({
          status: 'timeout',
          response_type: 'number_invalid',
          response_message: 'Número não existe no WhatsApp'
        })
        .eq('id', attempt.id);

      return;
    }

    console.log(`✅ Número verificado com sucesso no WhatsApp`);
  } catch (verificationError) {
    console.error('⚠️ Erro ao verificar número, prosseguindo com envio:', verificationError);
    // Continuar com envio mesmo se verificação falhar (fallback)
  }

  // Preparar mensagem
  const message = formatDistributionMessage(lead, corretor.match_type);

  try {
    // Enviar via WhatsApp usando evolution-send-whatsapp-v2 com botões (Async)
    const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke(
      'evolution-send-whatsapp-v2',
      {
        body: {
          phone_number: corretor.whatsapp,
          message: message,
          buttons: [
            { id: 'accept_lead', text: '✅ ACEITAR' },
            { id: 'reject_lead', text: '❌ RECUSAR' }
          ],
          lead_id: lead.id,
          corretor_id: corretor.id,
          async: true
        }
      }
    );

    if (whatsappError) {
      console.error('Erro ao enviar WhatsApp:', whatsappError);

      await logStructured(supabase, {
        level: 'error',
        function_name: 'distribute-lead',
        event: 'whatsapp_send_failed',
        message: 'Failed to send WhatsApp message',
        corretor_id: corretor.id,
        lead_id: lead.id,
        error_stack: whatsappError.message,
        metadata: { phone_number: corretor.whatsapp }
      });

      throw whatsappError;
    }

    // Atualizar tentativa com message_id (ou queue_id)
    const messageId = whatsappResult.queue_id || whatsappResult.message_id || whatsappResult.key?.id;

    await supabase
      .from('distribution_attempts')
      .update({
        whatsapp_message_id: messageId,
        status: 'pending'
      })
      .eq('id', attempt.id);

    await logStructured(supabase, {
      level: 'info',
      function_name: 'distribute-lead',
      event: 'whatsapp_sent',
      message: 'WhatsApp message sent successfully',
      corretor_id: corretor.id,
      lead_id: lead.id,
      metadata: {
        message_id: whatsappResult.message_id,
        phone_number: corretor.whatsapp,
        attempt_order: attemptOrder
      }
    });

    console.log('Mensagem enviada com sucesso para:', corretor.whatsapp);

    // Criar notificação para o corretor
    if (corretor.profile_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', corretor.profile_id)
        .single();

      if (profile?.user_id) {
        await supabase.functions.invoke('create-notification', {
          body: {
            user_id: profile.user_id,
            type: 'lead_distributed',
            title: 'Novo Lead Atribuído',
            message: `Lead ${lead.nome} foi enviado para você. Responda em até ${settings.timeout_minutes} minutos.`,
            metadata: {
              timeout_minutes: settings.timeout_minutes,
              lead_name: lead.nome,
              empreendimento: lead.empreendimento?.nome,
              match_type: corretor.match_type
            },
            related_lead_id: lead.id,
            related_corretor_id: corretor.id
          }
        });
        console.log('Notificação criada para corretor:', corretor.id);
      }
    }

  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);

    // Marcar tentativa como falhada
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

function formatDistributionMessage(lead: any, matchType: string): string {
  const matchInfo = matchType === 'bairro'
    ? 'no seu bairro de atendimento'
    : matchType === 'construtora'
      ? 'da sua construtora'
      : 'disponível';

  return `🏠 *NOVA OPORTUNIDADE DE VISITA*

*Cliente:* ${lead.nome}
*Telefone:* ${lead.telefone}
*Empreendimento:* ${lead.empreendimento.nome}
*Data solicitada:* ${lead.data_visita_solicitada}
*Horário:* ${lead.horario_visita_solicitada}

Esta oportunidade está ${matchInfo}.

Para aceitar, responda: *SIM*
Para recusar, responda: *NÃO*

⏰ Você tem 15 minutos para responder.`;
}

async function notifyAdmin(supabase: any, leadId: string, reason: string) {
  console.log('Notificando admin:', reason);

  // Aqui você pode implementar notificação para admin
  // Por exemplo, enviar email ou WhatsApp para o administrador

  await supabase
    .from('distribution_queue')
    .update({
      status: 'failed',
      failure_reason: reason,
      completed_at: new Date().toISOString()
    })
    .eq('lead_id', leadId);
}