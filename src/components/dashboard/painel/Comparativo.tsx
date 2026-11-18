import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { mes, moeda } from '@/lib/comercial/periodo';
import { CORES_ORIGEM, useHistorico, type CampoComparativo, type MesHistorico, type Numeros } from './dados';

export const ROTULO_CAMPO: Record<CampoComparativo, string> = {
  vgv: 'VGV vendido', vendas: 'Vendas fechadas', ticket_medio: 'Ticket médio', comissao_memude: 'Comissão MeMude',
  comissao_liquida: 'Comissão líquida', leads: 'Leads recebidos', qualificados: 'Leads qualificados',
  visitas_agendadas: 'Visitas agendadas', visitas_realizadas: 'Visitas realizadas', visitas_no_show: 'No-show',
  visitas_canceladas: 'Visitas canceladas', visitas_futuras: 'Visitas a acontecer', origem: 'Origem dos leads',
};

const EM_REAIS = new Set<CampoComparativo>(['vgv', 'ticket_medio', 'comissao_memude', 'comissao_liquida']);
const fmt = (campo: CampoComparativo, v: number) => (EM_REAIS.has(campo) ? moeda(v) : Math.round(v).toLocaleString('pt-BR'));
const fmtCurto = (campo: CampoComparativo, v: number) =>
  EM_REAIS.has(campo) ? (v >= 1_000_000 ? `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`
    : v >= 1000 ? `R$ ${Math.round(v / 1000)} mil` : moeda(v)) : Math.round(v).toLocaleString('pt-BR');

function Variacao({ atual, anterior }: { atual: number; anterior: number | null }) {
  if (anterior === null) return <span className="text-muted-foreground">—</span>;
  if (!anterior) return <span className="text-muted-foreground">{atual ? 'novo' : '—'}</span>;
  const d = (atual - anterior) / anterior;
  const Icone = d > 0.005 ? ArrowUpRight : d < -0.005 ? ArrowDownRight : Minus;
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-medium tabular-nums',
      d > 0.005 ? 'text-emerald-600' : d < -0.005 ? 'text-rose-600' : 'text-muted-foreground')}>
      <Icone className="h-3.5 w-3.5" />{(Math.abs(d) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
    </span>
  );
}

