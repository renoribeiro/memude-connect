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
  senderName: string = '',
  remoteJid: string = ''
): Promise<DistributionResult> {
  console.log(`🧠 CORE LOGIC: Processando mensagem de ${phoneNumber}: "${messageText}" (remoteJid: ${remoteJid})`);

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

  // 2. Processar Visitas (Prioridade — Distribuição SIM/NÃO do corretor)
  const visitResult = await handleVisitAttempt(supabase, phoneNumber, response, messageText);
  if (visitResult.processed) return visitResult;

  // 3. Processar Leads (Fallback — Distribuição de Leads)
  const leadResult = await handleLeadAttempt(supabase, phoneNumber, response, messageText);
  if (leadResult.processed) return leadResult;

  // 4. LID FALLBACK: Se nenhum handler processou E temos um LID no remoteJid
  const isLidMessage = remoteJid.includes('@lid');
  if (isLidMessage && (response.type === 'accepted' || response.type === 'rejected')) {
    console.log(`🔄 LID FALLBACK: Tentando encontrar tentativa pendente sem filtro de telefone...`);
    const lidFallbackResult = await handleVisitAttemptByLidFallback(supabase, phoneNumber, response, messageText, remoteJid);
    if (lidFallbackResult.processed) return lidFallbackResult;

    const lidLeadFallbackResult = await handleLeadAttemptByLidFallback(supabase, phoneNumber, response, messageText, remoteJid);
    if (lidLeadFallbackResult.processed) return lidLeadFallbackResult;
  }

  // 5. Processar Confirmação do Corretor ao Lembrete (SIM/NÃO antes da visita)
  const corretorConfirmResult = await handleCorretorReminderConfirmation(supabase, phoneNumber, response, messageText);
  if (corretorConfirmResult.processed) return corretorConfirmResult;

  // 6. Processar Confirmação do Lead ao Lembrete (SIM/NÃO antes da visita)
  const confirmationResult = await handleLeadConfirmation(supabase, phoneNumber, response, messageText);
  if (confirmationResult.processed) return confirmationResult;

  return { processed: false, action: 'none', type: 'visit' };
}

// --- Funções Auxiliares de Análise ---

