// Pure helpers shared by the worker, incoming webhook and regression tests.
export function visitPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  return !raw?.trim().startsWith('+') && (digits.length === 10 || digits.length === 11) ? `55${digits}` : digits;
}

export function parseVisitReply(text: string): { promptId: string; answer: string } | null {
  // Explicit reference is required even for text fallback: never consume a bare SIM or a rating.
  const match = text.trim().match(/^VISITA:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*[: ]\s*([\s\S]+)$/i);
  if (!match) return null;
  return { promptId: match[1].toLowerCase(), answer: match[2].trim().replace(/^não$/i, 'nao') };
}

export function visitPromptText(kind: string, audience: string, reference: string, context: string) {
  const prefix = `VISITA:${reference}`;
  const question = kind === 'attendance' ? 'Houve a visita?'
    : kind === 'reason' ? 'Qual foi o motivo de a visita não acontecer?'
    : kind === 'rating' ? 'De 0 a 10, qual sua nota para o atendimento do corretor?'
    : 'Você confirma sua presença na data e horário informados acima?';
  const binary = ['eve', 'h2', 'attendance'].includes(kind);
  const instructions = binary
    ? `Use um botão abaixo ou responda copiando uma das opções:\n${prefix}:sim\n${prefix}:nao`
    : `Responda citando esta mensagem ${kind === 'rating' ? 'com uma nota de 0 a 10' : 'com o motivo'}. Ou copie a referência:\n${prefix}: ${kind === 'rating' ? 'sua nota' : 'seu motivo'}`;
  return { text: `${context}\n\n${question}\n\n${instructions}`, buttons: binary ? [
    { id: `${prefix}:sim`, displayText: 'Sim' }, { id: `${prefix}:nao`, displayText: 'Não' },
  ] : undefined };
}

export const visitEventLabels: Record<string, string> = {
  scheduled: 'Visita agendada', changed: 'Agendamento alterado', missing_broker: 'Visita sem corretor: designar responsável',
  client_confirmed: 'Cliente confirmou presença', broker_confirmed: 'Corretor confirmou presença',
  broker_declined: 'Corretor indisponível: Closer deve providenciar cobertura ou reagendamento',
  confirmation_overdue: 'Confirmação pendente: visita mantida, requer contato do Closer',
  attendance_overdue: 'Prazo de 2h excedido: corretor ainda não informou se houve visita',
  held: 'Visita realizada: Closer deve registrar feedback', not_held: 'Visita não realizada: recuperação pendente',
  cancelled: 'Visita cancelada: recuperação pendente', reason: 'Motivo recebido', rating: 'Avaliação do cliente recebida',
  feedback: 'Feedback registrado pelo Closer', withdrawn: 'Desistência registrada pelo Closer', rescheduled: 'Nova visita cadastrada; ciclo reiniciado',
  eve: 'Lembrete da véspera enviado', h2: 'Lembrete de 2h enviado', attendance: 'Pergunta de realização enviada',
};

export function sheetVisitRow(snapshot: any): Record<string, string | number | boolean> {
  const { visit: v, cycle: c } = snapshot;
  return {
    Nome: v.lead?.nome || '', Telefone: v.lead?.telefone || '', 'Data Visita': v.data_visita,
    Fonte: v.lead?.origem || '', Horário: v.horario_visita, Imóvel: v.property?.nome || '',
    Local: v.meeting_address || v.property?.endereco || '', Bairro: v.meeting_neighborhood || v.property?.bairro?.nome || '',
    perfil_cliente: v.customer_profile || '',
    Corretor: [v.broker?.profiles?.first_name, v.broker?.profiles?.last_name].filter(Boolean).join(' '),
    Feedback: v.feedback_corretor || '', Status: c.outcome === 'pending' ? 'Visita Agendada' : ({ held: 'Realizada', not_held: 'Não realizada', cancelled: 'Cancelada', rescheduled: 'Reagendada', withdrawn: 'Desistência' } as Record<string,string>)[c.outcome],
    id_visita: v.id, telefone_corretor_e164: visitPhone(v.broker?.whatsapp || v.broker?.telefone || ''),
    confirmacao_lead: c.client_confirmed === null ? 'Pendente' : c.client_confirmed ? 'Sim' : 'Não',
    confirmacao_corretor: c.broker_confirmed === null ? 'Pendente' : c.broker_confirmed ? 'Sim' : 'Não',
    nota_corretor_0_10: c.rating ?? '', motivo_nao_realizacao: c.reason || '',
    proximo_passo: c.feedback?.next_step || '', prazo_retorno: c.feedback?.return_at || '',
    objecoes: c.feedback?.objections || '', interesse: c.feedback?.interest === undefined ? '' : c.feedback.interest ? 'Sim' : 'Não',
    visita_anterior_id: c.previous_visita_id || '',
  };
}