/** Pop-up com o comparativo mês a mês de um campo do painel (3 ou 6 meses). */
export function Comparativo({ campo, ate, onFechar }: { campo: CampoComparativo | null; ate: string; onFechar: () => void }) {
  const [meses, setMeses] = useState<3 | 6>(3);
  const { data, isLoading, error } = useHistorico(ate, meses, campo !== null);
  const mesSelecionado = ate.slice(0, 7);

  return (
    <Dialog open={campo !== null} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-3xl">
        {campo && (
          <>
            <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0 pr-8">
              <div>
                <DialogTitle>{ROTULO_CAMPO[campo]}</DialogTitle>
                <DialogDescription>Comparativo mês a mês até {mes(mesSelecionado).rotuloLongo.toLowerCase()}</DialogDescription>
              </div>
              <div className="inline-flex shrink-0 rounded-md bg-muted p-0.5 text-sm" role="tablist" aria-label="Período do comparativo">
                {([3, 6] as const).map((n) => (
                  <button key={n} type="button" role="tab" aria-selected={meses === n} onClick={() => setMeses(n)}
                    className={cn('rounded px-3 py-1 font-medium transition-colors', meses === n ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                    {n} meses
                  </button>
                ))}
              </div>
            </DialogHeader>

            {error && <p className="text-sm text-destructive">Não foi possível carregar: {(error as Error).message}</p>}
            {isLoading || !data ? <Skeleton className="h-80" /> : campo === 'origem'
              ? <ComparativoOrigem dados={data} mesSelecionado={mesSelecionado} />
              : <ComparativoNumero campo={campo} dados={data} mesSelecionado={mesSelecionado} />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ComparativoNumero({ campo, dados, mesSelecionado }: { campo: keyof Numeros; dados: MesHistorico[]; mesSelecionado: string }) {
  const linhas = dados.map((d, i) => ({
    mes: d.mes, rotulo: mes(d.mes).rotulo, valor: Number(d.numeros[campo] ?? 0),
    anterior: i > 0 ? Number(dados[i - 1].numeros[campo] ?? 0) : null,
  }));
  const soma = linhas.reduce((s, l) => s + l.valor, 0);
  const media = linhas.length ? soma / linhas.length : 0;
  const melhor = linhas.reduce((m, l) => (l.valor > m.valor ? l : m), linhas[0]);
  const somaFazSentido = campo !== 'ticket_medio';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          [somaFazSentido ? 'Total no período' : 'Ticket médio do período', somaFazSentido ? fmt(campo, soma) : fmt(campo, media)],
          ['Média por mês', fmt(campo, media)],
          ['Melhor mês', melhor ? `${melhor.rotulo} · ${fmtCurto(campo, melhor.valor)}` : '—'],
        ].map(([r, v]) => (
          <div key={r} className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{r}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-secondary">{v}</p>
          </div>
        ))}
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={linhas} margin={{ top: 26, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis hide />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} formatter={(v: number) => [fmt(campo, v), ROTULO_CAMPO[campo]]} />
            <Bar dataKey="valor" radius={[6, 6, 0, 0]} isAnimationActive={false}
              label={{ position: 'top', fontSize: 12, fontWeight: 700, fill: '#2b1d6e', formatter: (v: number) => fmtCurto(campo, v) }}>
              {linhas.map((l) => <Cell key={l.mes} fill={l.mes === mesSelecionado ? '#e92662' : '#422f91'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 font-medium">Mês</th><th className="py-2 text-right font-medium">{ROTULO_CAMPO[campo]}</th>
            <th className="py-2 text-right font-medium">vs mês anterior</th>
          </tr>
        </thead>
        <tbody>
          {[...linhas].reverse().map((l) => (
            <tr key={l.mes} className={cn('border-b last:border-0', l.mes === mesSelecionado && 'bg-secondary/5 font-semibold')}>
              <td className="py-2">{mes(l.mes).rotuloLongo}</td>
              <td className="py-2 text-right tabular-nums">{fmt(campo, l.valor)}</td>
              <td className="py-2 text-right"><Variacao atual={l.valor} anterior={l.anterior} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparativoOrigem({ dados, mesSelecionado }: { dados: MesHistorico[]; mesSelecionado: string }) {
  const fontes = useMemo(() => {
    const totais = new Map<string, number>();
    for (const d of dados) for (const [f, n] of Object.entries(d.origem)) totais.set(f, (totais.get(f) ?? 0) + n);
    return [...totais.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  }, [dados]);
  const linhas = dados.map((d) => ({ mes: d.mes, rotulo: mes(d.mes).rotulo, ...d.origem }));

  return (
    <div className="space-y-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={linhas} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis hide />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            {fontes.map((f, i) => (
              <Bar key={f} dataKey={f} stackId="origem" isAnimationActive={false} fill={CORES_ORIGEM[i % CORES_ORIGEM.length]}
                radius={i === fontes.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 text-left font-medium">Origem</th>
              {dados.map((d) => <th key={d.mes} className={cn('py-2 text-right font-medium', d.mes === mesSelecionado && 'text-secondary')}>{mes(d.mes).rotulo}</th>)}
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {fontes.map((f, i) => (
              <tr key={f} className="border-b last:border-0">
                <td className="py-2"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CORES_ORIGEM[i % CORES_ORIGEM.length] }} />{f}</td>
                {dados.map((d) => <td key={d.mes} className="py-2 text-right tabular-nums">{d.origem[f] ?? 0}</td>)}
                <td className="py-2 text-right font-semibold tabular-nums">{dados.reduce((s, d) => s + (d.origem[f] ?? 0), 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
