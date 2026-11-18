import { useMemo } from 'react';
import { CalendarCheck2, CalendarClock, CalendarX2, CheckCircle2, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pct } from '@/lib/comercial/periodo';

export interface VisitaResumo {
  status: string;
  planilha_extra?: unknown;
}

const ROTULO: Record<string, string> = {
  aguardando_corretor: 'Aguardando corretor', agendada: 'Agendada', confirmada: 'Confirmada', realizada: 'Realizada',
  no_show: 'No-show', reagendada: 'Reagendada', cancelada: 'Cancelada',
};

const COR: Record<string, string> = {
  realizada: 'bg-emerald-500', no_show: 'bg-rose-500', cancelada: 'bg-slate-400', reagendada: 'bg-amber-500',
  agendada: 'bg-primary', confirmada: 'bg-primary', aguardando_corretor: 'bg-secondary',
};

/** Rótulo exibido: o texto usado pela equipe na planilha (ex.: "Documentação") ou o status do sistema. */
export const rotuloVisita = (v: VisitaResumo) =>
  ((v.planilha_extra as { status_label?: string } | null)?.status_label) || ROTULO[v.status] || v.status;

export function ResumoVisitasMes({ visitas, periodo }: { visitas: VisitaResumo[]; periodo: string }) {
  const n = useMemo(() => {
    const conta = (...s: string[]) => visitas.filter((v) => s.includes(v.status)).length;
    const porRotulo = new Map<string, { total: number; status: string }>();
    for (const v of visitas) {
      const r = rotuloVisita(v);
      const atual = porRotulo.get(r) ?? { total: 0, status: v.status };
      porRotulo.set(r, { total: atual.total + 1, status: v.status });
    }
    return {
      total: visitas.length,
      realizadas: conta('realizada'),
      noShow: conta('no_show'),
      canceladas: conta('cancelada', 'reagendada'),
      aAcontecer: conta('aguardando_corretor', 'agendada', 'confirmada'),
      rotulos: [...porRotulo.entries()].sort((a, b) => b[1].total - a[1].total),
    };
  }, [visitas]);
  const compareceram = n.realizadas + n.noShow;

  const cards = [
    { rotulo: 'Agendadas', valor: n.total, detalhe: periodo, icone: CalendarClock, tom: 'text-primary bg-primary/10' },
    { rotulo: 'Realizadas', valor: n.realizadas, detalhe: `${pct(n.realizadas, n.total)} das agendadas`, icone: CheckCircle2, tom: 'text-emerald-600 bg-emerald-50' },
    { rotulo: 'A acontecer', valor: n.aAcontecer, detalhe: 'agendadas e confirmadas', icone: CalendarCheck2, tom: 'text-secondary-dark bg-secondary/10' },
    { rotulo: 'No-show', valor: n.noShow, detalhe: `comparecimento ${pct(n.realizadas, compareceram)}`, icone: UserX, tom: 'text-rose-600 bg-rose-50' },
    { rotulo: 'Canceladas', valor: n.canceladas, detalhe: 'inclui reagendadas', icone: CalendarX2, tom: 'text-slate-600 bg-slate-100' },
  ];

  return (
    <section aria-label="Visitas do período" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.rotulo} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.rotulo}</span>
              <span className={cn('rounded-md p-1.5', c.tom)}><c.icone className="h-4 w-4" /></span>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums">{c.valor}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.detalhe}</p>
          </div>
        ))}
      </div>

      {n.total > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status das visitas</p>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img"
            aria-label={n.rotulos.map(([r, x]) => `${r}: ${x.total}`).join(', ')}>
            {n.rotulos.map(([r, x]) => (
              <div key={r} className={COR[x.status] ?? 'bg-muted-foreground'} style={{ width: `${(x.total / n.total) * 100}%` }} title={`${r}: ${x.total}`} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
            {n.rotulos.map(([r, x]) => (
              <li key={r} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', COR[x.status] ?? 'bg-muted-foreground')} aria-hidden />
                <span>{r}</span><span className="font-semibold tabular-nums">{x.total}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
