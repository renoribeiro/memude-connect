// Fuso de todo o módulo comercial: America/Fortaleza (UTC-3, sem horário de verão).
export const FUSO = 'America/Fortaleza';

const partes = (d: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

/** Data de hoje em Fortaleza no formato AAAA-MM-DD. */
export function hojeISO(agora = new Date()): string {
  const p = partes(agora);
  return `${p.year}-${p.month}-${p.day}`;
}

export function dataISO(d: Date): string {
  const p = partes(d);
  return `${p.year}-${p.month}-${p.day}`;
}

export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

/** Instante de início da visita (data + hora locais de Fortaleza). */
export function inicioVisita(data: string, hora: string): Date {
  return new Date(`${data}T${hora.slice(0, 5)}:00-03:00`);
}

export function formatarData(iso?: string | null): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function formatarHora(hora?: string | null): string {
  return hora ? hora.slice(0, 5) : '—';
}

export function formatarDataHora(instante?: string | null): string {
  if (!instante) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(instante));
}

export function formatarDiaSemana(iso: string, estilo: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: estilo, day: '2-digit', month: 'short' })
    .format(new Date(`${iso}T12:00:00Z`));
}

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

/** "há 2 h", "em 15 min", "amanhã"… */
export function relativo(instante: string | Date, agora = new Date()): string {
  const alvo = typeof instante === 'string' ? new Date(instante) : instante;
  const seg = Math.round((alvo.getTime() - agora.getTime()) / 1000);
  const abs = Math.abs(seg);
  if (abs < 60) return seg >= 0 ? 'agora' : 'agora há pouco';
  if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour');
  return rtf.format(Math.round(seg / 86400), 'day');
}
