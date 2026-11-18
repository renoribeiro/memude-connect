import { useState } from 'react';
import { BarChart3, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SeletorMeses } from '@/components/comercial/SeletorMeses';
import { descreverMeses, mes, mesAtual } from '@/lib/comercial/periodo';
import { EntradaLeads, Funil, Kpis, Origem } from './blocos';
import { Apresentacao } from './Apresentacao';
import { Comparativo } from './Comparativo';
import { usePainelComercial, type CampoComparativo } from './dados';

function Bloco({ titulo, children, className, onComparar }: {
  titulo: string; children: React.ReactNode; className?: string; onComparar?: () => void;
}) {
  return (
    <section className={`rounded-xl border bg-card p-5 shadow-sm ${className ?? ''}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
        {onComparar && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary" onClick={onComparar}>
            <BarChart3 className="mr-1 h-3.5 w-3.5" />Comparar meses
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Seção principal do Dashboard: resultado comercial do período, pronto para apresentar à diretoria. */
export function PainelComercial() {
  const [meses, setMeses] = useState<string[]>(() => [mesAtual()]);
  const ord = [...meses].sort();
  const de = mes(ord[0]).de;
  const ate = mes(ord[ord.length - 1]).ate;
  const { data, isLoading, error } = usePainelComercial(de, ate);
  const [apresentando, setApresentando] = useState(false);
  const [comparando, setComparando] = useState<CampoComparativo | null>(null);
  const titulo = descreverMeses(meses);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Resultado comercial</h2>
          <p className="text-sm text-muted-foreground">{titulo} · clique em qualquer número para comparar com os meses anteriores</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SeletorMeses valor={meses} onChange={setMeses} />
          <Button onClick={() => setApresentando(true)} disabled={!data}>
            <Presentation className="mr-1.5 h-4 w-4" />Apresentar
          </Button>
        </div>
      </div>

      {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Não foi possível carregar o painel: {(error as Error).message}</p>}
      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-7">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          <Kpis atual={data.atual} anterior={data.anterior} onAbrir={setComparando} />
          <div className="grid gap-4 xl:grid-cols-5">
            <Bloco titulo="Funil comercial" className="xl:col-span-3"><Funil n={data.atual} onAbrir={setComparando} /></Bloco>
            <Bloco titulo="Origem dos leads" className="xl:col-span-2" onComparar={() => setComparando('origem')}><Origem origem={data.origem} /></Bloco>
          </div>
          <Bloco titulo="Entrada de leads" onComparar={() => setComparando('leads')}><EntradaLeads porDia={data.por_dia} /></Bloco>
        </>
      )}

      <Comparativo campo={comparando} ate={ate} onFechar={() => setComparando(null)} />
      {apresentando && data && <Apresentacao painel={data} titulo={titulo} onFechar={() => setApresentando(false)} />}
    </div>
  );
}
