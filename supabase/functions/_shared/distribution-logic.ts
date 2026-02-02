import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizePhoneNumber } from './phoneHelpers.ts';

// Definição de tipos para clareza
export interface DistributionResult {
  processed: boolean;
  action: 'accepted' | 'rejected' | 'clarification' | 'none';
  type: 'visit' | 'lead';
  id?: string;
  error?: string;
}

export interface ProcessingResponse {
  type: 'accepted' | 'rejected' | 'unclear';
  confidence: number;
}

export async function processIncomingMessage(
  supabase: SupabaseClient,
  phoneNumber: string,
  messageText: string,
  senderName: string = ''
): Promise<DistributionResult> {
  console.log(`🧠 CORE LOGIC: Processando mensagem de ${phoneNumber}: "${messageText}"`);

  // 1. Normalizar resposta
  const response = analyzeResponse(messageText);
  console.log('🧠 CORE LOGIC: Intenção detectada:', response);

  if (response.type === 'unclear') {
    // Se não for SIM/NÃO claro, verificamos se há contexto pendente antes de responder
    // Para não responder a qualquer "Bom dia"
    const hasPending = await checkPendingAttempts(supabase, phoneNumber);
    if (hasPending) {
      // Enviar clarificação apenas se houver algo pendente
      return { processed: true, action: 'clarification', type: 'visit' }; // Tipo genérico
    }
    return { processed: false, action: 'none', type: 'visit' };
  }

  // 2. Processar Visitas (Prioridade)
  const visitResult = await handleVisitAttempt(supabase, phoneNumber, response, messageText);
  if (visitResult.processed) return visitResult;

  // 3. Processar Leads (Fallback)
  const leadResult = await handleLeadAttempt(supabase, phoneNumber, response, messageText);

  if (leadResult.processed) return leadResult;

  // 4. Processar Confirmação de Visita (Lead respondendo Lembrete)
  const confirmationResult = await handleLeadConfirmation(supabase, phoneNumber, response, messageText);
  if (confirmationResult.processed) return confirmationResult;

  return { processed: false, action: 'none', type: 'visit' };
}

// --- Funções Auxiliares de Análise ---

function analyzeResponse(message: string): ProcessingResponse {
  const text = message.toLowerCase().trim();

  // Lista expandida de palavras-chave
  const acceptWords = ['sim', 's', 'yes', 'y', 'aceito', 'quero', 'vou', 'posso', 'ok', 'pode', 'confirmo', 'topo', 'confirmado', 'agendar'];
  const rejectWords = ['não', 'nao', 'n', 'no', 'recuso', 'negativo', 'impossível', 'impossivel', 'ocupado', 'nem', 'jamais', 'cancelar'];

  // Verificar correspondência exata ou parcial forte
  if (acceptWords.includes(text)) return { type: 'accepted', confidence: 10 };
  if (rejectWords.includes(text)) return { type: 'rejected', confidence: 10 };

  const acceptScore = acceptWords.reduce((score, word) => text.includes(word) ? score + 1 : score, 0);
  const rejectScore = rejectWords.reduce((score, word) => text.includes(word) ? score + 1 : score, 0);

  if (acceptScore > rejectScore && acceptScore > 0) return { type: 'accepted', confidence: acceptScore };
  else if (rejectScore > acceptScore && rejectScore > 0) return { type: 'rejected', confidence: rejectScore };

  return { type: 'unclear', confidence: 0 };
}

