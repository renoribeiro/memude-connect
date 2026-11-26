import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronRight, MoreHorizontal, Search, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BotaoTopo, Topo } from '@/components/app/Topo';
import { FalhaCarregar, Segmentado, Vazio } from '@/components/app/ui';
import { AvatarContato, EtapaBadge, Espera, Temperatura } from '@/components/conversas/pecas';
import { useMoverEtapa } from '@/hooks/conversas/dados';
import { useMeusClientes } from '@/hooks/conversas/app';
import { useAgora } from '@/hooks/conversas/useAgora';
import { diaCurto, plural } from '@/lib/conversas/agenda';
import { nomeDaConversa, quandoNaLista } from '@/lib/conversas/formato';
import { ETAPAS, type ConversaItem } from '@/lib/conversas/tipos';

type Aba = 'funil' | 'lista';
type Filtro = 'todos' | 'esperando' | 'parados' | 'visita';
const TRES_DIAS = 3 * 86_400_000;
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' }, { valor: 'esperando', rotulo: 'Esperando' },
  { valor: 'parados', rotulo: 'Parados 3 dias+' }, { valor: 'visita', rotulo: 'Com visita' },
];

const casa = (texto: string, nome: string, telefone: string) => {
  const t = texto.trim().toLowerCase();
  if (!t) return true;
  const d = t.replace(/\D/g, '');
  return nome.toLowerCase().includes(t) || (d.length >= 3 && telefone.includes(d));
};

