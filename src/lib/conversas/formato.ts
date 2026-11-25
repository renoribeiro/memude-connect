// Formatação das conversas (horário de Fortaleza, igual ao resto do Connect).
const FUSO = 'America/Fortaleza';

const diaChave = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** "14:05" */
export function horaCurta(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** Na lista: hora se hoje, "Ontem", dia da semana nesta semana, senão dd/mm/aa. */
export function quandoNaLista(iso: string | null | undefined, agora = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  const hoje = diaChave(agora);
  if (diaChave(d) === hoje) return horaCurta(iso);
  const ontem = diaChave(new Date(agora.getTime() - 86_400_000));
  if (diaChave(d) === ontem) return 'Ontem';
  if (agora.getTime() - d.getTime() < 6 * 86_400_000) {
    const s = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'short' }).format(d).replace('.', '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);
}

/** Separador de dias no chat: "Hoje", "Ontem", "segunda-feira, 24 de novembro". */
export function separadorDia(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  if (diaChave(d) === diaChave(agora)) return 'Hoje';
  if (diaChave(d) === diaChave(new Date(agora.getTime() - 86_400_000))) return 'Ontem';
  const mesmoAno = d.getUTCFullYear() === agora.getUTCFullYear();
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long', ...(mesmoAno ? {} : { year: 'numeric' }),
  }).format(d);
}

export const mesmoDia = (a: string, b: string) => diaChave(new Date(a)) === diaChave(new Date(b));

/** "há 12 min", "há 2 h", "há 3 dias" */
export function haQuanto(iso: string | null | undefined, agora = Date.now()): string {
  if (!iso) return '';
  const min = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

/** Minutos de espera do cliente (para o semáforo de SLA). */
export function minutosEsperando(iso: string | null | undefined, agora = Date.now()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000));
}

/** Semáforo: até 5 min ok, até 15 min atenção, acima disso atrasado. */
export function nivelEspera(min: number | null): 'ok' | 'atencao' | 'atrasado' | null {
  if (min == null) return null;
  return min <= 5 ? 'ok' : min <= 15 ? 'atencao' : 'atrasado';
}

export function tamanhoArquivo(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export function duracao(seg: number | null | undefined): string {
  const s = Math.max(0, Math.round(seg ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Telefone legível: +55 85 99999-1234 → (85) 99999-1234 */
export function telefoneLegivel(tel: string | null | undefined): string {
  const d = (tel ?? '').replace(/\D/g, '');
  const n = d.startsWith('55') && (d.length === 12 || d.length === 13) ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return tel ?? '';
}

export type Trecho = { tipo: 'texto' | 'link' | 'negrito' | 'italico' | 'riscado' | 'codigo'; valor: string };

/**
 * Quebra o texto do WhatsApp em trechos seguros para renderizar (sem HTML):
 * links clicáveis e a formatação *negrito*, _itálico_, ~riscado~ e `código`.
 */
export function trechos(texto: string): Trecho[] {
  const out: Trecho[] = [];
  const re = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~|`([^`\n]+)`/g;
  let ultimo = 0;
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    if (m.index > ultimo) out.push({ tipo: 'texto', valor: texto.slice(ultimo, m.index) });
    if (m[1]) out.push({ tipo: 'link', valor: m[1] });
    else if (m[2]) out.push({ tipo: 'negrito', valor: m[2] });
    else if (m[3]) out.push({ tipo: 'italico', valor: m[3] });
    else if (m[4]) out.push({ tipo: 'riscado', valor: m[4] });
    else if (m[5]) out.push({ tipo: 'codigo', valor: m[5] });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) out.push({ tipo: 'texto', valor: texto.slice(ultimo) });
  return out;
}

/** Texto da mensagem sem a assinatura automática "*Nome · Papel*" da 1ª linha. */
export function semAssinatura(texto: string | null | undefined): string {
  return (texto ?? '').replace(/^\*[^*\n]{2,60} · [^*\n]{2,30}\*\n/, '');
}

export function iniciais(nome: string | null | undefined): string {
  return (nome ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
}

/** Cor estável do avatar a partir do nome (8 tons da marca). */
export function corAvatar(chave: string | null | undefined): string {
  const cores = [
    'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700', 'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-800', 'bg-fuchsia-100 text-fuchsia-700', 'bg-indigo-100 text-indigo-700', 'bg-teal-100 text-teal-700',
  ];
  let h = 0;
  for (const ch of chave ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return cores[h % cores.length];
}

/** Nome para mostrar: o do lead no CRM, senão o do WhatsApp, senão o telefone. */
export const nomeDaConversa = (c: { lead_nome?: string | null; nome_contato?: string | null; telefone: string }) =>
  c.lead_nome || c.nome_contato || telefoneLegivel(c.telefone);
