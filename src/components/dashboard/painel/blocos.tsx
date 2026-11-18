import { useState } from 'react';
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { moeda, pct } from '@/lib/comercial/periodo';
import { CORES_ORIGEM, funil, porSemana, type Numeros, type Painel } from './dados';

const pctNum = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

function Variacao({ atual, anterior, grande }: { atual: number; anterior: number; grande?: boolean }) {
  if (!anterior && !atual) return null;
  const d = anterior ? (atual - anterior) / anterior : 1;
  const Icone = d > 0.005 ? ArrowUpRight : d < -0.005 ? ArrowDownRight : Minus;
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-medium', grande ? 'text-sm' : 'text-xs',
      d > 0.005 ? 'text-emerald-600' : d < -0.005 ? 'text-rose-600' : 'text-muted-foreground')}>
      <Icone className={grande ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      {anterior ? pctNum(Math.abs(d)) : 'novo'} <span className="font-normal text-muted-foreground">vs período anterior</span>
    </span>
  );
}

/** Card que vira botão quando há comparativo para abrir. */
function Clicavel({ onClick, rotulo, className, children }: {
  onClick?: () => void; rotulo: string; className?: string; children: React.ReactNode;
}) {
  if (!onClick) return <div className={className}>{children}</div>;
  return (
    <div role="button" tabIndex={0} onClick={onClick} aria-label={rotulo} title="Ver comparativo dos últimos meses"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={cn(className, 'w-full cursor-pointer text-left transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
      {children}
    </div>
  );
}

export function Kpis({ atual, anterior, grande, onAbrir }: {
  atual: Numeros; anterior: Numeros; grande?: boolean; onAbrir?: (campo: keyof Numeros) => void;
}) {
  const itens: { rotulo: string; valor: string; chave: keyof Numeros; detalhe?: string; destaque?: boolean }[] = [
    { rotulo: 'VGV vendido', valor: moeda(atual.vgv), chave: 'vgv', destaque: true },
    { rotulo: 'Vendas fechadas', valor: String(atual.vendas), chave: 'vendas' },
    { rotulo: 'Ticket médio', valor: atual.vendas ? moeda(atual.ticket_medio) : '—', chave: 'ticket_medio' },
    { rotulo: 'Comissão MeMude', valor: moeda(atual.comissao_memude), chave: 'comissao_memude', detalhe: `Líquida total ${moeda(atual.comissao_liquida)}`, destaque: true },
    { rotulo: 'Leads recebidos', valor: atual.leads.toLocaleString('pt-BR'), chave: 'leads' },
    { rotulo: 'Visitas agendadas', valor: String(atual.visitas_agendadas), chave: 'visitas_agendadas' },
    { rotulo: 'Visitas realizadas', valor: String(atual.visitas_realizadas), chave: 'visitas_realizadas', detalhe: `${pct(atual.visitas_realizadas, atual.visitas_agendadas)} das agendadas` },
  ];
  return (
    <div className={cn('grid gap-3', grande ? 'grid-cols-4 gap-5' : 'grid-cols-2 lg:grid-cols-4 xl:grid-cols-7')}>
      {itens.map((k) => (
        <Clicavel key={k.rotulo} onClick={onAbrir && (() => onAbrir(k.chave))} rotulo={`Comparativo mensal de ${k.rotulo}`}
          className={cn('rounded-xl border bg-card shadow-sm', grande ? 'p-6' : 'p-4',
            k.destaque && 'border-primary/20 bg-gradient-to-br from-card to-primary/5')}>
          <p className={cn('font-medium uppercase tracking-wide text-muted-foreground', grande ? 'text-sm' : 'text-[11px]')}>{k.rotulo}</p>
          <p className={cn('mt-1 font-bold tabular-nums text-secondary', grande ? 'text-4xl' : 'text-2xl')}>{k.valor}</p>
          {k.detalhe && <p className={cn('text-muted-foreground', grande ? 'text-sm' : 'text-xs')}>{k.detalhe}</p>}
          <div className="mt-1"><Variacao atual={Number(atual[k.chave])} anterior={Number(anterior[k.chave])} grande={grande} /></div>
        </Clicavel>
      ))}
    </div>
  );
}

export function Funil({ n, grande, onAbrir }: { n: Numeros; grande?: boolean; onAbrir?: (campo: keyof Numeros) => void }) {
  const etapas = funil(n);
  const cores = ['#2b1d6e', '#422f91', '#6a2a8c', '#a82a73', '#e92662'];
  return (
    <ol className={cn('space-y-1.5', grande && 'space-y-2.5')} aria-label="Funil comercial">
      {etapas.map((e, i) => {
        const largura = 100 - i * 14;
        return (
          <li key={e.rotulo}>
            <Clicavel onClick={onAbrir && (() => onAbrir(e.campo))} rotulo={`Comparativo mensal de ${e.rotulo}`}
              className="flex items-center gap-4 rounded-lg border border-transparent p-0.5">
            <div className="flex flex-1 justify-center">
              <div className={cn('flex items-center justify-center rounded-md font-bold text-white', grande ? 'h-16 text-3xl' : 'h-11 text-lg')}
                style={{ width: `${largura}%`, background: cores[i] }}>{e.valor.toLocaleString('pt-BR')}</div>
            </div>
            <div className={cn('shrink-0', grande ? 'w-72' : 'w-44 sm:w-56')}>
              <p className={cn('font-semibold leading-tight', grande ? 'text-lg' : 'text-sm')}>{e.rotulo}</p>
              <p className={cn('text-muted-foreground', grande ? 'text-sm' : 'text-xs')}>
                {e.daEtapa === null ? '100% do total' : `${pctNum(e.daEtapa)} da etapa · ${pctNum(e.doTotal)} do total`}
              </p>
            </div>
            </Clicavel>
          </li>
        );
      })}
    </ol>
  );
}

export function Origem({ origem, grande }: { origem: Painel['origem']; grande?: boolean }) {
  const total = origem.reduce((s, o) => s + o.total, 0);
  if (!total) return <p className="py-10 text-center text-sm text-muted-foreground">Nenhum lead no período</p>;
  return (
    <div className={cn('flex items-center gap-4', grande ? 'flex-row' : 'flex-col sm:flex-row')}>
      <div className={grande ? 'h-80 w-80' : 'h-48 w-48 shrink-0'}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={origem} dataKey="total" nameKey="fonte" innerRadius="55%" outerRadius="95%" paddingAngle={2} stroke="none" isAnimationActive={!grande}>
              {origem.map((o, i) => <Cell key={o.fonte} fill={CORES_ORIGEM[i % CORES_ORIGEM.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number, nome: string) => [`${v} (${pct(v, total)})`, nome]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className={cn('w-full space-y-1.5', grande ? 'text-lg' : 'text-sm')}>
        {origem.map((o, i) => (
          <li key={o.fonte} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: CORES_ORIGEM[i % CORES_ORIGEM.length] }} aria-hidden />
            <span className="flex-1 truncate">{o.fonte}</span>
            <span className="font-semibold tabular-nums">{o.total}</span>
            <span className="w-14 text-right tabular-nums text-muted-foreground">{pct(o.total, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EntradaLeads({ porDia, grande, modoInicial = 'semana' }: { porDia: Painel['por_dia']; grande?: boolean; modoInicial?: 'semana' | 'dia' }) {
  const [modo, setModo] = useState<'semana' | 'dia'>(modoInicial);
  const dados = modo === 'semana'
    ? porSemana(porDia).map((s) => ({ rotulo: s.rotulo, leads: s.leads, extra: s.variacao === null ? '' : `${s.variacao > 0 ? '+' : ''}${pctNum(s.variacao)}` }))
    : porDia.map((d) => ({ rotulo: `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}`, leads: d.leads, extra: '' }));
  return (
    <div>
      {!grande && (
        <div className="mb-2 flex justify-end">
          <div className="inline-flex rounded-md bg-muted p-0.5 text-xs" role="tablist" aria-label="Agrupar entrada de leads">
            {(['semana', 'dia'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => setModo(m)}
                className={cn('rounded px-2.5 py-1 font-medium', modo === m ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
                {m === 'semana' ? 'Por semana' : 'Por dia'}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={grande ? 'h-[420px]' : 'h-56'}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 28, right: 8, left: -18, bottom: 0 }}>
            <XAxis dataKey="rotulo" tick={{ fontSize: grande ? 13 : 10 }} interval={modo === 'dia' ? 'preserveStartEnd' : 0} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: grande ? 13 : 10 }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} formatter={(v: number) => [v, 'Leads']} />
            <Bar dataKey="leads" fill="#e92662" radius={[6, 6, 0, 0]} isAnimationActive={!grande}>
              {modo === 'semana' && <LabelList dataKey="leads" position="top" style={{ fontSize: grande ? 18 : 12, fontWeight: 700, fill: '#2b1d6e' }} />}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
