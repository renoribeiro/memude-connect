import { useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Topo } from '@/components/app/Topo';
import { AvatarContato, Espera, Temperatura } from '@/components/conversas/pecas';
import { useMoverEtapa } from '@/hooks/conversas/dados';
import { useAgora } from '@/hooks/conversas/useAgora';
import { nomeDaConversa, quandoNaLista } from '@/lib/conversas/formato';
import { ETAPAS, type ConversaItem } from '@/lib/conversas/tipos';

/** Mini-kanban do corretor: deslize entre as etapas; toque no cartão para abrir a conversa. */
export default function AppFunil({ conversas, carregando }: { conversas: ConversaItem[]; carregando?: boolean }) {
  const navigate = useNavigate();
  const mover = useMoverEtapa();
  const agora = useAgora(30_000);
  const colunas = ETAPAS.filter((e) => e.valor !== 'novo');

  return (
    <>
      <Topo titulo="Funil" subtitulo={`${conversas.length} ${conversas.length === 1 ? 'cliente' : 'clientes'} · deslize para o lado`} />
      <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain p-3 [scrollbar-width:none]">
        {colunas.map((e) => {
          const itens = conversas.filter((c) => c.etapa === e.valor || (e.valor === 'em_atendimento' && c.etapa === 'novo'));
          return (
            <section key={e.valor} className="flex w-[82%] max-w-xs shrink-0 snap-center flex-col rounded-2xl bg-muted/60" aria-label={e.rotulo}>
              <header className="flex items-center gap-2 px-3 py-2.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', e.ponto)} />
                <h2 className="text-sm font-semibold">{e.rotulo}</h2>
                <span className="ml-auto rounded-full bg-card px-2 text-xs font-semibold tabular-nums">{itens.length}</span>
              </header>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {carregando && <div className="h-20 animate-pulse rounded-xl bg-card" />}
                {!carregando && !itens.length && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Ninguém nesta etapa</p>}
                {itens.map((c) => (
                  <div key={c.id} className="rounded-xl border bg-card p-3 shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <button type="button" onClick={() => navigate(`/app/c/${c.id}`)} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
                        <AvatarContato nome={nomeDaConversa(c)} chave={c.id} tamanho="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5"><span className="truncate text-sm font-semibold">{nomeDaConversa(c)}</span><Temperatura valor={c.temperatura} /></span>
                          <span className="line-clamp-2 text-xs text-muted-foreground">{c.resumo_ia ?? c.ultima_previa}</span>
                        </span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="-m-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label={`Mover ${nomeDaConversa(c)}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {ETAPAS.filter((x) => x.valor !== c.etapa && x.valor !== 'novo').map((x) => (
                            <DropdownMenuItem key={x.valor} onClick={() => mover.mutate({ id: c.id, etapa: x.valor })}>
                              <span className={cn('mr-2 h-2 w-2 rounded-full', x.ponto)} />{x.rotulo}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {c.aguardando_desde ? <Espera desde={c.aguardando_desde} agora={agora} compacto /> : <span />}
                      <span className="text-[11px] text-muted-foreground">{quandoNaLista(c.ultima_mensagem_em, new Date(agora))}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
