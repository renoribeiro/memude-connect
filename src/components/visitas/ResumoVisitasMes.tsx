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

/** Rótulo exibido: o texto usado pela equipe na planilha (ex.: "Documentação") ou o status do sistema. */
export const rotuloVisita = (v: VisitaResumo) =>
  ((v.planilha_extra as { status_label?: string } | null)?.status_label) || ROTULO[v.status] || v.status;

export function ResumoVisitasMes({ visitas, periodo }: { visitas: VisitaResumo[]; periodo: string }) {
  const n = useMemo(() => {
    const conta = (...s: string[]) => visitas.filter((v) => s.includes(v.status)).length;
    return {
      total: visitas.length,
      realizadas: conta('realizada'),
      noShow: conta('no_show'),
      canceladas: conta('cancelada', 'reagendada'),
      aAcontecer: conta('aguardando_corretor', 'agendada', 'confirmada'),
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

    </section>
  );
}
