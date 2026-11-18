import { hojeISO } from './datas';

export interface Mes { chave: string; rotulo: string; rotuloLongo: string; de: string; ate: string }

const NOMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Mês "AAAA-MM" com primeiro e último dia e rótulos em português. */
export function mes(chave: string): Mes {
  const [a, m] = chave.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const nome = NOMES[m - 1];
  return {
    chave,
    rotulo: `${nome.slice(0, 3)}/${String(a).slice(2)}`,
    rotuloLongo: `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`,
    de: `${chave}-01`,
    ate: `${chave}-${String(ultimo).padStart(2, '0')}`,
  };
}

export const mesAtual = (agora = new Date()) => hojeISO(agora).slice(0, 7);

/** Últimos `antes` meses até `depois` meses à frente do mês atual, do mais recente para o mais antigo. */
export function listaMeses(antes = 12, depois = 1, agora = new Date()): Mes[] {
  const [a, m] = mesAtual(agora).split('-').map(Number);
  const lista: Mes[] = [];
  for (let i = depois; i >= -antes; i -= 1) {
    const d = new Date(Date.UTC(a, m - 1 + i, 1));
    lista.push(mes(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`));
  }
  return lista;
}

/** Texto curto para uma seleção de meses: "nov/26", "set/26 – nov/26" ou "3 meses". */
export function descreverMeses(chaves: string[]): string {
  if (!chaves.length) return 'Nenhum mês';
  const ord = [...chaves].sort();
  if (ord.length === 1) return mes(ord[0]).rotuloLongo;
  const seguidos = ord.every((c, i) => i === 0 || mes(c).de === proximoMes(ord[i - 1]));
  return seguidos ? `${mes(ord[0]).rotulo} – ${mes(ord[ord.length - 1]).rotulo}` : `${ord.length} meses`;
}

function proximoMes(chave: string): string {
  const [a, m] = chave.split('-').map(Number);
  const d = new Date(Date.UTC(a, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const moedaCentavos = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const pct = (parte: number, total: number) => (total ? `${((parte / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—');
