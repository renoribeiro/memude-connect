// Only an accepted assignment is a public confirmation; reminders stay private.
export function canSendVisitGroupConfirmation(item: any, event: any, snapshot: any): boolean {
  const { visit, cycle } = snapshot;
  return event.kind === 'match_accepted' && item.revision === cycle.revision
    && cycle.match_status === 'accepted' && cycle.outcome === 'pending'
    && !visit.deleted_at && event.payload?.broker_id === visit.corretor_id;
}

export function visitGroupConfirmation(snapshot: any): string {
  const { visit: v } = snapshot;
  const broker = [v.broker?.profiles?.first_name, v.broker?.profiles?.last_name].filter(Boolean).join(' ');
  return [
    '✅ *VISITA CONFIRMADA*',
    `Código: ${v.visit_code || v.id}`,
    '',
    `Cliente: ${v.lead?.nome || 'Não informado'}`,
    `WhatsApp do cliente: ${v.lead?.telefone || 'Não informado'}`,
    `Empreendimento: ${v.property?.nome || 'Não informado'}`,
    `Data: ${String(v.data_visita).split('-').reverse().join('/')} às ${String(v.horario_visita).slice(0, 5)}`,
    `Local de encontro: ${v.meeting_address || v.property?.endereco || 'A confirmar'}`,
    `Bairro: ${v.meeting_neighborhood || v.property?.bairro?.nome || 'Não informado'}`,
    '',
    `Corretor responsável: ${broker || 'Não informado'}`,
    `WhatsApp do corretor: ${v.broker?.whatsapp || v.broker?.telefone || 'Não informado'}`,
    `CRECI: ${v.broker?.creci || 'Não informado'}`,
    `Perfil do cliente: ${v.customer_profile || v.lead?.observacoes || 'Não informado'}`,
    '',
    'Acompanhamento: https://core.memudecore.com.br/visitas',
  ].join('\n');
}
