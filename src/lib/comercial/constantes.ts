export const FONTES = ['Google', 'Meta', 'Cadastro', 'Follow', 'Outros'] as const;
export type Fonte = (typeof FONTES)[number];

export const STATUS_ATENDIMENTO = [
  'NOVO', 'EM CONVERSA', 'INTERESSADO', 'VISITA AGENDADA', 'INVESTIDOR', 'CORRETOR', 'SEM RENDA', 'NÃO INTERESSADO',
] as const;
export type StatusAtendimento = (typeof STATUS_ATENDIMENTO)[number];

export const COR_STATUS_ATENDIMENTO: Record<string, string> = {
  'NOVO': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  'EM CONVERSA': 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  'INTERESSADO': 'bg-amber-50 text-amber-800 ring-amber-600/25',
  'VISITA AGENDADA': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'INVESTIDOR': 'bg-violet-50 text-violet-700 ring-violet-600/20',
  'CORRETOR': 'bg-slate-100 text-slate-700 ring-slate-500/20',
  'SEM RENDA': 'bg-orange-50 text-orange-700 ring-orange-600/20',
  'NÃO INTERESSADO': 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

export const STATUS_VISITA = [
  'aguardando_corretor', 'agendada', 'confirmada', 'realizada', 'no_show', 'reagendada', 'cancelada',
] as const;
export type StatusVisita = (typeof STATUS_VISITA)[number];

export const ROTULO_STATUS_VISITA: Record<string, string> = {
  aguardando_corretor: 'Aguardando corretor',
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  no_show: 'No-show',
  reagendada: 'Reagendada',
  cancelada: 'Cancelada',
};

// Cores por status (badge, ponto e bloco do calendário). Contraste AA sobre fundo branco.
export const COR_STATUS_VISITA: Record<string, { badge: string; ponto: string; bloco: string }> = {
  aguardando_corretor: { badge: 'bg-amber-50 text-amber-800 ring-amber-600/25', ponto: 'bg-amber-500', bloco: 'bg-amber-50 border-amber-400 text-amber-900' },
  agendada: { badge: 'bg-sky-50 text-sky-700 ring-sky-600/20', ponto: 'bg-sky-500', bloco: 'bg-sky-50 border-sky-500 text-sky-900' },
  confirmada: { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', ponto: 'bg-emerald-500', bloco: 'bg-emerald-50 border-emerald-500 text-emerald-900' },
  realizada: { badge: 'bg-teal-50 text-teal-800 ring-teal-700/20', ponto: 'bg-teal-700', bloco: 'bg-teal-50 border-teal-700 text-teal-900' },
  no_show: { badge: 'bg-rose-50 text-rose-700 ring-rose-600/20', ponto: 'bg-rose-500', bloco: 'bg-rose-50 border-rose-500 text-rose-900' },
  reagendada: { badge: 'bg-violet-50 text-violet-700 ring-violet-600/20', ponto: 'bg-violet-500', bloco: 'bg-violet-50 border-violet-400 text-violet-900 line-through decoration-violet-400/60' },
  cancelada: { badge: 'bg-slate-100 text-slate-600 ring-slate-500/20', ponto: 'bg-slate-400', bloco: 'bg-slate-50 border-slate-300 text-slate-500 line-through' },
};

export const STATUS_VISITA_ATIVOS: string[] = ['aguardando_corretor', 'agendada', 'confirmada'];

export const ROTULO_TAREFA: Record<string, string> = {
  aceite_corretor: 'Aceite do corretor',
  confirmacao_d2: 'Confirmação D-2',
  confirmacao_d1: 'Confirmação D-1',
  confirmacao_d0: 'Confirmação D0',
  registrar_resultado: 'Registrar resultado',
  retorno: 'Retorno pós-visita',
  proximo_passo: 'Próximo passo',
  remarcar_no_show: 'Remarcar no-show',
  escalada: 'Escalada pelo closer',
  manual: 'Tarefa',
};

export const TIPOS_LOCAL = ['Stand de vendas', 'Decorado', 'Plantão no empreendimento', 'Escritório da construtora'] as const;

export const MOTIVOS_CANCELAMENTO = [
  'Cliente desistiu da compra',
  'Cliente comprou outro imóvel',
  'Sem renda / crédito reprovado',
  'Mudança de planos',
  'Não responde mais',
] as const;
