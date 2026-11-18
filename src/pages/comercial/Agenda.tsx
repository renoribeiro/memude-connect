import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Filter, Move } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAtividadesPeriodo, useEmpreendimentos, useEquipe, useVisitasPeriodo } from '@/hooks/comercial/dados';
import {
  COR_STATUS_VISITA, ROTULO_STATUS_VISITA, STATUS_VISITA, STATUS_VISITA_ATIVOS,
} from '@/lib/comercial/constantes';
import { formatarHora, hojeISO, somarDias } from '@/lib/comercial/datas';
import { VisitaPainel } from '@/components/comercial/VisitaPainel';
import { useAbrirVisita } from '@/hooks/comercial/useAbrirVisita';
import { ReagendarDialog } from '@/components/comercial/AcoesVisita';
import { ComboboxBusca } from '@/components/comercial/ui';
import { nomeCorretor } from '@/lib/comercial/nomes';

type Visao = 'dia' | 'semana' | 'mes';
type Item = NonNullable<ReturnType<typeof useVisitasPeriodo>['data']>[number];
type Atividade = NonNullable<ReturnType<typeof useAtividadesPeriodo>['data']>[number];
/** Visita ou atividade agendada (próximo passo pós-visita / lembrete) na mesma grade. */
type Entrada = { id: string; hora: string; v?: Item; a?: Atividade };

const FUSO = 'America/Fortaleza';
const diaFortaleza = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(iso));
const horaFortaleza = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

const HORA_INI = 7;
const HORA_FIM = 21;
const PX_HORA = 56;
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const diaSemana = (iso: string) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
const segunda = (iso: string) => somarDias(iso, -diaSemana(iso));
const fmtTitulo = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...opts }).format(new Date(`${iso}T12:00:00Z`));
const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const arrastavel = (s: string) => [...STATUS_VISITA_ATIVOS, 'no_show'].includes(s);

function intervalo(visao: Visao, ref: string) {
  if (visao === 'dia') return { inicio: ref, fim: ref };
  if (visao === 'semana') { const s = segunda(ref); return { inicio: s, fim: somarDias(s, 6) }; }
  const [a, m] = ref.split('-').map(Number);
  const primeiro = `${ref.slice(0, 7)}-01`;
  const ultimo = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  return { inicio: segunda(primeiro), fim: somarDias(segunda(ultimo), 6) };
}

