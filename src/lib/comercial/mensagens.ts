import { formatarData, formatarHora } from './datas';
import { linkWhatsApp } from './telefone';

export type Destino = 'cliente' | 'corretor' | 'grupo';
export type Momento = 'criacao' | 'aceite' | 'd2' | 'd1' | 'd0' | 'realizada' | 'no_show' | 'reagendada';

export interface TemplateMensagem {
  id: string;
  nome: string;
  conteudo: string;
  chave: string;
  momento: Momento;
  destino: Destino;
  quem: 'agendador' | 'closer';
  ordem: number;
}

export interface DadosMensagem {
  data: string;
  hora: string;
  localNome?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  empreendimento?: string | null;
  wpPostId?: number | null;
  siteUrl?: string;
  cliente?: string | null;
  perfil?: string | null;
  corretor?: string | null;
  origem?: string | null;
}

export const MOMENTOS: { chave: Momento; titulo: string; quem: string }[] = [
  { chave: 'criacao', titulo: 'Criação da visita', quem: 'Ramon' },
  { chave: 'aceite', titulo: 'Corretor aceitou', quem: 'Ramon' },
  { chave: 'd2', titulo: 'Lembrete D-2', quem: 'Ramon' },
  { chave: 'd1', titulo: 'Lembrete D-1', quem: 'Ramon' },
  { chave: 'd0', titulo: 'Dia da visita (D0)', quem: 'Lucas' },
  { chave: 'realizada', titulo: 'Visita realizada', quem: 'Lucas' },
  { chave: 'no_show', titulo: 'No-show', quem: 'Lucas' },
  { chave: 'reagendada', titulo: 'Visita reagendada', quem: 'Lucas' },
];

const vazio = (v?: string | null) => (v && v.trim() ? v.trim() : '—');

export function linkEmpreendimento(wpPostId?: number | null, siteUrl = 'https://memude.com.br'): string | null {
  return wpPostId ? `${siteUrl.replace(/\/$/, '')}/?p=${wpPostId}` : null;
}

/** [ENDEREÇO] leva o bairro junto, para que ele apareça nas mensagens (não há variável própria). */
export function enderecoCompleto(endereco?: string | null, bairro?: string | null): string {
  const e = endereco?.trim();
  const b = bairro?.trim();
  if (e && b && !e.toLowerCase().includes(b.toLowerCase())) return `${e} – ${b}`;
  return e || b || '';
}

export function variaveis(d: DadosMensagem): Record<string, string> {
  const endereco = enderecoCompleto(d.endereco, d.bairro);
  const local = [d.localNome?.trim(), endereco].filter(Boolean).join(' – ');
  return {
    '[DATA]': formatarData(d.data),
    '[HORÁRIO]': formatarHora(d.hora),
    '[LOCAL]': vazio(local),
    '[ENDEREÇO]': vazio(endereco),
    '[EMPREENDIMENTO]': vazio(d.empreendimento),
    '[LINK DO EMPREENDIMENTO]': vazio(linkEmpreendimento(d.wpPostId, d.siteUrl)),
    '[NOME DO CLIENTE]': vazio(d.cliente),
    '[PERFIL DO CLIENTE]': vazio(d.perfil),
    '[NOME DO CORRETOR]': vazio(d.corretor),
    '[ORIGEM DO LEAD]': vazio(d.origem),
  };
}

export function renderizar(conteudo: string, d: DadosMensagem): string {
  const v = variaveis(d);
  return conteudo.replace(/\[[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]+\]/g, (m) => v[m] ?? m);
}

export function linkMensagem(destino: Destino, texto: string, telefones: { cliente?: string | null; corretor?: string | null }) {
  if (destino === 'grupo') return null;
  return linkWhatsApp(destino === 'cliente' ? telefones.cliente : telefones.corretor, texto);
}

export interface EstadoVisitaMensagens {
  status: string;
  corretorAceitou: boolean;
  tarefas: string[];
  temVisitaAnterior: boolean;
}

/** Quais momentos estão liberados para a visita, na ordem do ciclo. */
export function momentosLiberados(e: EstadoVisitaMensagens): Momento[] {
  if (e.status === 'cancelada') return [];
  const liberados: Momento[] = ['criacao'];
  const aceitou = e.corretorAceitou || ['agendada', 'confirmada', 'realizada', 'no_show'].includes(e.status);
  if (aceitou) liberados.push('aceite');
  if (e.tarefas.includes('confirmacao_d2')) liberados.push('d2');
  if (e.tarefas.includes('confirmacao_d1')) liberados.push('d1');
  if (aceitou && (e.tarefas.includes('confirmacao_d0') || ['realizada', 'no_show'].includes(e.status))) liberados.push('d0');
  if (e.status === 'realizada') liberados.push('realizada');
  if (e.status === 'no_show') liberados.push('no_show');
  if (e.temVisitaAnterior) liberados.push('reagendada');
  return liberados;
}

/** Momento em foco: o mais recente liberado. */
export function momentoAtual(liberados: Momento[]): Momento | null {
  return liberados.length ? liberados[liberados.length - 1] : null;
}