async function checkPendingAttempts(supabase: SupabaseClient, phoneNumber: string) {
  // Busca corretor usando busca flexível por telefone
  const corretor = await findCorretorByPhone(supabase, phoneNumber);
  if (!corretor) return false;

  const { count: visits } = await supabase
    .from('visit_distribution_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('corretor_id', corretor.id)
    .eq('status', 'pending');

  if (visits && visits > 0) return true;

  const { count: leads } = await supabase
    .from('distribution_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('corretor_id', corretor.id)
    .eq('status', 'pending');

  return leads && leads > 0;
}

// --- Helper para busca flexível de corretor por telefone ---

/**
 * Gera variantes de um número para matching flexível
 * Considera que WhatsApp pode armazenar números brasileiros com ou sem o 9° dígito
 * Ex: 5585996227722 (com 9) e 558596227722 (sem 9)
 */
function generatePhoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const variants: string[] = [digits];

  // Se tem 13 dígitos (55 + DDD + 9XXXXXXXX), gerar variante sem o nono dígito
  if (digits.length === 13 && digits.startsWith('55') && digits[4] === '9') {
    // Remove o 9 após o DDD: 5585996227722 -> 558596227722
    const withoutNinth = digits.slice(0, 4) + digits.slice(5);
    variants.push(withoutNinth);
  }

  // Se tem 12 dígitos (55 + DDD + 8XXXXXXXX), gerar variante COM o nono dígito
  if (digits.length === 12 && digits.startsWith('55')) {
    // Adiciona o 9 após o DDD: 558596227722 -> 5585996227722
    const withNinth = digits.slice(0, 4) + '9' + digits.slice(4);
    variants.push(withNinth);
  }

  // Variantes com/sem o DDI 55
  if (digits.startsWith('55')) {
    variants.push(digits.slice(2)); // Sem o 55
  } else if (digits.length >= 10) {
    variants.push('55' + digits); // Com o 55
  }

  return [...new Set(variants)]; // Remove duplicatas
}

async function findCorretorByPhone(supabase: SupabaseClient, phoneNumber: string) {
  // Normalizar telefone para formato consistente
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const phoneVariants = generatePhoneVariants(phoneNumber);

  console.log(`🔍 Buscando corretor para ${phoneNumber}`);
  console.log(`📞 Variantes geradas: ${phoneVariants.join(', ')}`);

  // Tentar buscar pelo telefone normalizado primeiro
  let { data: corretor } = await supabase
    .from('corretores')
    .select('id, whatsapp')
    .eq('whatsapp', normalizedPhone)
    .maybeSingle();

  if (corretor) {
    console.log(`✅ Corretor encontrado pelo telefone normalizado: ${normalizedPhone}`);
    return corretor;
  }

  // Tentar por cada variante
  for (const variant of phoneVariants) {
    ({ data: corretor } = await supabase
      .from('corretores')
      .select('id, whatsapp')
      .eq('whatsapp', variant)
      .maybeSingle());

    if (corretor) {
      console.log(`✅ Corretor encontrado pela variante: ${variant}`);
      return corretor;
    }
  }

  // Buscar todos corretores e comparar com variantes
  const { data: allCorretores } = await supabase
    .from('corretores')
    .select('id, whatsapp')
    .not('whatsapp', 'is', null);

  if (allCorretores) {
    for (const c of allCorretores) {
      const dbPhoneVariants = generatePhoneVariants(c.whatsapp);

      // Verificar se alguma variante do DB match com alguma variante do input
      for (const inputVariant of phoneVariants) {
        for (const dbVariant of dbPhoneVariants) {
          if (inputVariant === dbVariant) {
            console.log(`✅ Corretor encontrado por matching flexível: ${c.whatsapp} <-> ${phoneNumber}`);
            return c;
          }
        }
      }
    }
  }

  console.log(`❌ Corretor não encontrado para telefone: ${phoneNumber} (variantes: ${phoneVariants.join(', ')})`);
  return null;
}

// --- Handlers Específicos ---

async function handleVisitAttempt(
  supabase: SupabaseClient,
  phoneNumber: string,
  response: ProcessingResponse,
  originalText: string
): Promise<DistributionResult> {
  // Buscar corretor com busca flexível por telefone
  const corretor = await findCorretorByPhone(supabase, phoneNumber);
  if (!corretor) {
    console.log(`❌ handleVisitAttempt: Corretor não encontrado para ${phoneNumber}`);
    return { processed: false, action: 'none', type: 'visit' };
  }

  console.log(`🔍 Buscando tentativa pendente para corretor ${corretor.id}...`);

  // Buscar tentativa pendente - Usando queue_id para join com visit_distribution_queue
  const { data: attempt, error: attemptError } = await supabase
    .from('visit_distribution_attempts')
    .select(`
      *,
      visit_distribution_queue:queue_id (id, status, current_attempt),
      visita:visitas!inner (
        id, data_visita, horario_visita,
        lead:leads!inner (id, nome, telefone),
        empreendimento:empreendimentos (nome, endereco)
      )
    `)
    .eq('corretor_id', corretor.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (attemptError) {
    console.error(`❌ Erro ao buscar tentativa pendente:`, attemptError);
    return { processed: false, action: 'none', type: 'visit', error: attemptError.message };
  }

  if (!attempt) {
    console.log(`⚠️ Nenhuma tentativa de visita pendente encontrada para corretor ${corretor.id}`);
    return { processed: false, action: 'none', type: 'visit' };
  }

  console.log(`🧠 CORE: Processando tentativa de visita ${attempt.id} - Ação: ${response.type}`);

  // Atualizar tentativa com a resposta
  await supabase
    .from('visit_distribution_attempts')
    .update({
      status: response.type === 'accepted' ? 'accepted' : 'rejected',
      response_type: response.type,
      response_message: originalText,
      response_received_at: new Date().toISOString()
    })
    .eq('id', attempt.id);

  if (response.type === 'accepted') {
    // 1. Aceitar
    await supabase.from('visitas').update({ corretor_id: corretor.id, status: 'confirmada' }).eq('id', attempt.visita.id);
    await supabase.from('leads').update({ corretor_designado_id: corretor.id, status: 'visita_agendada' }).eq('id', attempt.visita.lead.id);
    await supabase.from('visit_distribution_queue').update({ status: 'completed', assigned_corretor_id: corretor.id, completed_at: new Date().toISOString() }).eq('id', attempt.visit_distribution_queue.id);

    // Cancelar outros
    await supabase.from('visit_distribution_attempts').update({ status: 'timeout', response_type: 'cancelled' }).eq('visita_id', attempt.visita.id).eq('status', 'pending').neq('id', attempt.id);

    // 2. Notificar (Usando Unified Sender)
    await notifyVisitConfirmation(supabase, attempt, phoneNumber);

    return { processed: true, action: 'accepted', type: 'visit', id: attempt.visita.id };

  } else {
    // 1. Rejeitar
    const { data: settings } = await supabase.from('distribution_settings').select('*').single();
    const maxAttempts = settings?.max_attempts || 5;

    if (attempt.visit_distribution_queue.current_attempt >= maxAttempts) {
      await supabase.from('visit_distribution_queue').update({ status: 'failed', failure_reason: 'Todos rejeitaram' }).eq('id', attempt.visit_distribution_queue.id);
      // Notificar admin falha total (Implementar depois)
    } else {
      await supabase.from('visit_distribution_queue').update({ current_attempt: attempt.visit_distribution_queue.current_attempt + 1 }).eq('id', attempt.visit_distribution_queue.id);
      // Trigger próximo
      await supabase.functions.invoke('visit-distribution-timeout-checker');
    }

    // Agradecer resposta
    await sendWhatsappMessage(supabase, phoneNumber, "📝 Entendido. Obrigado pela resposta!");

    return { processed: true, action: 'rejected', type: 'visit', id: attempt.visita.id };
  }
}

async function handleLeadAttempt(
  supabase: SupabaseClient,
  phoneNumber: string,
  response: ProcessingResponse,
  originalText: string
): Promise<DistributionResult> {
  // Usar busca flexível por telefone (mesmo helper de visitas)
  const corretor = await findCorretorByPhone(supabase, phoneNumber);
  if (!corretor) {
    console.log(`❌ handleLeadAttempt: Corretor não encontrado para ${phoneNumber}`);
    return { processed: false, action: 'none', type: 'lead' };
  }

  const { data: attempt } = await supabase
    .from('distribution_attempts')
    .select(`*, lead:leads!inner(id, nome, telefone, empreendimento:empreendimentos(nome))`)
    .eq('corretor_id', corretor.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attempt) return { processed: false, action: 'none', type: 'lead' };

  // Update tentativa
  await supabase.from('distribution_attempts').update({
    status: response.type === 'accepted' ? 'accepted' : 'rejected',
    response_type: response.type,
    response_message: originalText,
    response_received_at: new Date().toISOString()
  }).eq('id', attempt.id);

  if (response.type === 'accepted') {
    await supabase.from('leads').update({ corretor_designado_id: corretor.id, status: 'em_contato' }).eq('id', attempt.lead.id);
    await supabase.from('distribution_queue').update({ status: 'completed', assigned_corretor_id: corretor.id }).eq('lead_id', attempt.lead.id);
    await supabase.from('distribution_attempts').update({ status: 'timeout' }).eq('lead_id', attempt.lead.id).eq('status', 'pending').neq('id', attempt.id);

    await sendWhatsappMessage(supabase, phoneNumber, `✅ *LEAD CONFIRMADO*\n\nLead: ${attempt.lead.nome}\nEmpreendimento: ${attempt.lead.empreendimento?.nome}`);

    return { processed: true, action: 'accepted', type: 'lead', id: attempt.lead.id };
  } else {
    // Rejection logic (simplified)
    await supabase.from('distribution_queue').update({ current_attempt: 99 }).eq('lead_id', attempt.lead.id); // Hack: force next check
    await supabase.functions.invoke('distribution-timeout-checker');
    await sendWhatsappMessage(supabase, phoneNumber, "📝 Entendido.");
    return { processed: true, action: 'rejected', type: 'lead', id: attempt.lead.id };
  }
}


async function handleLeadConfirmation(
  supabase: SupabaseClient,
  phoneNumber: string,
  response: ProcessingResponse,
  originalText: string
): Promise<DistributionResult> {
  const lead = await findLeadByPhone(supabase, phoneNumber);
  if (!lead) return { processed: false, action: 'none', type: 'visit' };

  // Buscar visita agendada (futura ou hoje)
  const today = new Date().toISOString().split('T')[0];
  const { data: visit } = await supabase
    .from('visitas')
    .select(`
      *,
      corretor:corretores!inner(id, whatsapp, profiles(first_name)),
      empreendimento:empreendimentos(nome, endereco)
    `)
    .eq('lead_id', lead.id)
    .gte('data_visita', today) // Visitas de hoje em diante
    .in('status', ['agendada', 'confirmada'])
    .order('data_visita', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!visit) {
    return { processed: false, action: 'none', type: 'visit' };
  }

  if (response.type === 'accepted') {
    // 1. Lead Confirmou
    console.log(`✅ Lead ${lead.nome} confirmou visita ${visit.id}`);

    // Avisar Corretor
    const msgCorretor = `🎉 *CLIENTE CONFIRMOU!*\n\nO cliente ${lead.nome} confirmou a presença na visita de ${new Date(visit.data_visita).toLocaleDateString('pt-BR')}!\n\nEmpreendimento: ${visit.empreendimento?.nome}`;
    await sendWhatsappMessage(supabase, visit.corretor.whatsapp, msgCorretor);

    // Avisar Lead
    await sendWhatsappMessage(supabase, phoneNumber, "✅ Combinado! Seu corretor aguarda você.");

    return { processed: true, action: 'accepted', type: 'visit', id: visit.id };
  }
  else if (response.type === 'rejected') {
    // 2. Lead Recusou/Cancelou
    console.log(`⚠️ Lead ${lead.nome} não confirmou visita ${visit.id}`);

    // Avisar Admin
    const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'admin_whatsapp').single();
    if (settings?.value) {
      await sendWhatsappMessage(supabase, settings.value, `⚠️ *VISITA NÃO CONFIRMADA PELO LEAD*\n\nLead: ${lead.nome}\nCorretor: ${visit.corretor.profiles.first_name}\nData: ${new Date(visit.data_visita).toLocaleDateString('pt-BR')}\nMotivo: Respondeu NÃO ao lembrete (confirmar interesse).`);
    }

    // Avisar Lead
    const msgLead = "Entendido. Um de nossos gestores entrará em contato.";
    await sendWhatsappMessage(supabase, phoneNumber, msgLead);

    return { processed: true, action: 'rejected', type: 'visit', id: visit.id };
  }

  return { processed: false, action: 'none', type: 'visit' };
}

async function findLeadByPhone(supabase: SupabaseClient, phoneNumber: string) {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const phoneVariants = generatePhoneVariants(phoneNumber);

  // Tentar buscar pelo telefone normalizado
  let { data: lead } = await supabase
    .from('leads')
    .select('id, nome, telefone')
    .eq('telefone', normalizedPhone)
    .maybeSingle();

  if (lead) return lead;

  // Variantes
  for (const variant of phoneVariants) {
    ({ data: lead } = await supabase
      .from('leads')
      .select('id, nome, telefone')
      .eq('telefone', variant)
      .maybeSingle());

    if (lead) return lead;
  }

  // Matching flexível DB (Scan? Leads pode ser grande, mas para corretores era ok. Para Leads talvez seja pesado? 
  // Mas vamos manter a consistência. Se Leads for gigante, isso precisará de refatoração futura com vetor ou FTS.)
  // Por enquanto, vamos limitar a busca por variantes diretas. Scan em Leads é perigoso se tiver milhares.
  // Corretores são poucos. Leads são muitos.
  // Vamos confiar nas variantes geradas.

  return null;
}

async function notifyVisitConfirmation(supabase: SupabaseClient, attempt: any, corretorPhone: string) {
  const dataVisita = new Date(attempt.visita.data_visita).toLocaleDateString('pt-BR');
  const endereco = attempt.visita.empreendimento?.endereco || 'Consulte o gestor';

  // 1. Corretor
  const msgCorretor = `✅ *VISITA AGENDADA COM SUCESSO*\n\nCliente: ${attempt.visita.lead.nome}\nTelefone: ${attempt.visita.lead.telefone}\nLocal: ${attempt.visita.empreendimento?.nome}\nEndereço: ${endereco}\nData: ${dataVisita} às ${attempt.visita.horario_visita}`;
  await sendWhatsappMessage(supabase, corretorPhone, msgCorretor);

  // 2. Cliente
  const msgCliente = `🎉 *VISITA CONFIRMADA!*\n\nSua visita ao *${attempt.visita.empreendimento?.nome}* está confirmada!\n\n📅 ${dataVisita} às ${attempt.visita.horario_visita}\n📍 ${endereco}\n\nSeu corretor será notificado.`;
  await sendWhatsappMessage(supabase, attempt.visita.lead.telefone, msgCliente);

  // 3. Admin
  const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'admin_whatsapp').single();
  if (settings?.value) {
    await sendWhatsappMessage(supabase, settings.value, `🚀 *VISITA CONFIRMADA*\n\nCorretor aceitou!\nLead: ${attempt.visita.lead.nome}\nLocal: ${attempt.visita.empreendimento?.nome}`);
  }
}

// Função de Envio Unificado (Abstração)
// Função de Envio Unificado (Abstração)
async function sendWhatsappMessage(supabase: SupabaseClient, phone: string, message: string) {
  console.log(`📤 Enviando mensagem para ${phone} via evolution-send-whatsapp-v2`);

  // TRACE START
  await supabase.from('webhook_logs').insert({
    event_type: 'DEBUG_SEND_START',
    payload: { phone, message_preview: message?.substring(0, 50) || 'empty' }
  });

  const { error } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
    body: {
      phone_number: phone,
      message: message
    }
  });

  if (error) {
    console.error(`❌ Erro ao enviar mensagem para ${phone} via v2:`, error);
    // TRACE ERROR
    await supabase.from('webhook_logs').insert({
      event_type: 'DEBUG_SEND_ERROR',
      payload: { phone, error }
    });
  } else {
    // TRACE SUCCESS (INVOKE)
    await supabase.from('webhook_logs').insert({
      event_type: 'DEBUG_SEND_INVOKE_OK',
      payload: { phone }
    });
  }
}
