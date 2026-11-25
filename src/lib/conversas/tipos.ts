import type { Database } from '@/integrations/supabase/types';

type Fn = Database['public']['Functions'];
type Tab = Database['public']['Tables'];

export type ConversaItem = Fn['conversas_listar']['Returns'][number];
export type Mensagem = Tab['mensagens']['Row'];
export type Sugestao = Tab['ia_sugestoes']['Row'];
export type Alerta = Tab['conv_alertas']['Row'];
export type Numero = Tab['conv_numeros']['Row'];
export type RespostaRapida = Tab['respostas_rapidas']['Row'];
export type ClienteCorretor = Fn['corretor_meus_clientes']['Returns'][number];
export type Convite = Fn['corretor_meus_convites']['Returns'][number];
export type Desempenho = Fn['conversas_desempenho']['Returns'][number];
export type AtividadeMinha = Fn['minhas_atividades']['Returns'][number];

export type Etapa = 'novo' | 'em_atendimento' | 'visita_marcada' | 'visitou' | 'proposta' | 'documentacao' | 'vendido' | 'perdido';

/** Etapas do funil da conversa (ordem do mini-kanban). */
export const ETAPAS: { valor: Etapa; rotulo: string; cor: string; ponto: string }[] = [
  { valor: 'novo', rotulo: 'Novo', cor: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900', ponto: 'bg-sky-500' },
  { valor: 'em_atendimento', rotulo: 'Em atendimento', cor: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900', ponto: 'bg-indigo-500' },
  { valor: 'visita_marcada', rotulo: 'Visita marcada', cor: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900', ponto: 'bg-violet-500' },
  { valor: 'visitou', rotulo: 'Visitou', cor: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-300 dark:ring-fuchsia-900', ponto: 'bg-fuchsia-500' },
  { valor: 'proposta', rotulo: 'Proposta', cor: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900', ponto: 'bg-amber-500' },
  { valor: 'documentacao', rotulo: 'Documentação', cor: 'bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-900', ponto: 'bg-orange-500' },
  { valor: 'vendido', rotulo: 'Vendido', cor: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900', ponto: 'bg-emerald-500' },
  { valor: 'perdido', rotulo: 'Perdido', cor: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800', ponto: 'bg-zinc-400' },
];
export const ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.valor, e])) as Record<Etapa, (typeof ETAPAS)[number]>;

export const TEMPERATURA: Record<string, { rotulo: string; cor: string; emoji: string }> = {
  quente: { rotulo: 'Quente', cor: 'text-rose-600 dark:text-rose-400', emoji: '🔥' },
  morno: { rotulo: 'Morno', cor: 'text-amber-600 dark:text-amber-400', emoji: '🌤️' },
  frio: { rotulo: 'Frio', cor: 'text-sky-600 dark:text-sky-400', emoji: '❄️' },
};

export const PAPEL_DONO: Record<string, string> = { sdr: 'SDR', corretor: 'Corretor', closer: 'Closer' };

export const FILTROS = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'minhas', rotulo: 'Minhas' },
  { valor: 'sem_resposta', rotulo: 'Aguardando' },
  { valor: 'sdr', rotulo: 'SDR' },
  { valor: 'corretores', rotulo: 'Corretores' },
  { valor: 'arquivadas', rotulo: 'Arquivadas' },
] as const;
export type Filtro = (typeof FILTROS)[number]['valor'];

export const TIPO_ALERTA: Record<string, { rotulo: string; tom: 'perigo' | 'aviso' | 'sucesso' }> = {
  sem_resposta: { rotulo: 'Sem resposta', tom: 'perigo' },
  pos_visita_esquecido: { rotulo: 'Esfriando', tom: 'aviso' },
  sinal_compra: { rotulo: 'Sinal de compra', tom: 'sucesso' },
  contato_pessoal: { rotulo: 'Contato pessoal', tom: 'perigo' },
  numero_caiu: { rotulo: 'Número caiu', tom: 'perigo' },
};

/** Mensagem que ainda não voltou do servidor (envio otimista). */
export interface MensagemLocal extends Mensagem { local?: true; previaUrl?: string }
