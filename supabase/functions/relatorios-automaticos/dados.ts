import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { estrutura, lerAba } from '../_shared/fase1-sheets.ts';

export interface LeadR { data: string; fonte: string; status: string }
export interface VisitaR { data: string; status: string; corretor: string; cliente: string; imovel: string }

const FUSO = 'America/Fortaleza';

/** AAAA-MM-DD em Fortaleza, deslocado em dias. */
export function diaISO(deslocamento = 0, base = new Date()): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(base).map((x) => [x.type, x.value]));
  const d = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) + deslocamento));
  return d.toISOString().slice(0, 10);
}

export const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

function isoDeBR(v: string): string | null {
  const m = (v ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const i = (v ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return i ? `${i[1]}-${i[2]}-${i[3]}` : null;
}

/** Mesma fonte usada pelo n8n: abas LEADS e VISITAS da planilha (somente leitura). */
export async function dadosDaPlanilha(planilha: string): Promise<{ leads: LeadR[]; visitas: VisitaR[] }> {
  const [el, ev] = await Promise.all([estrutura(planilha, 'LEADS', false), estrutura(planilha, 'VISITAS', false)]);
  const [ll, lv] = await Promise.all([lerAba(planilha, el), lerAba(planilha, ev)]);
  const col = (row: string[], mapa: Record<string, number>, campo: string) => (mapa[campo] === undefined ? '' : (row[mapa[campo]] ?? '').trim());
  const leads = ll.slice(1).map((r) => ({ data: isoDeBR(col(r, el.mapa, 'entrada')) ?? '', fonte: col(r, el.mapa, 'fonte'), status: col(r, el.mapa, 'status') }))
    .filter((l) => l.data);
  const visitas = lv.slice(1).map((r) => ({
    data: isoDeBR(col(r, ev.mapa, 'data visita')) ?? '', status: col(r, ev.mapa, 'status'), corretor: col(r, ev.mapa, 'corretor'),
    cliente: col(r, ev.mapa, 'nome'), imovel: col(r, ev.mapa, 'imovel'),
  })).filter((v) => v.data);
  return { leads, visitas };
}

const ROTULO: Record<string, string> = {
  aguardando_corretor: 'Aguardando corretor', agendada: 'Agendada', confirmada: 'Confirmada', realizada: 'Realizada',
  no_show: 'No-show', reagendada: 'Reagendada', cancelada: 'Cancelada',
};

/** Fonte alternativa: o próprio core (usar quando a extensão gravar direto no sistema). */
export async function dadosDoCore(db: SupabaseClient, de: string, ate: string): Promise<{ leads: LeadR[]; visitas: VisitaR[] }> {
  const [l, v] = await Promise.all([
    db.from('leads').select('data_entrada, fonte, status_atendimento, planilha_extra').is('deleted_at', null).gte('data_entrada', de).lte('data_entrada', ate).limit(20000),
    db.from('visitas').select('data_visita, status, planilha_extra, leads(nome), empreendimentos(nome), corretores(profiles(first_name, last_name))')
      .is('deleted_at', null).gte('data_visita', de).lte('data_visita', ate).limit(20000),
  ]);
  if (l.error) throw l.error;
  if (v.error) throw v.error;
  return {
    leads: (l.data ?? []).map((x) => ({
      data: x.data_entrada, fonte: x.fonte ?? 'Outros',
      status: (x.planilha_extra as { status_label?: string } | null)?.status_label ?? x.status_atendimento,
    })),
    visitas: (v.data ?? []).map((x) => {
      const c = x.corretores as { profiles?: { first_name?: string; last_name?: string } } | null;
      return {
        data: x.data_visita,
        status: (x.planilha_extra as { status_label?: string } | null)?.status_label ?? ROTULO[x.status] ?? x.status,
        corretor: [c?.profiles?.first_name, c?.profiles?.last_name].filter(Boolean).join(' '),
        cliente: (x.leads as { nome?: string } | null)?.nome ?? '',
        imovel: (x.empreendimentos as { nome?: string } | null)?.nome ?? '',
      };
    }),
  };
}

const norm = (s: string) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Classificação do n8n, estendida aos status do core. */
export function classe(status: string): 'venda' | 'realizada' | 'furo' | 'agendada' | 'outro' {
  const s = norm(status);
  if (['comprou', 'vendemos', 'pendente comissao', 'venda realizada', 'vendido', 'vendido!'].includes(s)) return 'venda';
  if (['visita realizada', 'realizada'].includes(s)) return 'realizada';
  if (['lead furou', 'cancelado', 'cancelada', 'no-show', 'no show'].includes(s)) return 'furo';
  if (s.includes('agendada') || ['confirmada', 'aguardando corretor'].includes(s)) return 'agendada';
  return 'outro';
}
