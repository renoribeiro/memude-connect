import { useEffect, useState } from 'react';
import { ChevronDown, Info, UserRoundSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSugestoesCorretor } from '@/hooks/comercial/dados';
import { EstadoVazio, Iniciais } from './ui';

export interface CorretorEscolhido {
  id: string;
  nome: string;
  score: number | null;
  motivo: string;
}

const CRITERIOS: { chave: 'conversao' | 'aderencia' | 'aceite' | 'nota'; rotulo: string }[] = [
  { chave: 'conversao', rotulo: 'Conversão' },
  { chave: 'aderencia', rotulo: 'Aderência' },
  { chave: 'aceite', rotulo: 'Aceite' },
  { chave: 'nota', rotulo: 'Nota' },
];

function corScore(s: number | null) {
  if (s === null) return 'text-muted-foreground';
  if (s >= 75) return 'text-emerald-700';
  if (s >= 50) return 'text-amber-700';
  return 'text-muted-foreground';
}

export function SeletorCorretor({ empreendimentoId, data, hora, visitaId, excluir, valor, onChange, quantidade = 3, autoSelecionar = false }: {
  empreendimentoId: string | null;
  data: string | null;
  hora: string | null;
  visitaId?: string | null;
  excluir?: string[];
  valor: string | null;
  onChange: (c: CorretorEscolhido) => void;
  quantidade?: number;
  /** Já deixa marcado o melhor corretor livre (a SDR só confere). */
  autoSelecionar?: boolean;
}) {
  const [todos, setTodos] = useState(false);
  const { data: lista = [], isLoading, isError } = useSugestoesCorretor({ empreendimentoId, data, hora, visitaId, excluir });
  const melhor = lista.find((c) => c.disponivel && !c.ja_convidado);
  useEffect(() => {
    if (!autoSelecionar || valor || !melhor) return;
    onChange({ id: melhor.corretor_id, nome: melhor.nome, score: melhor.score === null ? null : Number(melhor.score), motivo: melhor.motivo });
  }, [autoSelecionar, valor, melhor, onChange]);

  if (!empreendimentoId) {
    return <EstadoVazio icone={UserRoundSearch} titulo="Selecione o empreendimento" descricao="As sugestões de corretor dependem do empreendimento e do horário." />;
  }
  if (isLoading) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>;
  if (isError) return <p className="text-sm text-destructive">Não foi possível calcular as sugestões.</p>;
  if (!lista.length) return <EstadoVazio icone={UserRoundSearch} titulo="Nenhum corretor ativo disponível" />;

  const elegiveis = lista.filter((c) => !c.ja_convidado);
  const exibidos = todos ? lista : elegiveis.slice(0, quantidade);

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Corretores sugeridos" className="space-y-2">
        {exibidos.map((c, i) => {
          const bloqueado = !c.disponivel || c.ja_convidado;
          const selecionado = valor === c.corretor_id;
          const pesos = (c.detalhe as { pesos_efetivos?: Record<string, number> } | null)?.pesos_efetivos ?? {};
          return (
            <button
              key={c.corretor_id}
              type="button"
              role="radio"
              aria-checked={selecionado}
              disabled={bloqueado}
              onClick={() => onChange({ id: c.corretor_id, nome: c.nome, score: c.score === null ? null : Number(c.score), motivo: c.motivo })}
              className={cn(
                'w-full rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selecionado ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/40 hover:bg-muted/60',
                bloqueado && 'cursor-not-allowed opacity-60 hover:bg-transparent',
              )}
            >
              <div className="flex items-start gap-3">
                <Iniciais nome={c.nome} className="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{c.nome}</p>
                    {!todos && i === 0 && !bloqueado && <span className="rounded bg-primary px-1.5 text-[10px] font-semibold uppercase text-primary-foreground">Melhor opção</span>}
                    {!c.disponivel && <span className="rounded bg-rose-100 px-1.5 text-[10px] font-semibold uppercase text-rose-700">Ocupado no horário</span>}
                    {c.ja_convidado && <span className="rounded bg-muted px-1.5 text-[10px] font-semibold uppercase text-muted-foreground">Já convidado</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.motivo}</p>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {CRITERIOS.map((k) => {
                      const v = c[k.chave] === null ? null : Number(c[k.chave]);
                      return (
                        <div key={k.chave} title={`${k.rotulo}: ${v === null ? 'sem dados' : `${Math.round(v)}/100`} · peso ${pesos[k.chave] ?? 0}%`}>
                          <div className="flex justify-between text-[10px] text-muted-foreground"><span>{k.rotulo}</span><span>{v === null ? '—' : Math.round(v)}</span></div>
                          <div className="mt-0.5 h-1 rounded-full bg-muted">
                            <div className={cn('h-1 rounded-full', v === null ? 'bg-transparent' : 'bg-primary')} style={{ width: `${v ?? 0}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('text-xl font-bold tabular-nums leading-none', corScore(c.score === null ? null : Number(c.score)))}>
                    {c.score === null ? '—' : Math.round(Number(c.score))}
                  </p>
                  <p className="text-[10px] uppercase text-muted-foreground">rating</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        {lista.length > quantidade && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setTodos((t) => !t)}>
            <ChevronDown className={cn('transition-transform', todos && 'rotate-180')} />
            {todos ? 'Mostrar só as sugestões' : `Ver todos os ${lista.length} corretores`}
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5" /> Como o rating é calculado</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            Conversão 40% · Aderência ao perfil 30% · Aceite 15% · Nota do cliente 15% (pesos editáveis em Ajustes).
            Com menos de 5 visitas realizadas, usa a média geral; critérios sem dados têm o peso redistribuído.
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
