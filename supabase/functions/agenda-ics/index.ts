// MeMude — agenda para assinar no Google Agenda, iPhone (Calendário) e Outlook.
// Link privado por pessoa: /functions/v1/agenda-ics?t=<token>. Quem tem o link vê só as visitas daquela pessoa.
// O token é trocado no app ("Trocar link") e o link antigo para de funcionar na hora.
import { clienteServico } from '../_shared/fase1-http.ts';

type Evento = { id: string; inicio: string; minutos: number; titulo: string; local: string | null; descricao: string | null };

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Linhas do iCal têm no máximo 75 bytes; o resto continua na linha seguinte começando com espaço
function dobrar(linha: string): string {
  const bytes = new TextEncoder().encode(linha);
  if (bytes.length <= 75) return linha;
  const partes: string[] = [];
  let atual = '';
  let tam = 0;
  for (const ch of linha) {
    const n = new TextEncoder().encode(ch).length;
    if (tam + n > (partes.length ? 74 : 75)) { partes.push(atual); atual = ''; tam = 0; }
    atual += ch;
    tam += n;
  }
  partes.push(atual);
  return partes.join('\r\n ');
}

function ics(nome: string, eventos: Evento[]): string {
  const agora = utc(new Date());
  const l: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MeMude//Agenda//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(nome)}`, 'X-WR-TIMEZONE:America/Fortaleza',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ];
  for (const e of eventos) {
    const ini = new Date(e.inicio);
    if (Number.isNaN(ini.getTime())) continue;
    const fim = new Date(ini.getTime() + (e.minutos || 60) * 60_000);
    l.push('BEGIN:VEVENT', `UID:${e.id}@memude`, `DTSTAMP:${agora}`, `DTSTART:${utc(ini)}`, `DTEND:${utc(fim)}`,
      `SUMMARY:${esc(e.titulo)}`);
    if (e.local) l.push(`LOCATION:${esc(e.local)}`);
    if (e.descricao) l.push(`DESCRIPTION:${esc(e.descricao)}`);
    l.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.titulo)}`, `TRIGGER:-PT${e.id.startsWith('lembrete') ? 0 : 60}M`, 'END:VALARM', 'END:VEVENT');
  }
  l.push('END:VCALENDAR');
  return l.map(dobrar).join('\r\n') + '\r\n';
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Método não permitido', { status: 405 });
  const token = new URL(req.url).searchParams.get('t') ?? '';
  if (!/^[a-f0-9]{48}$/.test(token)) return new Response('Link inválido', { status: 404 });
  try {
    const { data, error } = await clienteServico().rpc('agenda_feed', { p_token: token });
    if (error) throw error;
    if (!data) return new Response('Link expirado. Gere um novo link no app MeMude.', { status: 404 });
    const corpo = ics(String(data.nome ?? 'MeMude'), (data.eventos ?? []) as Evento[]);
    return new Response(req.method === 'HEAD' ? null : corpo, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="memude.ics"',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('agenda-ics', (err as Error).message);
    return new Response('Agenda indisponível. Tente de novo em instantes.', { status: 500 });
  }
});
