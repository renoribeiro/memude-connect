import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizePhoneNumber } from '../_shared/phoneHelpers.ts';
import { logStructured, createTimedLogger } from '../_shared/structuredLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DistributeVisitRequest {
  visita_id: string;
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

    // SPRINT 2: Rate Limiting para distribuição
    const distributionRateLimitKey = `distribute:${callerUser.id}:${Math.floor(Date.now() / 60000)}`;
    const { data: rateLimitResult, error: rateLimitError } = await supabase
      .rpc('increment_rate_limit', {
        p_key: distributionRateLimitKey,
        p_max: 5,  // 5 distribuições por minuto
        p_window_seconds: 60
      })
      .single();

    if (rateLimitError) {
      console.warn('Rate limit check failed:', rateLimitError);
    } else if (rateLimitResult && !rateLimitResult.is_allowed) {
      await logStructured(supabase, {
        level: 'warn',
        function_name: 'distribute-visit',
        event: 'rate_limit_exceeded',
        message: `Distribution rate limit exceeded for user ${callerUser.id}`,
        user_id: callerUser.id,
        metadata: { current_count: rateLimitResult.current_count, limit: 5 },
        request_id: requestId
      });

      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Você está criando distribuições muito rápido. Aguarde um minuto.',
          retry_after: 60
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      );
    }

    const { visita_id }: DistributeVisitRequest = await req.json();

    if (!visita_id) {
      throw new Error('visita_id é obrigatório');
    }

    console.log(`Iniciando distribuição automática para visita ${visita_id}`);

    // FASE 4: Verificar status do webhook antes da distribuição
    const { data: webhookSettings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['evolution_webhook_enabled', 'evolution_webhook_url']);

    const webhookMap = new Map(webhookSettings?.map(s => [s.key, s.value]) || []);
    const webhookEnabled = webhookMap.get('evolution_webhook_enabled') === 'true';
    const webhookUrl = webhookMap.get('evolution_webhook_url');

    if (!webhookEnabled || !webhookUrl) {
      console.warn('⚠️ AVISO: Webhook não configurado! Corretores não poderão responder SIM/NÃO.');
      console.warn('Configure o webhook em: /configuracoes -> aba Comunicação');
    }

    // Buscar dados completos da visita
    const { data: visita, error: visitaError } = await supabase
      .from('visitas')
      .select(`
        *,
        lead:leads!inner (
          id,
          nome,
          telefone,
          email,
          empreendimento_id
        ),
        empreendimento:empreendimentos (
          id,
          nome,
          endereco,
          bairro_id,
          construtora_id,
          tipo_imovel
        )
      `)
      .eq('id', visita_id)
      .is('deleted_at', null)
      .single();

    if (visitaError || !visita) {
      throw new Error(`Visita não encontrada: ${visitaError?.message}`);
    }

    console.log('Dados da visita:', visita);

    // Buscar configurações globais
    const { data: settings } = await supabase
      .from('distribution_settings')
      .select('*')
      .single();

    const distributionSettings = settings || {
      max_attempts: 5,
      timeout_minutes: 15,
      auto_distribution_enabled: true,
      fallback_to_admin: true
    };

    if (!distributionSettings.auto_distribution_enabled) {
      throw new Error('Distribuição automática está desabilitada');
    }

    // Buscar corretores elegíveis
    const eligibleCorretores = await getEligibleCorretores(supabase, visita);

    if (!eligibleCorretores || eligibleCorretores.length === 0) {
      console.log('Nenhum corretor elegível encontrado');

      // Notificar admin
      await notifyAdmin(supabase, visita, 'Nenhum corretor elegível encontrado');

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Nenhum corretor elegível encontrado',
          visita_id
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Encontrados ${eligibleCorretores.length} corretores elegíveis`);

    // FASE: Limpar distribuições anteriores antes de iniciar nova
    // Isso evita violação da constraint unique (visita_id, corretor_id, attempt_order)
    // IMPORTANTE: Deletamos ao invés de cancelar porque a constraint considera a tupla
    // (visita_id, corretor_id, attempt_order) independente do status
    console.log('🧹 Verificando e limpando distribuições anteriores...');

    // Buscar TODAS as filas anteriores para esta visita (não apenas in_progress)
    const { data: previousQueues } = await supabase
      .from('visit_distribution_queue')
      .select('id')
      .eq('visita_id', visita_id);

    if (previousQueues && previousQueues.length > 0) {
      const queueIds = previousQueues.map((q: { id: string }) => q.id);
      console.log(`📋 Encontradas ${queueIds.length} filas anteriores para limpar`);

      // DELETAR tentativas anteriores (não apenas cancelar)
      // Necessário para evitar violação de constraint unique
      const { error: attemptDeleteError } = await supabase
        .from('visit_distribution_attempts')
        .delete()
        .eq('visita_id', visita_id);

      if (attemptDeleteError) {
        console.warn('⚠️ Erro ao deletar tentativas anteriores:', attemptDeleteError);
      } else {
        console.log('✅ Tentativas anteriores deletadas');
      }

      // DELETAR filas anteriores também
      const { error: queueDeleteError } = await supabase
        .from('visit_distribution_queue')
        .delete()
        .eq('visita_id', visita_id);

      if (queueDeleteError) {
        console.warn('⚠️ Erro ao deletar filas anteriores:', queueDeleteError);
      } else {
        console.log('✅ Filas anteriores deletadas');
      }
    }

    // Adicionar à fila de distribuição
    const { data: queueEntry, error: queueError } = await supabase
      .from('visit_distribution_queue')
      .insert({
        visita_id: visita_id,
        status: 'in_progress',
        current_attempt: 1
      })
      .select()
      .single();

    if (queueError) {
      throw new Error(`Erro ao adicionar à fila: ${queueError.message}`);
    }

    // Enviar mensagem para o primeiro corretor
    const firstCorretor = eligibleCorretores[0];
    await sendDistributionMessage(
      supabase,
      visita_id,
      firstCorretor,
      visita,
      distributionSettings,
      1,
      queueEntry.id // Pass queue_id for FK relationship
    );

    // Criar notificação para o corretor
    if (firstCorretor.profile_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', firstCorretor.profile_id)
        .single();

      if (profile?.user_id) {
        await supabase.functions.invoke('create-notification', {
          body: {
            user_id: profile.user_id,
            type: 'new_visit',
            title: 'Nova Visita Atribuída',
            message: `Visita para ${visita.lead?.nome} foi atribuída a você para ${new Date(visita.data_visita).toLocaleDateString('pt-BR')}.`,
            metadata: {
              lead_name: visita.lead?.nome,
              visit_date: visita.data_visita,
              visit_time: visita.horario_visita,
              empreendimento: visita.empreendimento?.nome
            },
            related_visit_id: visita_id,
            related_corretor_id: firstCorretor.id,
            related_lead_id: visita.lead_id
          }
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        visita_id,
        queue_id: queueEntry.id,
        corretor_id: firstCorretor.id,
        total_eligible: eligibleCorretores.length,
        message: 'Distribuição iniciada com sucesso'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro na função distribute-visit:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function getEligibleCorretores(supabase: any, visita: any) {
  console.log('Buscando corretores elegíveis...');
  console.log('Dados da visita para matching:', {
    empreendimento_id: visita.empreendimento?.id,
    construtora_id: visita.empreendimento?.construtora_id,
    bairro_id: visita.empreendimento?.bairro_id,
    tipo_imovel: visita.empreendimento?.tipo_imovel
  });

  // Buscar todos os corretores ativos
  const { data: corretores, error } = await supabase
    .from('corretores')
    .select(`
      id,
      profile_id,
      whatsapp,
      telefone,
      email,
      nota_media,
      total_visitas,
      tipo_imovel,
      status,
      deleted_at,
      corretor_bairros (bairro_id),
      corretor_construtoras (construtora_id),
      profiles!inner (
        first_name,
        last_name
      )
    `)
    .eq('status', 'ativo')
    .is('deleted_at', null);

  if (error) {
    console.error('Erro ao buscar corretores:', error);
    return [];
  }

  if (!corretores || corretores.length === 0) {
    console.log('Nenhum corretor ativo encontrado no banco de dados');
    return [];
  }

  console.log(`Total de corretores ativos encontrados: ${corretores.length}`);

  // Log detalhado de cada corretor
  corretores.forEach((c, i) => {
    console.log(`Corretor ${i + 1}: ${c.profiles.first_name} ${c.profiles.last_name}`, {
      id: c.id,
      whatsapp: c.whatsapp || 'NÃO INFORMADO',
      telefone: c.telefone || 'NÃO INFORMADO',
      status: c.status,
      tipo_imovel: c.tipo_imovel,
      total_visitas: c.total_visitas,
      nota_media: c.nota_media,
      construtoras_count: c.corretor_construtoras?.length || 0,
      bairros_count: c.corretor_bairros?.length || 0
    });
  });

  console.log(`Avaliando ${corretores.length} corretores...`);

  // Aplicar algoritmo de scoring
  const corretoresWithScore = [];

  for (const corretor of corretores) {
    let score = 0;
    const matchDetails: string[] = [];

    // 1ª PRIORIDADE: Construtora (1000 pontos)
    if (visita.empreendimento?.construtora_id) {
      const hasConstrutorMatch = corretor.corretor_construtoras?.some(
        (cc: any) => cc.construtora_id === visita.empreendimento.construtora_id
      );

      if (hasConstrutorMatch) {
        score += 1000;
        matchDetails.push('Construtora Match');
      }
    }

    // 2ª PRIORIDADE: Bairro (500 pontos)
    if (visita.empreendimento?.bairro_id) {
      const hasBairroMatch = corretor.corretor_bairros?.some(
        (cb: any) => cb.bairro_id === visita.empreendimento.bairro_id
      );

      if (hasBairroMatch) {
        score += 500;
        matchDetails.push('Bairro Match');
      }
    }

    // 3ª PRIORIDADE: Tipo de Imóvel (200 pontos)
    if (visita.empreendimento?.tipo_imovel) {
      const tipoImovelMatch =
        corretor.tipo_imovel === 'todos' ||
        corretor.tipo_imovel === visita.empreendimento.tipo_imovel;

      if (tipoImovelMatch) {
        score += 200;
        matchDetails.push('Tipo Imóvel Match');
      }
    }

    // 4ª PRIORIDADE: Nota do Corretor (0-100 pontos)
    const notaScore = Math.round((corretor.nota_media || 0) * 20);
    score += notaScore;
    if (notaScore > 0) {
      matchDetails.push(`Nota: ${corretor.nota_media?.toFixed(1)}`);
    }

    // 5ª PRIORIDADE: Menor número de visitas (0-50 pontos)
    const visitasPenalty = Math.min(corretor.total_visitas || 0, 50);
    const visitasScore = 50 - visitasPenalty;
    score += visitasScore;
    matchDetails.push(`Visitas: ${corretor.total_visitas || 0}`);

    corretoresWithScore.push({
      ...corretor,
      score,
      matchDetails: matchDetails.join(', ')
    });
  }

  // Ordenar por score (maior primeiro)
  const sortedCorretores = corretoresWithScore
    .sort((a, b) => b.score - a.score);

  console.log(`Total de corretores avaliados: ${sortedCorretores.length}`);

  // Filtrar apenas corretores com WhatsApp
  const corretoresWithWhatsApp = sortedCorretores.filter(c => {
    const hasWhatsApp = !!(c.whatsapp || c.telefone);
    if (!hasWhatsApp) {
      console.log(`❌ Corretor ${c.profiles.first_name} ${c.profiles.last_name} excluído - sem WhatsApp/telefone`);
    }
    return hasWhatsApp;
  });

  console.log(`Corretores com WhatsApp: ${corretoresWithWhatsApp.length} de ${sortedCorretores.length}`);

  // Log dos top 5 corretores
  console.log('=== TOP 5 CORRETORES ELEGÍVEIS ===');
  corretoresWithWhatsApp.slice(0, 5).forEach((c, i) => {
    console.log(`${i + 1}. ${c.profiles.first_name} ${c.profiles.last_name}`);
    console.log(`   Score: ${c.score}`);
    console.log(`   WhatsApp: ${c.whatsapp || c.telefone}`);
    console.log(`   Matches: ${c.matchDetails}`);
    console.log('---');
  });

  return corretoresWithWhatsApp;
}

async function sendDistributionMessage(
  supabase: any,
  visitaId: string,
  corretor: any,
  visita: any,
  settings: any,
  attemptOrder: number,
  queueId: string // Add queue_id parameter for FK relationship
) {
  console.log(`Enviando mensagem para corretor ${corretor.id}, tentativa ${attemptOrder}`);

  const timeoutAt = new Date();
  timeoutAt.setMinutes(timeoutAt.getMinutes() + (settings.timeout_minutes || 15));

  // Formatar data e horário
  const dataVisita = new Date(visita.data_visita).toLocaleDateString('pt-BR');
  const horarioVisita = visita.horario_visita;

  // Registrar tentativa
  const { data: attempt, error: attemptError } = await supabase
    .from('visit_distribution_attempts')
    .insert({
      visita_id: visitaId,
      corretor_id: corretor.id,
      attempt_order: attemptOrder,
      timeout_at: timeoutAt.toISOString(),
      status: 'pending',
      queue_id: queueId // Critical: FK for response processing
    })
    .select()
    .single();

  if (attemptError) {
    console.error('Erro ao registrar tentativa:', attemptError);
    throw attemptError;
  }

  // Buscar bairro para incluir nos dados
  let bairroNome = 'Não especificado';
  if (visita.empreendimento?.bairro_id) {
    const { data: bairro } = await supabase
      .from('bairros')
      .select('nome')
      .eq('id', visita.empreendimento.bairro_id)
      .single();
    if (bairro) bairroNome = bairro.nome;
  }

  // Renderizar mensagem usando template
  let message = '';
  try {
    const { data: templateResult, error: templateError } = await supabase.functions.invoke(
      'template-renderer',
      {
        body: {
          category: 'visit_distribution',
          type: 'whatsapp',
          variables: {
            nome_lead: visita.lead.nome,
            telefone_lead: visita.lead.telefone,
            email_lead: visita.lead.email || 'Não informado',
            empreendimento_nome: visita.empreendimento?.nome || 'Não especificado',
            empreendimento_endereco: visita.empreendimento?.endereco || 'Não especificado',
            bairro_nome: bairroNome,
            data_visita: dataVisita,
            horario_visita: horarioVisita,
            observacoes: visita.lead.observacoes || 'Nenhuma observação'
          },
          previewMode: false
        }
      }
    );

    if (templateError || !templateResult?.rendered_content) {
      console.error('Erro ao renderizar template:', templateError);
      // Fallback para mensagem padrão
      message = `🏠 *NOVA OPORTUNIDADE DE VISITA*

*Cliente:* ${visita.lead.nome}
*Telefone:* ${visita.lead.telefone}
${visita.lead.email ? `*E-mail:* ${visita.lead.email}` : ''}
*Empreendimento:* ${visita.empreendimento?.nome || 'Não especificado'}
*Data:* ${dataVisita}
*Horário:* ${horarioVisita}

⏰ *Você tem ${settings.timeout_minutes || 15} minutos para responder.*

➡️ *Como responder:*
✅ Digite *SIM* para aceitar esta visita
❌ Digite *NÃO* para recusar

_Aguardamos sua resposta!_`;

      console.log('Usando mensagem de fallback');
    } else {
      message = templateResult.rendered_content;
      console.log('Template renderizado com sucesso:', templateResult.template_name);
    }
  } catch (error) {
    console.error('Erro ao chamar template-renderer:', error);
    // Fallback para mensagem padrão
    message = `🏠 *NOVA OPORTUNIDADE DE VISITA*

*Cliente:* ${visita.lead.nome}
*Telefone:* ${visita.lead.telefone}
${visita.lead.email ? `*E-mail:* ${visita.lead.email}` : ''}
*Empreendimento:* ${visita.empreendimento?.nome || 'Não especificado'}
*Data:* ${dataVisita}
*Horário:* ${horarioVisita}

⏰ *Você tem ${settings.timeout_minutes || 15} minutos para responder.*

➡️ *Como responder:*
✅ Digite *SIM* para aceitar esta visita
❌ Digite *NÃO* para recusar

_Aguardamos sua resposta!_`;
  }

  // Usar whatsapp ou telefone como fallback - normalizar para Evolution API
  const rawPhoneNumber = corretor.whatsapp || corretor.telefone;
  const phoneNumber = normalizePhoneNumber(rawPhoneNumber);

  console.log(`Enviando WhatsApp para: ${phoneNumber} (original: ${rawPhoneNumber})`);
  console.log(`Corretor: ${corretor.profiles?.first_name || 'Unknown'} ${corretor.profiles?.last_name || ''}`);

  // Fase 3: Verificar se o número existe no WhatsApp antes de enviar
  console.log(`🔍 Verificando número WhatsApp: ${phoneNumber}`);

  try {
    const { data: checkResult, error: checkError } = await supabase.functions.invoke(
      'evolution-check-number',
      {
        body: { phone_number: phoneNumber }
      }
    );

    if (checkError || !checkResult?.success || !checkResult?.exists) {
      console.error(`❌ Número não existe no WhatsApp: ${phoneNumber}`, checkError);

      // Registrar erro no communication_log
      await supabase.from('communication_log').insert({
        type: 'whatsapp',
        direction: 'enviado',
        phone_number: phoneNumber,
        content: 'Verificação de número falhou',
        status: 'failed',
        corretor_id: corretor.id,
        metadata: {
          error: 'number_not_on_whatsapp',
          check_error: checkError?.message,
          visita_id: visita.id
        }
      });

      // Marcar tentativa como falhada
      await supabase
        .from('visit_distribution_attempts')
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

  try {
    // FASE 2: Envio de mensagem via evolution-send-whatsapp-v2 (APENAS TEXTO)
    console.log('🔄 Invocando evolution-send-whatsapp-v2...');
    console.log('Payload:', {
      phone_number: phoneNumber,
      message: message,
      lead_id: visita.lead.id,
      corretor_id: corretor.id
    });

    const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke(
      'evolution-send-whatsapp-v2',
      {
        body: {
          phone_number: phoneNumber,
          message: message,
          lead_id: visita.lead.id,
          corretor_id: corretor.id
        }
      }
    );

    if (whatsappError) {
      console.error('❌ Erro retornado por evolution-send-whatsapp-v2:', whatsappError);
      throw whatsappError;
    }

    console.log('✅ Mensagem enviada com sucesso via evolution-send-whatsapp-v2');
    console.log('Resultado completo:', JSON.stringify(whatsappResult, null, 2));

    // Atualizar tentativa com ID da mensagem
    // Evolution API V2 retorna: result.key.id
    const messageId = whatsappResult?.result?.key?.id || whatsappResult?.messageId || whatsappResult?.message_id;
    console.log('Message ID extraído:', messageId);

    await supabase
      .from('visit_distribution_attempts')
      .update({
        whatsapp_message_id: messageId
      })
      .eq('id', attempt.id);

    console.log(`✅ Tentativa ${attemptOrder} registrada com sucesso`);

  } catch (error) {
    console.error('❌ ERRO CRÍTICO ao enviar mensagem WhatsApp:', error);
    console.error('Detalhes do erro:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // FASE 2: Logging robusto - registrar erro detalhado em communication_log
    try {
      await supabase
        .from('communication_log')
        .insert({
          phone_number: phoneNumber,
          content: `[ERRO] ${message}`,
          direction: 'enviado',
          type: 'whatsapp',
          status: 'failed',
          lead_id: visita.lead.id,
          corretor_id: corretor.id,
          metadata: {
            error: error.message,
            error_stack: error.stack,
            attempt_order: attemptOrder,
            visita_id: visitaId,
            timestamp: new Date().toISOString()
          }
        });
      console.log('📝 Erro registrado em communication_log');
    } catch (logError) {
      console.error('❌ Erro ao registrar em communication_log:', logError);
    }

    // Marcar tentativa como erro
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

async function notifyAdmin(supabase: any, visita: any, reason: string) {
  console.log('Notificando administrador:', reason);

  try {
    // Buscar WhatsApp do admin
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

    // Renderizar mensagem usando template
    let adminMessage = '';
    try {
      const { data: templateResult, error: templateError } = await supabase.functions.invoke(
        'template-renderer',
        {
          body: {
            category: 'admin_notification',
            type: 'whatsapp',
            variables: {
              visita_id: visita.id,
              nome_lead: visita.lead.nome,
              empreendimento_nome: visita.empreendimento?.nome || 'Não especificado',
              data_visita: dataVisita,
              horario_visita: visita.horario_visita,
              motivo_falha: reason
            },
            previewMode: false
          }
        }
      );

      if (templateError || !templateResult?.rendered_content) {
        console.error('Erro ao renderizar template admin:', templateError);
        // Fallback para mensagem padrão
        adminMessage = `🚨 *ATENÇÃO: FALHA NA DISTRIBUIÇÃO AUTOMÁTICA*

*Visita ID:* ${visita.id}
*Cliente:* ${visita.lead.nome}
*Telefone:* ${visita.lead.telefone}
*Empreendimento:* ${visita.empreendimento?.nome || 'Não especificado'}
*Data:* ${dataVisita}
*Horário:* ${visita.horario_visita}

*Motivo da Falha:* ${reason}

⚠️ *Ação necessária:* É preciso atribuir manualmente um corretor para esta visita.`;
      } else {
        adminMessage = templateResult.rendered_content;
        console.log('Template admin renderizado com sucesso');
      }
    } catch (error) {
      console.error('Erro ao chamar template-renderer para admin:', error);
      // Fallback
      adminMessage = `🚨 *ATENÇÃO: FALHA NA DISTRIBUIÇÃO AUTOMÁTICA*

*Visita ID:* ${visita.id}
*Cliente:* ${visita.lead.nome}
*Telefone:* ${visita.lead.telefone}
*Empreendimento:* ${visita.empreendimento?.nome || 'Não especificado'}
*Data:* ${dataVisita}
*Horário:* ${visita.horario_visita}

*Motivo da Falha:* ${reason}

⚠️ *Ação necessária:* É preciso atribuir manualmente um corretor para esta visita.`;
    }

    const { data: adminResult, error: adminError } = await supabase.functions.invoke('enhanced-whatsapp-sender', {
      body: {
        phone_number: adminSettings.value,
        message: adminMessage,
        lead_id: visita.lead.id,
        corretor_id: null
      }
    });

    if (adminError) {
      console.error('Erro ao enviar notificação ao admin:', adminError);
      throw adminError;
    }

    console.log('Administrador notificado com sucesso:', adminResult);

  } catch (error) {
    console.error('Erro ao notificar administrador:', error);
  }
}
