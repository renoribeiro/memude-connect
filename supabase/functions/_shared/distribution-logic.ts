import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Definição de tipos para clareza
interface DistributionResult {
  processed: boolean;
  action: 'accepted' | 'rejected' | 'clarification' | 'none';
  type: 'visit' | 'lead';
  id?: string;
  error?: string;
}

export async function processIncomingMessage(
  supabase: any,
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

  return { processed: false, action: 'none', type: 'visit' };
}

// --- Funções Auxiliares de Análise ---

function analyzeResponse(message: string): { type: 'accepted' | 'rejected' | 'unclear', confidence: number } {
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

async function checkPendingAttempts(supabase: any, phoneNumber: string) {
    const { count } = await supabase
        .from('visit_distribution_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('corretor:corretores!inner(whatsapp)', phoneNumber); // Assumindo join correto ou filtro direto se tiver numero na tentativa
        
    // Como a tabela attempts liga a corretores pelo ID, precisamos de um join complexo ou buscar o ID do corretor antes.
    // Simplificando: buscamos o corretor pelo fone primeiro.
    
    const { data: corretor } = await supabase.from('corretores').select('id').eq('whatsapp', phoneNumber).single();
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

// --- Handlers Específicos ---

async function handleVisitAttempt(supabase: any, phoneNumber: string, response: any, originalText: string): Promise<DistributionResult> {
  // Buscar corretor
  const { data: corretor } = await supabase.from('corretores').select('id').eq('whatsapp', phoneNumber).single();
  if (!corretor) return { processed: false, action: 'none', type: 'visit' };

  // Buscar tentativa pendente
  const { data: attempt } = await supabase
    .from('visit_distribution_attempts')
    .select(`
      *,
      visit_distribution_queue!inner (id, status, current_attempt),
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

  if (!attempt) return { processed: false, action: 'none', type: 'visit' };

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
    // Verificar se deve tentar próximo ou falhar
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

async function handleLeadAttempt(supabase: any, phoneNumber: string, response: any, originalText: string): Promise<DistributionResult> {
    // Lógica similar para Leads (Copiada e adaptada do handler anterior)
    const { data: corretor } = await supabase.from('corretores').select('id').eq('whatsapp', phoneNumber).single();
    if (!corretor) return { processed: false, action: 'none', type: 'lead' };

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

// --- Notificações ---

async function notifyVisitConfirmation(supabase: any, attempt: any, corretorPhone: string) {
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
async function sendWhatsappMessage(supabase: any, phone: string, message: string) {
    // Aqui chamamos uma função única que decide qual API usar
    await supabase.functions.invoke('universal-whatsapp-sender', {
        body: { phone, message }
    });
}
