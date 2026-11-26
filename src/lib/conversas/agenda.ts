/** Datas do app do corretor, sempre no fuso de Fortaleza. */
export const FUSO = 'America/Fortaleza';

const isoDe = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(d);

export const hojeISO = () => isoDe(new Date());
export const daquiDiasISO = (dias: number) => isoDe(new Date(Date.now() + dias * 86_400_000));
export const isoDoInstante = (iso: string) => isoDe(new Date(iso));

export function diaRotulo(iso: string): string {
  if (iso === hojeISO()) return 'Hoje';
  if (iso === daquiDiasISO(1)) return 'Amanhã';
  const s = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(`${iso}T12:00:00`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const horaDe = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** "Bom dia", "Boa tarde" ou "Boa noite" pela hora de Fortaleza. */
export function periodoDoDia(agora = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: 'numeric', hourCycle: 'h23' }).format(agora));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "Hoje", "Amanhã" ou "02/12" (cabe no selo do horário). */
export function diaCurto(iso: string): string {
  if (iso === hojeISO()) return 'Hoje';
  if (iso === daquiDiasISO(1)) return 'Amanhã';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