export default function AgendaPage() {
  const [visao, setVisao] = useState<Visao>(() => (window.innerWidth < 768 ? 'dia' : 'semana'));
  const [ref, setRef] = useState(hojeISO());
  const [filtros, setFiltros] = useState({ corretor: null as string | null, empreendimento: null as string | null, responsavel: null as string | null, status: [] as string[] });
  const [mostrarEncerradas, setMostrarEncerradas] = useState(true);
  const [mostrarAtividades, setMostrarAtividades] = useState(true);
  const navegarPara = useNavigate();
  const [solto, setSolto] = useState<{ item: Item; data: string; hora: string } | null>(null);
  const abrir = useAbrirVisita();
  const grade = useRef<HTMLDivElement>(null);
  const { inicio, fim } = intervalo(visao, ref);
  const { data: visitas = [], isFetching } = useVisitasPeriodo(inicio, fim);
  const { data: atividades = [] } = useAtividadesPeriodo(inicio, fim);
  const { data: equipe = [] } = useEquipe();
  const { data: empreendimentos = [] } = useEmpreendimentos();

  const corretores = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of visitas) if (v.corretor_id) m.set(v.corretor_id, nomeCorretor(v.corretores as never));
    return [...m].map(([valor, rotulo]) => ({ valor, rotulo })).sort((a, b) => a.rotulo.localeCompare(b.rotulo));
  }, [visitas]);

  const filtradas = visitas.filter((v) =>
    (!filtros.corretor || v.corretor_id === filtros.corretor)
    && (!filtros.empreendimento || v.empreendimento_id === filtros.empreendimento)
    && (!filtros.responsavel || v.criado_por === filtros.responsavel)
    && (!filtros.status.length || filtros.status.includes(v.status))
    && (mostrarEncerradas || !['cancelada', 'reagendada'].includes(v.status)));

  // Atividades aparecem quando não há filtro de visita (corretor, empreendimento, status) ativo
  const atividadesVisiveis = useMemo(() => (mostrarAtividades && !filtros.corretor && !filtros.empreendimento && !filtros.status.length
    ? atividades.filter((a) => !filtros.responsavel || a.dono_id === filtros.responsavel) : []), [mostrarAtividades, filtros, atividades]);

  const porDia = useMemo(() => {
    const m = new Map<string, Entrada[]>();
    const por = (dia: string, e: Entrada) => m.set(dia, [...(m.get(dia) ?? []), e]);
    for (const v of filtradas) por(v.data_visita, { id: v.id, hora: v.horario_visita.slice(0, 5), v });
    for (const a of atividadesVisiveis) por(diaFortaleza(a.disponivel_em), { id: `a-${a.id}`, hora: horaFortaleza(a.disponivel_em), a });
    for (const lista of m.values()) lista.sort((x, y) => x.hora.localeCompare(y.hora));
    return m;
  }, [filtradas, atividadesVisiveis]);

  const navegar = (dir: number) => setRef((r) => {
    if (visao === 'dia') return somarDias(r, dir);
    if (visao === 'semana') return somarDias(r, 7 * dir);
    const [a, m] = r.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1 + dir, 1)).toISOString().slice(0, 10);
  });
  const titulo = visao === 'dia' ? fmtTitulo(ref, { weekday: 'long', day: '2-digit', month: 'long' })
    : visao === 'semana' ? `${fmtTitulo(inicio, { day: '2-digit', month: 'short' })} – ${fmtTitulo(fim, { day: '2-digit', month: 'short', year: 'numeric' })}`
      : fmtTitulo(`${ref.slice(0, 7)}-15`, { month: 'long', year: 'numeric' });
  const nFiltros = (filtros.corretor ? 1 : 0) + (filtros.empreendimento ? 1 : 0) + (filtros.responsavel ? 1 : 0) + filtros.status.length;

  const soltar = (e: React.DragEvent, data: string, hora?: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/visita');
    const item = visitas.find((v) => v.id === id);
    if (!item) return;
    const novaHora = hora ?? item.horario_visita.slice(0, 5);
    if (data === item.data_visita && novaHora === item.horario_visita.slice(0, 5)) return;
    setSolto({ item, data, hora: novaHora });
  };

  const Evento = ({ v, compacto }: { v: Item; compacto?: boolean }) => {
    const cor = COR_STATUS_VISITA[v.status] ?? COR_STATUS_VISITA.cancelada;
    return (
      <button
        type="button"
        draggable={arrastavel(v.status)}
        onDragStart={(e) => { e.dataTransfer.setData('text/visita', v.id); e.dataTransfer.effectAllowed = 'move'; }}
        onClick={() => abrir(v.id)}
        title={`${formatarHora(v.horario_visita)} · ${(v.leads as { nome: string } | null)?.nome} · ${ROTULO_STATUS_VISITA[v.status]}`}
        className={cn('group w-full overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-xs shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          cor.bloco, arrastavel(v.status) && 'cursor-grab active:cursor-grabbing')}
      >
        <span className="flex items-center gap-1 font-semibold">
          <span className="tabular-nums">{formatarHora(v.horario_visita)}</span>
          <span className="truncate">{(v.leads as { nome: string } | null)?.nome}</span>
          {arrastavel(v.status) && <Move className="ml-auto hidden h-3 w-3 shrink-0 opacity-50 group-hover:block" aria-hidden />}
        </span>
        {!compacto && (
          <span className="block truncate opacity-80">
            {(v.empreendimentos as { nome: string } | null)?.nome} · {nomeCorretor(v.corretores as never) || 'sem corretor'}
          </span>
        )}
      </button>
    );
  };

  const EventoAtividade = ({ a, compacto }: { a: Atividade; compacto?: boolean }) => {
    const feita = a.status === 'concluida';
    const lead = a.leads as { id: string; nome: string } | null;
    const idLead = lead?.id ?? a.lead_id;
    const abrirAtividade = () => { if (a.visita_id) abrir(a.visita_id); else if (idLead) navegarPara(`/leads/${idLead}`); };
    return (
      <button type="button" onClick={abrirAtividade}
        title={`${horaFortaleza(a.disponivel_em)} · ${a.titulo ?? 'Atividade'} · ${lead?.nome ?? ''}${feita ? ' · concluída' : ''}`}
        className={cn('w-full overflow-hidden rounded-md border border-dashed border-primary/50 border-l-4 border-l-primary bg-primary/5 px-1.5 py-1 text-left text-xs text-primary-dark transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          feita && 'opacity-60')}>
        <span className="flex items-center gap-1 font-semibold">
          {feita ? <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden /> : <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />}
          <span className="tabular-nums">{horaFortaleza(a.disponivel_em)}</span>
          <span className={cn('truncate', feita && 'line-through')}>{a.titulo ?? 'Atividade'}</span>
        </span>
        {!compacto && <span className="block truncate opacity-80">{lead?.nome ?? 'Cliente'}</span>}
      </button>
    );
  };
  const ItemAgenda = ({ e, compacto }: { e: Entrada; compacto?: boolean }) =>
    e.v ? <Evento v={e.v} compacto={compacto} /> : e.a ? <EventoAtividade a={e.a} compacto={compacto} /> : null;

  // Abre a grade perto da hora atual (Fortaleza), não às 07:00
  useEffect(() => {
    if (visao === 'mes' || !grade.current) return;
    const horaAgora = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
    grade.current.scrollTop = Math.max(0, (Math.min(horaAgora, HORA_FIM - 1) - HORA_INI - 1) * PX_HORA);
  }, [visao]);

  const diasSemana = Array.from({ length: visao === 'dia' ? 1 : 7 }, (_, i) => (visao === 'dia' ? ref : somarDias(inicio, i)));
  const hoje = hojeISO();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <h1 className="mr-2 text-2xl font-bold tracking-tight">Agenda</h1>
            <Button variant="outline" size="sm" onClick={() => setRef(hojeISO())}>Hoje</Button>
            <Button variant="ghost" size="icon" onClick={() => navegar(-1)} aria-label="Período anterior"><ChevronLeft /></Button>
            <Button variant="ghost" size="icon" onClick={() => navegar(1)} aria-label="Próximo período"><ChevronRight /></Button>
            <span className="text-sm font-semibold first-letter:uppercase">{titulo}</span>
            {isFetching && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-label="Atualizando" />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Visão" className="flex rounded-lg bg-muted p-1">
              {(['dia', 'semana', 'mes'] as Visao[]).map((v) => (
                <button key={v} role="tab" type="button" aria-selected={visao === v} onClick={() => setVisao(v)}
                  className={cn('rounded-md px-3 py-1.5 text-sm font-medium capitalize', visao === v ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {v === 'mes' ? 'Mês' : v}
                </button>
              ))}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline"><Filter /> Filtros{nFiltros > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-white">{nFiltros}</span>}</Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-3">
                <div className="space-y-1.5"><p className="text-xs font-semibold uppercase text-muted-foreground">Corretor</p>
                  <ComboboxBusca opcoes={corretores} valor={filtros.corretor} permitirLimpar placeholder="Todos" onChange={(v) => setFiltros((f) => ({ ...f, corretor: v }))} /></div>
                <div className="space-y-1.5"><p className="text-xs font-semibold uppercase text-muted-foreground">Empreendimento</p>
                  <ComboboxBusca opcoes={empreendimentos.map((e) => ({ valor: e.id, rotulo: e.nome }))} valor={filtros.empreendimento} permitirLimpar placeholder="Todos"
                    onChange={(v) => setFiltros((f) => ({ ...f, empreendimento: v }))} /></div>
                <div className="space-y-1.5"><p className="text-xs font-semibold uppercase text-muted-foreground">Responsável (quem agendou)</p>
                  <Select value={filtros.responsavel ?? 'todos'} onValueChange={(v) => setFiltros((f) => ({ ...f, responsavel: v === 'todos' ? null : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="todos">Todos</SelectItem>{equipe.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.nome}</SelectItem>)}</SelectContent>
                  </Select></div>
                <fieldset className="space-y-1.5"><legend className="text-xs font-semibold uppercase text-muted-foreground">Status</legend>
                  <div className="grid grid-cols-2 gap-1">
                    {STATUS_VISITA.map((s) => (
                      <label key={s} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
                        <Checkbox checked={filtros.status.includes(s)} onCheckedChange={(c) => setFiltros((f) => ({ ...f, status: c ? [...f.status, s] : f.status.filter((x) => x !== s) }))} />
                        <span className={cn('h-2 w-2 rounded-full', COR_STATUS_VISITA[s].ponto)} />{ROTULO_STATUS_VISITA[s]}
                      </label>
                    ))}
                  </div></fieldset>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={mostrarAtividades} onCheckedChange={(c) => setMostrarAtividades(!!c)} /> Mostrar atividades (próximos passos e lembretes)</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={mostrarEncerradas} onCheckedChange={(c) => setMostrarEncerradas(!!c)} /> Mostrar canceladas e reagendadas</label>
                {nFiltros > 0 && <Button variant="ghost" size="sm" className="w-full" onClick={() => setFiltros({ corretor: null, empreendimento: null, responsavel: null, status: [] })}>Limpar filtros</Button>}
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {STATUS_VISITA.map((s) => <span key={s} className="inline-flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded-sm', COR_STATUS_VISITA[s].ponto)} />{ROTULO_STATUS_VISITA[s]}</span>)}
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-dashed border-primary bg-primary/10" />Atividade (próximo passo)</span>
          <span className="ml-auto hidden md:inline">Arraste uma visita para outro horário para reagendar.</span>
        </div>

        {visao === 'mes' && (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-semibold uppercase text-muted-foreground">
              {DIAS.map((d) => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: Math.round((new Date(`${fim}T12:00Z`).getTime() - new Date(`${inicio}T12:00Z`).getTime()) / 86400000) + 1 }, (_, i) => somarDias(inicio, i)).map((dia) => {
                const lista = porDia.get(dia) ?? [];
                const foraDoMes = dia.slice(0, 7) !== ref.slice(0, 7);
                return (
                  <div key={dia} onDragOver={(e) => e.preventDefault()} onDrop={(e) => soltar(e, dia)}
                    className={cn('min-h-28 border-b border-r p-1.5', foraDoMes && 'bg-muted/40')}>
                    <button type="button" onClick={() => { setRef(dia); setVisao('dia'); }}
                      className={cn('mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums hover:bg-muted',
                        dia === hoje && 'bg-primary text-white hover:bg-primary', foraDoMes && 'text-muted-foreground')}>
                      {Number(dia.slice(8))}
                    </button>
                    <div className="space-y-1">
                      {lista.slice(0, 3).map((e) => <ItemAgenda key={e.id} e={e} compacto />)}
                      {lista.length > 3 && (
                        <button type="button" onClick={() => { setRef(dia); setVisao('dia'); }} className="w-full rounded px-1 text-left text-xs font-medium text-primary hover:underline">
                          +{lista.length - 3} mais
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {visao !== 'mes' && (
          <>
            {visao === 'semana' && (
              <div className="space-y-3 md:hidden">
                {diasSemana.map((dia) => (
                  <section key={dia} className="rounded-xl border bg-card p-3">
                    <h2 className={cn('mb-2 text-sm font-semibold first-letter:uppercase', dia === hoje && 'text-primary')}>{fmtTitulo(dia, { weekday: 'long', day: '2-digit', month: 'short' })}</h2>
                    {(porDia.get(dia) ?? []).length ? <div className="space-y-1.5">{(porDia.get(dia) ?? []).map((e) => <ItemAgenda key={e.id} e={e} />)}</div>
                      : <p className="text-xs text-muted-foreground">Nada agendado</p>}
                  </section>
                ))}
              </div>
            )}
            <div className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', visao === 'semana' && 'hidden md:block')}>
              <div className="grid border-b bg-muted/50" style={{ gridTemplateColumns: `56px repeat(${diasSemana.length}, minmax(0, 1fr))` }}>
                <div />
                {diasSemana.map((dia) => (
                  <div key={dia} className={cn('border-l py-2 text-center', dia === hoje && 'bg-primary/5')}>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{DIAS[diaSemana(dia)]}</p>
                    <p className={cn('text-lg font-bold tabular-nums', dia === hoje && 'text-primary')}>{Number(dia.slice(8))}</p>
                  </div>
                ))}
              </div>
              <div ref={grade} className="max-h-[calc(100vh-19rem)] overflow-y-auto">
                <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${diasSemana.length}, minmax(0, 1fr))` }}>
                  <div>
                    {Array.from({ length: HORA_FIM - HORA_INI }, (_, h) => (
                      <div key={h} style={{ height: PX_HORA }} className="pr-2 text-right text-[11px] tabular-nums text-muted-foreground">{String(HORA_INI + h).padStart(2, '0')}:00</div>
                    ))}
                  </div>
                  {diasSemana.map((dia) => {
                    const lista = (porDia.get(dia) ?? []).slice();
                    const colunas: Entrada[][] = [];
                    const posicao = new Map<string, { col: number }>();
                    for (const v of lista) {
                      const ini = minutos(v.hora);
                      let c = colunas.findIndex((col) => minutos(col[col.length - 1].hora) + 60 <= ini);
                      if (c < 0) { colunas.push([v]); c = colunas.length - 1; } else colunas[c].push(v);
                      posicao.set(v.id, { col: c });
                    }
                    const total = Math.max(colunas.length, 1);
                    return (
                      <div key={dia} className={cn('relative border-l', dia === hoje && 'bg-primary/[0.03]')}>
                        {Array.from({ length: (HORA_FIM - HORA_INI) * 2 }, (_, s) => {
                          const hora = `${String(HORA_INI + Math.floor(s / 2)).padStart(2, '0')}:${s % 2 ? '30' : '00'}`;
                          return <div key={s} style={{ height: PX_HORA / 2 }} className={cn('border-b', s % 2 ? 'border-border' : 'border-dashed border-border')}
                            onDragOver={(e) => e.preventDefault()} onDrop={(e) => soltar(e, dia, hora)} aria-hidden />;
                        })}
                        {lista.map((v) => {
                          const ini = Math.max(minutos(v.hora), HORA_INI * 60);
                          const p = posicao.get(v.id)!;
                          return (
                            <div key={v.id} className="absolute px-0.5" style={{
                              top: ((ini - HORA_INI * 60) / 60) * PX_HORA, height: PX_HORA - 2,
                              left: `${(p.col / total) * 100}%`, width: `${100 / total}%`,
                            }}>
                              <ItemAgenda e={v} compacto={total > 2} />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {solto && (
        <ReagendarDialog aberto onOpenChange={(v) => !v && setSolto(null)} visita={solto.item as never}
          dataInicial={solto.data} horaInicial={solto.hora} onReagendada={(id) => { setSolto(null); abrir(id); }} />
      )}
      <VisitaPainel />
    </DashboardLayout>
  );
}