function analyzeResponse(message: string): ProcessingResponse {
  const text = message.toLowerCase().trim();

  // Lista expandida de palavras-chave
  const acceptWords = ['sim', 's', 'yes', 'y', 'aceito', 'quero', 'vou', 'posso', 'ok', 'pode', 'confirmo', 'topo', 'confirmado', 'agendar', '1'];
  const rejectWords = ['não', 'nao', 'n', 'no', 'recuso', 'negativo', 'impossível', 'impossivel', 'ocupado', 'nem', 'jamais', 'cancelar', '2'];

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


async function handleCorretorReminderConfirmation(
  supabase: SupabaseClient,
  phoneNumber: string,
  response: ProcessingResponse,
  originalText: string
): Promise<DistributionResult> {
  // Buscar corretor com busca flexível
  const corretor = await findCorretorByPhone(supabase, phoneNumber);
  if (!corretor) return { processed: false, action: 'none', type: 'visit' };

  // Buscar visita agendada ou confirmada para este corretor (futura ou hoje)
  const today = new Date().toISOString().split('T')[0];
  const { data: visit } = await supabase
    .from('visitas')
    .select(`
      *,
      lead:leads!inner(id, nome, telefone),
      empreendimento:empreendimentos(nome, endereco)
    `)
    .eq('corretor_id', corretor.id)
    .gte('data_visita', today)
    .in('status', ['agendada', 'confirmada'])
    .is('corretor_confirmou', null)
    .order('data_visita', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!visit) {
    return { processed: false, action: 'none', type: 'visit' };
  }

  const dataVisita = new Date(visit.data_visita).toLocaleDateString('pt-BR');

  if (response.type === 'accepted') {
    console.log(`✅ Corretor ${corretor.id} confirmou presença na visita ${visit.id}`);

    // Atualizar visita
    const currentMeta = visit.confirmation_metadata || {};
    await supabase.from('visitas').update({
      corretor_confirmou: true,
      confirmation_metadata: {
        ...currentMeta,
        corretor_confirmed_at: new Date().toISOString(),
        corretor_response: originalText
      }
    }).eq('id', visit.id);

    // Notificar Lead
    await sendWhatsappMessage(supabase, visit.lead.telefone, `✅ *Boa notícia!*\n\nSeu corretor confirmou presença na visita de *${dataVisita}*!\n\n🏢 ${visit.empreendimento?.nome}\n🕒 ${visit.horario_visita}\n\nNos vemos lá! 🤝`);

    // Avisar Corretor
    await sendWhatsappMessage(supabase, phoneNumber, `✅ Presença confirmada! Aguardamos você na visita de ${dataVisita}.`);

    return { processed: true, action: 'accepted', type: 'visit', id: visit.id };

  } else if (response.type === 'rejected') {
    console.log(`⚠️ Corretor ${corretor.id} não pode comparecer à visita ${visit.id}`);

    // Atualizar visita
    const currentMeta = visit.confirmation_metadata || {};
    await supabase.from('visitas').update({
      corretor_confirmou: false,
      confirmation_metadata: {
        ...currentMeta,
        corretor_declined_at: new Date().toISOString(),
        corretor_response: originalText
      }
    }).eq('id', visit.id);

    // Notificar Admin
    const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'admin_whatsapp').single();
    if (settings?.value) {
      await sendWhatsappMessage(supabase, settings.value, `⚠️ *CORRETOR NÃO PODE COMPARECER*\n\nVisita: ${visit.id}\nCliente: ${visit.lead.nome}\nData: ${dataVisita}\nEmpreendimento: ${visit.empreendimento?.nome}\n\n❗ É necessário designar outro corretor ou reagendar.`);
    }

    // Notificar Lead
    await sendWhatsappMessage(supabase, visit.lead.telefone, `⚠️ Olá ${visit.lead.nome}, precisamos reagendar sua visita de ${dataVisita}. Um de nossos gestores entrará em contato em breve.`);

    // Avisar Corretor
    await sendWhatsappMessage(supabase, phoneNumber, `📝 Entendido. Notificamos a equipe para providenciar a cobertura.`);

    return { processed: true, action: 'rejected', type: 'visit', id: visit.id };
  }

  return { processed: false, action: 'none', type: 'visit' };
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
    .gte('data_visita', today)
    .in('status', ['agendada', 'confirmada'])
    .order('data_visita', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!visit) {
    return { processed: false, action: 'none', type: 'visit' };
  }

  const dataVisita = new Date(visit.data_visita).toLocaleDateString('pt-BR');

  if (response.type === 'accepted') {
    // Lead Confirmou — atualizar status da visita
    console.log(`✅ Lead ${lead.nome} confirmou visita ${visit.id}`);

    const currentMeta = visit.confirmation_metadata || {};
    await supabase.from('visitas').update({
      status: 'confirmada',
      lead_confirmou: true,
      confirmation_metadata: {
        ...currentMeta,
        lead_confirmed_at: new Date().toISOString(),
        lead_response: originalText
      }
    }).eq('id', visit.id);

    // Atualizar status do lead
    await supabase.from('leads').update({ status: 'visita_confirmada' }).eq('id', lead.id);

    // Avisar Corretor
    const msgCorretor = `🎉 *CLIENTE CONFIRMOU!*\n\nO cliente ${lead.nome} confirmou a presença na visita de ${dataVisita}!\n\nEmpreendimento: ${visit.empreendimento?.nome}\n🕒 ${visit.horario_visita}`;
    await sendWhatsappMessage(supabase, visit.corretor.whatsapp, msgCorretor);

    // Avisar Lead
    await sendWhatsappMessage(supabase, phoneNumber, `✅ Visita confirmada para ${dataVisita} às ${visit.horario_visita}!\n\nSeu corretor ${visit.corretor.profiles.first_name} aguarda você. 🤝`);

    return { processed: true, action: 'accepted', type: 'visit', id: visit.id };
  }
  else if (response.type === 'rejected') {
    // Lead Recusou — cancelar visita
    console.log(`⚠️ Lead ${lead.nome} cancelou visita ${visit.id}`);

    const currentMeta = visit.confirmation_metadata || {};
    await supabase.from('visitas').update({
      status: 'cancelada',
      lead_confirmou: false,
      confirmation_metadata: {
        ...currentMeta,
        lead_declined_at: new Date().toISOString(),
        lead_response: originalText
      }
    }).eq('id', visit.id);

    // Atualizar status do lead
    await supabase.from('leads').update({ status: 'cancelado' }).eq('id', lead.id);

    // Avisar Corretor
    const msgCorretor = `⚠️ *VISITA CANCELADA PELO CLIENTE*\n\nO cliente ${lead.nome} cancelou a visita de ${dataVisita}.\n\nEmpreendimento: ${visit.empreendimento?.nome}`;
    await sendWhatsappMessage(supabase, visit.corretor.whatsapp, msgCorretor);

    // Avisar Admin
    const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'admin_whatsapp').single();
    if (settings?.value) {
      await sendWhatsappMessage(supabase, settings.value, `⚠️ *VISITA CANCELADA PELO LEAD*\n\nLead: ${lead.nome}\nCorretor: ${visit.corretor.profiles.first_name}\nData: ${dataVisita}\nEmpreendimento: ${visit.empreendimento?.nome}\nMotivo: Respondeu NÃO ao lembrete.`);
    }

    // Avisar Lead
    await sendWhatsappMessage(supabase, phoneNumber, `Entendido, ${lead.nome}. A visita de ${dataVisita} foi cancelada. Um de nossos gestores entrará em contato caso queira reagendar.`);

    return { processed: true, action: 'rejected', type: 'visit', id: visit.id };
  }

  // Sem resposta clara = não faz nada, visita permanece ativa
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

  // 3. Admin (usa o telefone da empresa cadastrado em Configurações > Informações da Empresa)
  const { data: companyPhoneSetting } = await supabase.from('system_settings').select('value').eq('key', 'company_phone').maybeSingle();
  const adminPhone = companyPhoneSetting?.value;

  if (adminPhone) {
    const adminMsg = `🚀 *VISITA CONFIRMADA!*\n\n✅ O corretor aceitou a visita.\n\n👤 *Corretor:* ${corretorPhone}\n\n📋 *Lead:* ${attempt.visita.lead.nome}\n📱 *Telefone Lead:* ${attempt.visita.lead.telefone}\n\n🏗️ *Empreendimento:* ${attempt.visita.empreendimento?.nome}\n📍 *Endereço:* ${endereco}\n\n📅 *Data:* ${dataVisita}\n🕐 *Horário:* ${attempt.visita.horario_visita}`;
    await sendWhatsappMessage(supabase, adminPhone, adminMsg);
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

// =============================================
// LID FALLBACK FUNCTIONS
// When Evolution API V2 sends the instance phone instead of the
// real sender phone, we find ANY pending attempt and match it.
// Then we save the LID→phone mapping for future lookups.
// =============================================

async function saveLidMapping(supabase: SupabaseClient, remoteJid: string, realPhone: string) {
  const lid = remoteJid.replace('@lid', '').replace('@s.whatsapp.net', '');
  try {
    await supabase.from('lid_phone_map').upsert({
      lid,
      phone: realPhone,
      instance_name: 'avisosmemude',
      updated_at: new Date().toISOString()
    }, { onConflict: 'lid' });
    console.log(`🗺️ LID mapping saved: ${lid} → ${realPhone}`);
  } catch (e) {
    console.warn('⚠️ Failed to save LID mapping:', e);
  }
}

async function handleVisitAttemptByLidFallback(
  supabase: SupabaseClient,
  _phoneNumber: string,
  response: ProcessingResponse,
  originalText: string,
  remoteJid: string
): Promise<DistributionResult> {
  console.log(`🔄 LID FALLBACK (VISITA): Buscando QUALQUER tentativa pendente...`);

  // Find the single most recent pending visit attempt (regardless of corretor phone)
  const { data: attempt, error: attemptError } = await supabase
    .from('visit_distribution_attempts')
    .select(`
      *,
      visit_distribution_queue:queue_id (id, status, current_attempt),
      visita:visitas!inner (
        id, data_visita, horario_visita,
        lead:leads!inner (id, nome, telefone),
        empreendimento:empreendimentos (nome, endereco)
      ),
      corretor:corretores!inner (id, whatsapp)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (attemptError || !attempt) {
    console.log(`❌ LID FALLBACK: Nenhuma tentativa pendente encontrada`);
    return { processed: false, action: 'none', type: 'visit' };
  }

  console.log(`✅ LID FALLBACK: Encontrada tentativa ${attempt.id} para corretor ${attempt.corretor.whatsapp}`);

  // Save the LID mapping for future use
  await saveLidMapping(supabase, remoteJid, attempt.corretor.whatsapp);

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
    await supabase.from('visitas').update({ corretor_id: attempt.corretor.id, status: 'confirmada' }).eq('id', attempt.visita.id);
    await supabase.from('leads').update({ corretor_designado_id: attempt.corretor.id, status: 'visita_agendada' }).eq('id', attempt.visita.lead.id);
    await supabase.from('visit_distribution_queue').update({ status: 'completed', assigned_corretor_id: attempt.corretor.id, completed_at: new Date().toISOString() }).eq('id', attempt.visit_distribution_queue.id);

    // Cancelar outros
    await supabase.from('visit_distribution_attempts').update({ status: 'timeout', response_type: 'cancelled' }).eq('visita_id', attempt.visita.id).eq('status', 'pending').neq('id', attempt.id);

    // Notificações
    await notifyVisitConfirmation(supabase, attempt, attempt.corretor.whatsapp);

    return { processed: true, action: 'accepted', type: 'visit', id: attempt.visita.id };
  } else {
    const { data: settings } = await supabase.from('distribution_settings').select('*').single();
    const maxAttempts = settings?.max_attempts || 5;

    if (attempt.visit_distribution_queue.current_attempt >= maxAttempts) {
      await supabase.from('visit_distribution_queue').update({ status: 'failed', failure_reason: 'Todos rejeitaram' }).eq('id', attempt.visit_distribution_queue.id);
    } else {
      await supabase.from('visit_distribution_queue').update({ current_attempt: attempt.visit_distribution_queue.current_attempt + 1 }).eq('id', attempt.visit_distribution_queue.id);
      await supabase.functions.invoke('visit-distribution-timeout-checker');
    }

    await sendWhatsappMessage(supabase, attempt.corretor.whatsapp, "📝 Entendido. Obrigado pela resposta!");

    return { processed: true, action: 'rejected', type: 'visit', id: attempt.visita.id };
  }
}

async function handleLeadAttemptByLidFallback(
  supabase: SupabaseClient,
  _phoneNumber: string,
  response: ProcessingResponse,
  originalText: string,
  remoteJid: string
): Promise<DistributionResult> {
  console.log(`🔄 LID FALLBACK (LEAD): Buscando QUALQUER tentativa pendente...`);

  const { data: attempt } = await supabase
    .from('distribution_attempts')
    .select(`*, lead:leads!inner(id, nome, telefone, empreendimento:empreendimentos(nome)), corretor:corretores!inner(id, whatsapp)`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attempt) {
    console.log(`❌ LID FALLBACK (LEAD): Nenhuma tentativa pendente encontrada`);
    return { processed: false, action: 'none', type: 'lead' };
  }

  console.log(`✅ LID FALLBACK (LEAD): Encontrada tentativa ${attempt.id} para corretor ${attempt.corretor.whatsapp}`);

  // Save LID mapping
  await saveLidMapping(supabase, remoteJid, attempt.corretor.whatsapp);

  // Update attempt
  await supabase.from('distribution_attempts').update({
    status: response.type === 'accepted' ? 'accepted' : 'rejected',
    response_type: response.type,
    response_message: originalText,
    response_received_at: new Date().toISOString()
  }).eq('id', attempt.id);

  if (response.type === 'accepted') {
    await supabase.from('leads').update({ corretor_designado_id: attempt.corretor.id, status: 'em_contato' }).eq('id', attempt.lead.id);
    await supabase.from('distribution_queue').update({ status: 'completed', assigned_corretor_id: attempt.corretor.id }).eq('lead_id', attempt.lead.id);
    await supabase.from('distribution_attempts').update({ status: 'timeout' }).eq('lead_id', attempt.lead.id).eq('status', 'pending').neq('id', attempt.id);

    await sendWhatsappMessage(supabase, attempt.corretor.whatsapp, `✅ *LEAD CONFIRMADO*\n\nLead: ${attempt.lead.nome}\nEmpreendimento: ${attempt.lead.empreendimento?.nome}`);

    return { processed: true, action: 'accepted', type: 'lead', id: attempt.lead.id };
  } else {
    await supabase.from('distribution_queue').update({ current_attempt: 99 }).eq('lead_id', attempt.lead.id);
    await supabase.functions.invoke('distribution-timeout-checker');
    await sendWhatsappMessage(supabase, attempt.corretor.whatsapp, "📝 Entendido.");
    return { processed: true, action: 'rejected', type: 'lead', id: attempt.lead.id };
  }
}

