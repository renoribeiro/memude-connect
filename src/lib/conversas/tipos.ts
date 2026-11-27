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
  // Selos da identidade MeMude: 11 px, 800, pílula sem borda; roxo para o andamento, rosa para visita/proposta
  { valor: 'novo', rotulo: 'Novo', cor: 'bg-mm-lilas text-primary', ponto: 'bg-mm-campo' },
  { valor: 'em_atendimento', rotulo: 'Em atendimento', cor: 'bg-mm-lilas text-primary', ponto: 'bg-primary' },
  { valor: 'visita_marcada', rotulo: 'Visita agendada', cor: 'bg-mm-rosa-claro text-mm-rosa-texto', ponto: 'bg-mm-rosa' },
  { valor: 'visitou', rotulo: 'Visita realizada', cor: 'bg-mm-rosa-claro text-mm-rosa-texto', ponto: 'bg-mm-rosa-texto' },
  { valor: 'proposta', rotulo: 'Proposta', cor: 'bg-mm-acao text-white', ponto: 'bg-mm-acao' },
  { valor: 'documentacao', rotulo: 'Documentação', cor: 'bg-mm-alerta-fundo text-mm-alerta', ponto: 'bg-mm-alerta' },
  { valor: 'vendido', rotulo: 'Vendido', cor: 'bg-mm-sucesso-fundo text-mm-sucesso', ponto: 'bg-mm-sucesso' },
  { valor: 'perdido', rotulo: 'Perdido', cor: 'bg-muted text-muted-foreground', ponto: 'bg-mm-divisor' },
];
export const ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.valor, e])) as Record<Etapa, (typeof ETAPAS)[number]>;

export const TEMPERATURA: Record<string, { rotulo: string; cor: string; emoji: string }> = {
  quente: { rotulo: 'Quente', cor: 'text-mm-rosa-texto', emoji: '🔥' },
  morno: { rotulo: 'Morno', cor: 'text-mm-alerta', emoji: '🌤️' },
  frio: { rotulo: 'Frio', cor: 'text-primary', emoji: '❄️' },
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
  confirmar_ia: { rotulo: 'Confirme o que a IA entendeu', tom: 'aviso' },
  pedido_ajuda: { rotulo: 'Corretor pediu ajuda', tom: 'perigo' },
};

/** Mensagem que ainda não voltou do servidor (envio otimista). */
export interface MensagemLocal extends Mensagem { local?: true; previaUrl?: string; arquivo?: File }