/** Clientes do corretor: funil por etapa (deslizar) ou lista com próxima visita. */
export default function AppClientes({ conversas, carregando, erro, tentar }: {
  conversas: ConversaItem[]; carregando?: boolean; erro?: boolean; tentar?: () => void;
}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filtroUrl = params.get('filtro') as Filtro | null;
  const [aba, setAba] = useState<Aba>(filtroUrl ? 'lista' : 'funil');
  const [filtro, setFiltro] = useState<Filtro>(filtroUrl ?? 'todos');
  const [buscando, setBuscando] = useState(false);
  const [busca, setBusca] = useState('');
  const agora = useAgora(30_000);
  const mover = useMoverEtapa();
  const clientes = useMeusClientes();

  const emAndamento = conversas.filter((c) => !['vendido', 'perdido'].includes(c.etapa)).length;
  const doFunil = useMemo(() => conversas.filter((c) => casa(busca, nomeDaConversa(c), c.telefone)), [conversas, busca]);
  const daLista = useMemo(() => (clientes.data ?? []).filter((c) => casa(busca, c.nome, c.telefone) && (
    filtro === 'todos' ? true
      : filtro === 'esperando' ? !!c.aguardando_desde
        : filtro === 'parados' ? !c.aguardando_desde && !!c.ultima_mensagem_em && agora - new Date(c.ultima_mensagem_em).getTime() > TRES_DIAS && !['vendido', 'perdido'].includes(c.etapa)
          : !!c.proxima_visita
  )), [clientes.data, busca, filtro, agora]);
  const colunas = ETAPAS.filter((e) => e.valor !== 'novo');
  const trilho = useRef<HTMLDivElement>(null);
  const naEtapa = (c: ConversaItem, etapa: string) => c.etapa === etapa || (etapa === 'em_atendimento' && c.etapa === 'novo');
  const irPara = (etapa: string) => trilho.current?.querySelector<HTMLElement>(`[data-etapa="${etapa}"]`)
    ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

  const trocarFiltro = (f: Filtro) => {
    setFiltro(f);
    if (params.has('filtro')) { params.delete('filtro'); setParams(params, { replace: true }); }
  };

  return (
    <>
      <Topo titulo="Clientes" subtitulo={`${plural(conversas.length, 'cliente', 'clientes')} · ${emAndamento} em andamento`}
        direita={(
          <BotaoTopo rotulo={buscando ? 'Fechar busca' : 'Buscar cliente'} ativo={buscando}
            aoTocar={() => { setBuscando((b) => !b); setBusca(''); }}>
            {buscando ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </BotaoTopo>
        )}
        abaixo={(
          <div className="space-y-3">
            {buscando && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou telefone" aria-label="Buscar cliente"
                  className="h-12 pl-10 text-base" inputMode="search" />
              </div>
            )}
            <Segmentado<Aba> rotulo="Visualização" valor={aba} aoMudar={setAba}
              opcoes={[{ valor: 'funil', rotulo: 'Funil' }, { valor: 'lista', rotulo: 'Lista' }]} />
          </div>
        )} />

      {erro && !conversas.length && <div className="px-5 pt-2"><FalhaCarregar aoTentar={() => tentar?.()} texto="Não foi possível carregar seus clientes." /></div>}

      {aba === 'funil' ? (
        <>
          <nav aria-label="Ir para a etapa" className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-1 pt-2 [scrollbar-width:none]">
            {colunas.map((e) => (
              <button key={e.valor} type="button" onClick={() => irPara(e.valor)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground transition active:scale-95">
                <span className={cn('h-2 w-2 rounded-full', e.ponto)} aria-hidden />{e.rotulo}
                <span className="tabular-nums text-muted-foreground">{doFunil.filter((c) => naEtapa(c, e.valor)).length}</span>
              </button>
            ))}
          </nav>
          <div ref={trilho} className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-5 pb-4 pt-2 [scrollbar-width:none]">
            {colunas.map((e) => {
              const itens = doFunil.filter((c) => naEtapa(c, e.valor));
              return (
                <section key={e.valor} data-etapa={e.valor} className="flex w-[84%] max-w-xs shrink-0 snap-center flex-col rounded-[22px] bg-mm-lilas/70" aria-label={e.rotulo}>
                  <header className="flex items-center gap-2 px-3.5 py-3">
                    <span className={cn('h-2.5 w-2.5 rounded-full', e.ponto)} aria-hidden />
                    <h2 className="text-[15px]">{e.rotulo}</h2>
                    <span className="ml-auto rounded-full bg-card px-2 text-[11px] font-extrabold tabular-nums text-primary">{itens.length}</span>
                  </header>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                    {carregando && <div className="h-20 animate-pulse rounded-2xl bg-card" />}
                    {!carregando && !itens.length && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Ninguém nesta etapa</p>}
                    {itens.map((c) => (
                      <div key={c.id} className="rounded-2xl border border-mm-borda-suave bg-card p-3">
                        <div className="flex items-start gap-2.5">
                          <button type="button" onClick={() => navigate(`/app/c/${c.id}`)} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
                            <AvatarContato nome={nomeDaConversa(c)} chave={c.id} tamanho="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5"><span className="truncate text-sm font-bold">{nomeDaConversa(c)}</span><Temperatura valor={c.temperatura} /></span>
                              <span className="line-clamp-2 text-xs text-muted-foreground">{c.resumo_ia ?? c.ultima_previa}</span>
                            </span>
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="-m-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label={`Mover ${nomeDaConversa(c)} de etapa`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl">
                              <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {ETAPAS.filter((x) => x.valor !== c.etapa && x.valor !== 'novo').map((x) => (
                                <DropdownMenuItem key={x.valor} onClick={() => mover.mutate({ id: c.id, etapa: x.valor })}>
                                  <span className={cn('mr-2 h-2 w-2 rounded-full', x.ponto)} aria-hidden />{x.rotulo}
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
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-2">
          <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]" role="tablist" aria-label="Filtrar clientes">
            {FILTROS.map((f) => (
              <button key={f.valor} type="button" role="tab" aria-selected={filtro === f.valor} onClick={() => trocarFiltro(f.valor)}
                className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition',
                  filtro === f.valor ? 'border-primary bg-primary font-bold text-primary-foreground' : 'border-border bg-card font-semibold text-muted-foreground')}>
                {f.rotulo}
              </button>
            ))}
          </div>
          {clientes.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
          ) : clientes.isError && !clientes.data?.length ? (
            <FalhaCarregar aoTentar={() => clientes.refetch()} texto="Não foi possível carregar seus clientes." />
          ) : !daLista.length ? (
            <Vazio icone={Users} titulo={busca ? 'Ninguém encontrado' : filtro === 'todos' ? 'Nenhum cliente ainda' : 'Ninguém neste filtro'}
              texto={busca ? 'Tente outro nome ou parte do telefone.' : filtro === 'todos' ? 'Quando você aceitar um cliente novo, ele aparece aqui.' : 'Volte para "Todos" para ver seus clientes.'} />
          ) : (
            <ul className="space-y-2">
              {daLista.map((c) => {
                const visita = c.proxima_visita as { data?: string; hora?: string } | null;
                return (
                  <li key={c.conversa_id}>
                    <button type="button" onClick={() => navigate(`/app/c/${c.conversa_id}`)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-mm-borda-suave bg-card p-3 text-left transition active:scale-[0.99]">
                      <AvatarContato nome={c.nome} chave={c.conversa_id} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5"><span className="truncate text-[15px] font-bold">{c.nome}</span><Temperatura valor={c.temperatura} /></span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <EtapaBadge etapa={c.etapa} />
                          {visita?.data && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-mm-rosa-claro px-2 py-0.5 text-[11px] font-extrabold text-mm-rosa-texto">
                              <CalendarDays className="h-3 w-3" aria-hidden /> {diaCurto(visita.data)} {visita.hora}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {[c.empreendimento, quandoNaLista(c.ultima_mensagem_em, new Date(agora))].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {c.aguardando_desde ? <Espera desde={c.aguardando_desde} agora={agora} compacto /> : <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
