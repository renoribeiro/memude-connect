
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { normalizePhoneNumber } from '../_shared/phoneHelpers.ts';
import { logStructured } from '../_shared/structuredLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DistributeVisitRequest {
  visita_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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

    let body;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error('Invalid JSON payload');
    }
    const { visita_id }: DistributeVisitRequest = body;

    if (!visita_id) {
      throw new Error('visita_id é obrigatório');
    }

    console.log(`Iniciando distribuição automática para visita ${visita_id}`);

    // FASE 4: Verificar status do webhook antes da distribuição
    const { data: webhookSettings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['evolution_webhook_enabled', 'evolution_webhook_url']);

    const webhookMap = new Map(webhookSettings?.map((s: any) => [s.key, s.value]) || []);
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
          empreendimento_id,
          observacoes
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
      fallback_to_admin: true,
      // Default weights if not present in DB
      construtora_weight: 1000,
      bairro_weight: 500,
      tipo_imovel_weight: 200,
      nota_weight: 20, // Multiplier for 0-5 stars -> 0-100 points
      visitas_weight: 50 // Penalty base
    };

    if (!distributionSettings.auto_distribution_enabled) {
      throw new Error('Distribuição automática está desabilitada');
    }

    // Buscar corretores elegíveis
    const eligibleCorretores = await getEligibleCorretores(supabase, visita, distributionSettings);

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
    console.log('🧹 Verificando e limpando distribuições anteriores...');

    const { data: previousQueues } = await supabase
      .from('visit_distribution_queue')
      .select('id')
      .eq('visita_id', visita_id);

    if (previousQueues && previousQueues.length > 0) {
      const queueIds = previousQueues.map((q: { id: string }) => q.id);
      console.log(`📋 Encontradas ${queueIds.length} filas anteriores para limpar`);

      const { error: attemptDeleteError } = await supabase
        .from('visit_distribution_attempts')
        .delete()
        .eq('visita_id', visita_id);

      if (attemptDeleteError) {
        console.warn('⚠️ Erro ao deletar tentativas anteriores:', attemptDeleteError);
      } else {
        console.log('✅ Tentativas anteriores deletadas');
      }

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
      queueEntry.id
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

  } catch (error: any) {
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

async function getEligibleCorretores(supabase: any, visita: any, settings: any) {
  console.log('Buscando corretores elegíveis...');
  console.log('Dados da visita para matching:', {
    empreendimento_id: visita.empreendimento?.id,
    construtora_id: visita.empreendimento?.construtora_id,
    bairro_id: visita.empreendimento?.bairro_id,
    tipo_imovel: visita.empreendimento?.tipo_imovel
  });

  // Extract weights from settings or use defaults (aligned with distribute-lead keys)
  const W_CONSTRUTORA = settings.score_match_construtora ?? settings.construtora_weight ?? 1000;
  const W_BAIRRO = settings.score_match_bairro ?? settings.bairro_weight ?? 500;
  const W_TIPO_IMOVEL = settings.score_match_tipo_imovel ?? settings.tipo_imovel_weight ?? 200;
  const W_NOTA = settings.score_nota_multiplier ?? settings.nota_weight ?? 20;
  const W_VISITAS_PENALTY = settings.score_visitas_multiplier ?? settings.visitas_weight ?? 50;

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
  console.log(`Pesos utilizados: Construtora=${W_CONSTRUTORA}, Bairro=${W_BAIRRO}, Tipo=${W_TIPO_IMOVEL}, Nota=${W_NOTA}, VisitaBonus=${W_VISITAS_PENALTY}`);

  const corretoresWithScore: any[] = [];

  for (const corretor of corretores) {
    let score = 0;
    const matchDetails: string[] = [];

    // 1ª PRIORIDADE: Construtora
    if (visita.empreendimento?.construtora_id) {
      const hasConstrutorMatch = corretor.corretor_construtoras?.some(
        (cc: any) => cc.construtora_id === visita.empreendimento.construtora_id
      );

      if (hasConstrutorMatch) {
        score += W_CONSTRUTORA;
        matchDetails.push('Construtora Match');
      }
    }

    // 2ª PRIORIDADE: Bairro
    if (visita.empreendimento?.bairro_id) {
      const hasBairroMatch = corretor.corretor_bairros?.some(
        (cb: any) => cb.bairro_id === visita.empreendimento.bairro_id
      );

      if (hasBairroMatch) {
        score += W_BAIRRO;
        matchDetails.push('Bairro Match');
      }
    }

    // 3ª PRIORIDADE: Tipo de Imóvel
    if (visita.empreendimento?.tipo_imovel) {
      const tipoImovelMatch =
        corretor.tipo_imovel === 'todos' ||
        corretor.tipo_imovel === visita.empreendimento.tipo_imovel;

      if (tipoImovelMatch) {
        score += W_TIPO_IMOVEL;
        matchDetails.push('Tipo Imóvel Match');
      }
    }

    // 4ª PRIORIDADE: Nota do Corretor
    const notaScore = Math.round((corretor.nota_media || 0) * W_NOTA);
    score += notaScore;
    if (notaScore > 0) {
      matchDetails.push(`Nota: ${corretor.nota_media?.toFixed(1)}`);
    }

    // 5ª PRIORIDADE: Menor número de visitas (Penalidade/Bônus invertido)
    // Quanto menos visitas, mais pontos (até o limite do peso definido)
    const visitasPenalty = Math.min(corretor.total_visitas || 0, W_VISITAS_PENALTY);
    const visitasScore = W_VISITAS_PENALTY - visitasPenalty;
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

  return corretoresWithWhatsApp;
}

async function sendDistributionMessage(
  supabase: any,
  visitaId: string,
  corretor: any,
  visita: any,
  settings: any,
  attemptOrder: number,
  queueId: string
) {
  console.log(`Enviando mensagem para corretor ${corretor.id}, tentativa ${attemptOrder}`);

  const timeoutAt = new Date();
  timeoutAt.setMinutes(timeoutAt.getMinutes() + (settings.timeout_minutes || 15));

  const dataVisita = new Date(visita.data_visita).toLocaleDateString('pt-BR');
  const horarioVisita = visita.horario_visita;

  const { data: attempt, error: attemptError } = await supabase
    .from('visit_distribution_attempts')
    .insert({
      visita_id: visitaId,
      corretor_id: corretor.id,
      attempt_order: attemptOrder,
      timeout_at: timeoutAt.toISOString(),
      status: 'pending',
      queue_id: queueId
    })
    .select()
    .single();

  if (attemptError) {
    console.error('Erro ao registrar tentativa:', attemptError);
    throw attemptError;
  }

  let bairroNome = 'Não especificado';
  if (visita.empreendimento?.bairro_id) {
    const { data: bairro } = await supabase
      .from('bairros')
      .select('nome')
      .eq('id', visita.empreendimento.bairro_id)
      .single();
    if (bairro) bairroNome = bairro.nome;
  }

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
      message = getFallbackMessage(visita, dataVisita, horarioVisita, settings);
      console.log('Usando mensagem de fallback');
    } else {
      message = templateResult.rendered_content;
      console.log('Template renderizado com sucesso:', templateResult.template_name);
    }
  } catch (error) {
    console.error('Erro ao chamar template-renderer:', error);
    message = getFallbackMessage(visita, dataVisita, horarioVisita, settings);
  }

  const rawPhoneNumber = corretor.whatsapp || corretor.telefone;
  const phoneNumber = normalizePhoneNumber(rawPhoneNumber);

  console.log(`Enviando WhatsApp para: ${phoneNumber} (original: ${rawPhoneNumber})`);

  try {
    const { data: checkResult, error: checkError } = await supabase.functions.invoke(
      'evolution-check-number',
      {
        body: { phone_number: phoneNumber }
      }
    );

    if (checkError || !checkResult?.success || !checkResult?.exists) {
      console.error(`❌ Número não existe no WhatsApp: ${phoneNumber}`, checkError);

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
  }

  try {
    console.log('🔄 Invocando evolution-send-whatsapp-v2...');
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

    console.log('✅ Mensagem enviada com sucesso');

    const messageId = whatsappResult?.result?.key?.id || whatsappResult?.messageId || whatsappResult?.message_id;

    await supabase
      .from('visit_distribution_attempts')
      .update({
        whatsapp_message_id: messageId
      })
      .eq('id', attempt.id);

    console.log(`✅ Tentativa ${attemptOrder} registrada com sucesso`);

  } catch (error: any) {
    console.error('❌ ERRO CRÍTICO ao enviar mensagem WhatsApp:', error);

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
            attempt_order: attemptOrder,
            visita_id: visitaId,
            timestamp: new Date().toISOString()
          }
        });
    } catch (logError) {
      console.error('❌ Erro ao registrar em communication_log:', logError);
    }

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

function getFallbackMessage(visita: any, dataVisita: string, horarioVisita: string, settings: any) {
  return `🏠 *NOVA OPORTUNIDADE DE VISITA*

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

async function notifyAdmin(supabase: any, visita: any, reason: string) {
  console.log('Notificando administrador:', reason);

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
    const adminMessage = `🚨 *ATENÇÃO: FALHA NA DISTRIBUIÇÃO AUTOMÁTICA*

*Visita ID:* ${visita.id}
*Cliente:* ${visita.lead.nome}
*Motivo:* ${reason}
*Empreendimento:* ${visita.empreendimento?.nome || 'Não especificado'}
*Data:* ${dataVisita}

Acesse o painel para atribuir manualmente.`;

    const rawPhoneNumber = adminSettings.value;
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber);

    await supabase.functions.invoke('evolution-send-whatsapp-v2', {
      body: {
        phone_number: phoneNumber,
        message: adminMessage
      }
    });

  } catch (error) {
    console.error('Erro ao notificar admin:', error);
  }
}
