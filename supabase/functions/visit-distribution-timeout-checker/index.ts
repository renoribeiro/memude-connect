import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizePhoneNumber } from '../_shared/phoneHelpers.ts';

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

    console.log('Verificando timeouts de distribuição de visitas...');

    // Buscar tentativas pendentes que expiraram
    // Usando queue_id como FK explícita (adicionada na Fase 1 do Sprint 5)
    const { data: expiredAttempts, error } = await supabase
      .from('visit_distribution_attempts')
      .select(`
        *,
        visit_distribution_queue!queue_id (
          id,
          status,
          current_attempt,
          visita_id
        ),
        visita:visitas!visita_id (
          id,
          data_visita,
          horario_visita,
          lead:leads!lead_id (
            id,
            nome,
            telefone,
            email
          ),
          empreendimento:empreendimentos!empreendimento_id (
            nome
          )
        ),
        corretor:corretores!corretor_id (
          id,
          whatsapp,
          profiles!profile_id (
            first_name,
            last_name
          )
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

    const processedResults = [];

    for (const attempt of expiredAttempts) {
      try {
        const result = await processExpiredAttempt(supabase, attempt);
        processedResults.push(result);
      } catch (error) {
        console.error(`Erro ao processar tentativa ${attempt.id}:`, error);
        processedResults.push({
          attempt_id: attempt.id,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: expiredAttempts.length,
        results: processedResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no checker de timeout de visitas:', error);
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
    .from('visit_distribution_attempts')
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
  const currentAttempt = attempt.visit_distribution_queue.current_attempt;

  console.log(`Tentativa ${currentAttempt} de ${maxAttempts} expirou`);

  if (currentAttempt >= maxAttempts) {
    // Todas as tentativas esgotadas
    console.log(`Máximo de tentativas atingido para visita ${attempt.visita.id}`);
    
    await supabase
      .from('visit_distribution_queue')
      .update({ 
        status: 'failed',
        failure_reason: 'Todas as tentativas esgotadas - nenhum corretor aceitou',
        completed_at: new Date().toISOString()
      })
      .eq('id', attempt.visit_distribution_queue.id);

    // Notificar admin
    await notifyAdminFailure(
      supabase, 
      attempt.visita, 
      'Todas as tentativas esgotadas - nenhum corretor aceitou a visita'
    );
    
    return {
      attempt_id: attempt.id,
      action: 'failed',
      reason: 'Máximo de tentativas atingido'
    };

  } else {
    // Tentar próximo corretor
    console.log(`Tentando próximo corretor para visita ${attempt.visita.id}`);
    
    await supabase
      .from('visit_distribution_queue')
      .update({ 
        current_attempt: currentAttempt + 1
      })
      .eq('id', attempt.visit_distribution_queue.id);

    // Buscar próximo corretor elegível
    const nextResult = await distributeToNextCorretor(
      supabase, 
      attempt.visita_id, 
      currentAttempt + 1
    );

    return {
      attempt_id: attempt.id,
      action: 'retry',
      next_attempt: currentAttempt + 1,
      next_corretor: nextResult
    };
  }
}

async function distributeToNextCorretor(
  supabase: any, 
  visitaId: string, 
  attemptNumber: number
) {
  console.log(`Distribuindo para próximo corretor, tentativa ${attemptNumber}`);

  // Buscar corretores que já receberam esta oportunidade
  const { data: usedAttempts } = await supabase
    .from('visit_distribution_attempts')
    .select('corretor_id')
    .eq('visita_id', visitaId);

  const usedCorretorIds = usedAttempts?.map((a: any) => a.corretor_id) || [];

  // Buscar visita com todos os dados
  const { data: visita } = await supabase
    .from('visitas')
    .select(`
      *,
      lead:leads!inner (
        id,
        nome,
        telefone,
        email
      ),
      empreendimento:empreendimentos (
        id,
        nome,
        bairro_id,
        construtora_id,
        tipo_imovel
      )
    `)
    .eq('id', visitaId)
    .is('deleted_at', null)
    .single();

  if (!visita) {
    console.error('Visita não encontrada:', visitaId);
    throw new Error('Visita não encontrada');
  }

  // Buscar próximo corretor elegível (excluindo os já tentados)
  const nextCorretor = await getNextEligibleCorretor(supabase, visita, usedCorretorIds);

  if (!nextCorretor) {
    console.log('Nenhum corretor elegível restante');
    
    await supabase
      .from('visit_distribution_queue')
      .update({ 
        status: 'failed',
        failure_reason: 'Nenhum corretor elegível disponível',
        completed_at: new Date().toISOString()
      })
      .eq('visita_id', visitaId);

    await notifyAdminFailure(
      supabase, 
      visita, 
      'Nenhum corretor elegível disponível para esta visita'
    );
    
    return null;
  }

  // Enviar mensagem para próximo corretor
  const { data: settings } = await supabase
    .from('distribution_settings')
    .select('*')
    .single();

  await sendDistributionMessage(
    supabase, 
    visitaId, 
    nextCorretor, 
    visita, 
    settings, 
    attemptNumber
  );

  return {
    corretor_id: nextCorretor.id,
    corretor_name: `${nextCorretor.profiles.first_name} ${nextCorretor.profiles.last_name}`,
    score: nextCorretor.score
  };
}

async function getNextEligibleCorretor(
  supabase: any, 
  visita: any, 
  excludeIds: string[]
) {
  console.log(`Buscando próximo corretor (excluindo ${excludeIds.length} já tentados)`);

  // Buscar corretores ativos
  let query = supabase
    .from('corretores')
    .select(`
      id,
      profile_id,
      whatsapp,
      telefone,
      nota_media,
      total_visitas,
      tipo_imovel,
      corretor_bairros (bairro_id),
      corretor_construtoras (construtora_id),
      profiles!inner (
        first_name,
        last_name
      )
    `)
    .eq('status', 'ativo')
    .is('deleted_at', null);

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data: corretores } = await query;

  if (!corretores || corretores.length === 0) {
    console.log('Nenhum corretor elegível encontrado após exclusões');
    return null;
  }

  console.log(`Avaliando ${corretores.length} corretores restantes`);

  // Filtrar apenas com WhatsApp/telefone
  const corretoresComContato = corretores.filter(c => c.whatsapp || c.telefone);
  
  if (corretoresComContato.length === 0) {
    console.log('Nenhum corretor com WhatsApp/telefone disponível');
    return null;
  }

  // Aplicar algoritmo de scoring
  const corretoresWithScore = [];

  for (const corretor of corretoresComContato) {
    let score = 0;

    // Prioridade 1: Compatibilidade (Bairro ou Construtora)
    let hasMatch = false;

    // Construtora
    if (visita.empreendimento?.construtora_id) {
      const hasConstrutorMatch = corretor.corretor_construtoras?.some(
        (cc: any) => cc.construtora_id === visita.empreendimento.construtora_id
      );
      if (hasConstrutorMatch) {
        score += 10000;
        hasMatch = true;
      }
    }

    // Bairro (Se não deu match na construtora, tenta bairro, ou soma se for o caso de priorizar ambos)
    // A regra diz: "Corretores que atendem a cidade e o bairro... OU construtora"
    // Vamos garantir que se já tem match de construtora, não duplique absurdamente, mas se tiver ambos é melhor ainda?
    // O requisito diz "Prioridade 1: Compatibilidade geográfica... ou construtora".
    // Vamos manter simples: Se tem um dos dois, ganha o bonus de compatibilidade.
    
    if (!hasMatch && visita.empreendimento?.bairro_id) {
      const hasBairroMatch = corretor.corretor_bairros?.some(
        (cb: any) => cb.bairro_id === visita.empreendimento.bairro_id
      );
      if (hasBairroMatch) {
        score += 10000;
        hasMatch = true;
      }
    } else if (hasMatch && visita.empreendimento?.bairro_id) {
       // Se já tem construtora e também tem bairro, damos um pequeno bonus de desempate
       const hasBairroMatch = corretor.corretor_bairros?.some(
        (cb: any) => cb.bairro_id === visita.empreendimento.bairro_id
      );
      if (hasBairroMatch) score += 500; // Bonus por "Combo"
    }

    // Prioridade 2: Reputação (Nota Média)
    score += Math.round((corretor.nota_media || 0) * 100);

    // Prioridade 3: Equilíbrio (Menos visitas)
    const visitasPenalty = (corretor.total_visitas || 0) * 10;
    score += (1000 - Math.min(visitasPenalty, 1000));

    corretoresWithScore.push({ ...corretor, score });
  }

  // Retornar o de maior score
  const bestCorretor = corretoresWithScore.sort((a, b) => b.score - a.score)[0];
  
  if (bestCorretor) {
    console.log(`Próximo corretor selecionado: ${bestCorretor.profiles.first_name} ${bestCorretor.profiles.last_name} (Score: ${bestCorretor.score})`);
  }

  return bestCorretor || null;
}

async function sendDistributionMessage(
  supabase: any,
  visitaId: string,
  corretor: any,
  visita: any,
  settings: any,
  attemptOrder: number
) {
  console.log(`Enviando mensagem para corretor ${corretor.id}, tentativa ${attemptOrder}`);

  const timeoutAt = new Date();
  timeoutAt.setMinutes(timeoutAt.getMinutes() + (settings?.timeout_minutes || 15));

  const dataVisita = new Date(visita.data_visita).toLocaleDateString('pt-BR');

  // Registrar nova tentativa
  const { data: attempt, error: attemptError } = await supabase
    .from('visit_distribution_attempts')
    .insert({
      visita_id: visitaId,
      corretor_id: corretor.id,
      attempt_order: attemptOrder,
      timeout_at: timeoutAt.toISOString(),
      status: 'pending'
    })
    .select()
    .single();

  if (attemptError) {
    console.error('Erro ao registrar tentativa:', attemptError);
    throw attemptError;
  }

  const message = `🏠 *NOVA OPORTUNIDADE DE VISITA*

*Cliente:* ${visita.lead.nome}
*Telefone:* ${visita.lead.telefone}
${visita.lead.email ? `*E-mail:* ${visita.lead.email}` : ''}
*Empreendimento:* ${visita.empreendimento?.nome || 'Não especificado'}
*Data:* ${dataVisita}
*Horário:* ${visita.horario_visita}

✅ Para aceitar, responda: *SIM*
❌ Para recusar, responda: *NÃO*

⏰ Você tem ${settings?.timeout_minutes || 15} minutos para responder.`;

  // Usar whatsapp ou telefone como fallback - normalizar para Evolution API
  const rawPhoneNumber = corretor.whatsapp || corretor.telefone;
  const phoneNumber = normalizePhoneNumber(rawPhoneNumber);
  
  console.log(`Enviando retry WhatsApp para: ${phoneNumber} (original: ${rawPhoneNumber}) (tentativa ${attemptOrder})`);

  try {
    // SPRINT 5 - FASE 4a: Migrado para evolution-send-whatsapp-v2
    const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke(
      'evolution-send-whatsapp-v2',
      {
        body: {
          phone: phoneNumber,
          message: message,
          metadata: {
            lead_id: visita.lead.id,
            corretor_id: corretor.id,
            visita_id: visita.id,
            type: 'visit_distribution_retry'
          }
        }
      }
    );

    if (whatsappError) {
      throw whatsappError;
    }

    await supabase
      .from('visit_distribution_attempts')
      .update({ 
        whatsapp_message_id: whatsappResult.messageId 
      })
      .eq('id', attempt.id);

    console.log(`Mensagem enviada com sucesso para tentativa ${attemptOrder}`);

  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    
    await supabase
      .from('visit_distribution_attempts')
      .update({ 
        status: 'error',
        response_message: `Erro no envio: ${error.message}`
      })
      .eq('id', attempt.id);

    throw error;
  }
}

async function notifyAdminFailure(supabase: any, visita: any, reason: string) {
  console.log('Notificando admin sobre falha:', reason);
  
  try {
    const { data: adminSettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'admin_whatsapp')
      .single();

    if (!adminSettings?.value) {
      console.log('WhatsApp do administrador não configurado');
      return;
    }

    const dataVisita = new Date(visita.data_visita).toLocaleDateString('pt-BR');

    const adminMessage = `🚨 *FALHA NA DISTRIBUIÇÃO AUTOMÁTICA DE VISITA*

*Visita ID:* ${visita.id}
*Cliente:* ${visita.lead.nome}
*Telefone:* ${visita.lead.telefone}
*Empreendimento:* ${visita.empreendimento?.nome || 'Não especificado'}
*Data:* ${dataVisita}
*Horário:* ${visita.horario_visita}

*Motivo:* ${reason}

⚠️ *É necessário atribuir manualmente um corretor para esta visita.*`;

    // SPRINT 5 - FASE 4a: Migrado para evolution-send-whatsapp-v2
    await supabase.functions.invoke('evolution-send-whatsapp-v2', {
      body: {
        phone: adminSettings.value,
        message: adminMessage,
        metadata: {
          lead_id: visita.lead.id,
          visita_id: visita.id,
          type: 'admin_notification_visit_failure'
        }
      }
    });

    console.log('Administrador notificado com sucesso');

  } catch (error) {
    console.error('Erro ao notificar administrador:', error);
  }
}
