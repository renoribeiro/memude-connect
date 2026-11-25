import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Gauge, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EstadoVazio } from '@/components/comercial/ui';
import type { Desempenho } from '@/lib/conversas/tipos';
import { useDesempenho } from '@/hooks/conversas/dados';
import { AvatarContato } from './pecas';

const PERIODOS = [7, 30, 90];
type Coluna = keyof Pick<Desempenho, 'tempo_medio_resposta_min' | 'respondidas_15min_pct' | 'mensagens_enviadas' | 'visitas_agendadas' | 'visitas_realizadas' | 'vendas' | 'alertas_sem_resposta' | 'sem_contato_3d' | 'conversas_ativas'>;

const COLUNAS: { chave: Coluna; rotulo: string; dica: string; melhorMenor?: boolean; fmt?: (v: number | null) => string }[] = [
  { chave: 'conversas_ativas', rotulo: 'Ativas', dica: 'Conversas abertas com o corretor' },
  { chave: 'tempo_medio_resposta_min', rotulo: 'Tempo médio', dica: 'Minutos até responder o cliente', melhorMenor: true, fmt: (v) => (v == null ? '—' : `${String(v).replace('.', ',')} min`) },
  { chave: 'respondidas_15min_pct', rotulo: 'Em até 15 min', dica: 'Respostas dentro do combinado', fmt: (v) => (v == null ? '—' : `${Math.round(v)}%`) },
  { chave: 'mensagens_enviadas', rotulo: 'Mensagens', dica: 'Mensagens enviadas pelo app' },
  { chave: 'visitas_agendadas', rotulo: 'Visitas', dica: 'Visitas agendadas no período' },
  { chave: 'visitas_realizadas', rotulo: 'Realizadas', dica: 'Visitas que aconteceram' },
  { chave: 'vendas', rotulo: 'Vendas', dica: 'Vendas no período' },
  { chave: 'alertas_sem_resposta', rotulo: 'Atrasos', dica: 'Vezes que passou de 15 min sem responder', melhorMenor: true },
  { chave: 'sem_contato_3d', rotulo: 'Esfriando', dica: 'Clientes pós-visita sem contato há 3 dias', melhorMenor: true },
];

/** Painel do closer: ritmo de resposta e resultado de cada corretor. */
export function DesempenhoPainel() {
  const [dias, setDias] = useState(30);
  const [ordem, setOrdem] = useState<{ col: Coluna; desc: boolean }>({ col: 'respondidas_15min_pct', desc: true });
  const { data = [], isLoading, isError, refetch } = useDesempenho(dias);

  const linhas = useMemo(() => [...data].sort((a, b) => {
    const va = (a[ordem.col] as number | null) ?? -1;
    const vb = (b[ordem.col] as number | null) ?? -1;
    return ordem.desc ? vb - va : va - vb;
  }), [data, ordem]);

  const totais = useMemo(() => {
    const com = data.filter((d) => d.tempo_medio_resposta_min != null);
    return {
      ativas: data.reduce((s, d) => s + d.conversas_ativas, 0),
      tempo: com.length ? com.reduce((s, d) => s + Number(d.tempo_medio_resposta_min), 0) / com.length : null,
      vendas: data.reduce((s, d) => s + d.vendas, 0),
      atrasos: data.reduce((s, d) => s + d.alertas_sem_resposta, 0),
    };
  }, [data]);

  const lider = linhas.find((l) => (l.respondidas_15min_pct ?? 0) > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Desempenho dos corretores</h2>
          <p className="text-sm text-muted-foreground">Ritmo de resposta no app e resultado no funil. Toque no título da coluna para ordenar.</p>
        </div>
        <div className="flex rounded-full bg-muted p-1" role="tablist" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p} type="button" role="tab" aria-selected={dias === p} onClick={() => setDias(p)}
              className={cn('rounded-full px-3 py-1 text-sm font-medium transition', dias === p ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
              {p} dias
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { r: 'Conversas ativas', v: String(totais.ativas) },
          { r: 'Tempo médio de resposta', v: totais.tempo == null ? '—' : `${totais.tempo.toFixed(1).replace('.', ',')} min` },
          { r: 'Vendas no período', v: String(totais.vendas) },
          { r: 'Atrasos (> 15 min)', v: String(totais.atrasos) },
        ].map((k) => (
          <div key={k.r} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{k.r}</p>
            <div className="mt-1 text-2xl font-bold tabular-nums">{isLoading ? <Skeleton className="h-7 w-16" /> : k.v}</div>
          </div>
        ))}
      </div>

      {lider && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          <Trophy className="h-4 w-4" /> <strong>{lider.nome}</strong> respondeu {Math.round(lider.respondidas_15min_pct!)}% dos clientes em até 15 minutos.
        </p>
      )}

      {isLoading ? <Skeleton className="h-64 w-full rounded-xl" /> : isError ? (
        <EstadoVazio icone={Gauge} titulo="Não foi possível carregar" descricao="Confira a internet e tente de novo."
          acao={<button type="button" onClick={() => refetch()} className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">Tentar de novo</button>} />
      ) : !linhas.length ? (
        <EstadoVazio icone={Gauge} titulo="Sem dados ainda" descricao="Os números aparecem quando os corretores começarem a atender pelo app." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-44">Corretor</TableHead>
                {COLUNAS.map((c) => (
                  <TableHead key={c.chave} className="whitespace-nowrap text-right" title={c.dica}>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => setOrdem((o) => ({ col: c.chave, desc: o.col === c.chave ? !o.desc : !c.melhorMenor }))}>
                      {c.rotulo}
                      {ordem.col === c.chave && (ordem.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.user_id}>
                  <TableCell>
                    <span className="flex items-center gap-2"><AvatarContato nome={l.nome} tamanho="sm" /><span className="font-medium">{l.nome}</span></span>
                  </TableCell>
                  {COLUNAS.map((c) => {
                    const v = l[c.chave] as number | null;
                    const ruim = c.chave === 'respondidas_15min_pct' ? v != null && v < 70 : c.chave === 'tempo_medio_resposta_min' ? v != null && v > 15 : c.melhorMenor && (v ?? 0) > 0;
                    return (
                      <TableCell key={c.chave} className={cn('text-right tabular-nums', ruim && 'font-semibold text-rose-600')}>
                        {c.fmt ? c.fmt(v) : v ?? 0}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
