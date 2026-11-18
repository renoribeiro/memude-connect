import { useState } from 'react';
import { Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SeletorMeses } from '@/components/comercial/SeletorMeses';
import { descreverMeses, mes, mesAtual } from '@/lib/comercial/periodo';
import { EntradaLeads, Funil, Kpis, Origem } from './blocos';
import { Apresentacao } from './Apresentacao';
import { usePainelComercial } from './dados';

function Bloco({ titulo, children, className }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card p-5 shadow-sm ${className ?? ''}`}>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
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
  const titulo = descreverMeses(meses);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Resultado comercial</h2>
          <p className="text-sm text-muted-foreground">{titulo} · comparado ao período anterior de mesmo tamanho</p>
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
          <Kpis atual={data.atual} anterior={data.anterior} />
          <div className="grid gap-4 xl:grid-cols-5">
            <Bloco titulo="Funil comercial" className="xl:col-span-3"><Funil n={data.atual} /></Bloco>
            <Bloco titulo="Origem dos leads" className="xl:col-span-2"><Origem origem={data.origem} /></Bloco>
          </div>
          <Bloco titulo="Entrada de leads"><EntradaLeads porDia={data.por_dia} /></Bloco>
        </>
      )}

      {apresentando && data && <Apresentacao painel={data} titulo={titulo} onFechar={() => setApresentando(false)} />}
    </div>
  );
}
