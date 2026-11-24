import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown, ArrowUp, ArrowUpDown, CalendarPlus, ChevronLeft, ChevronRight, Columns3, Copy, Filter,
  Pencil, Search, Trash2, UserPlus, Users, X,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  chaves, type FiltroSalvo, type FiltrosLeads, type LinhaLead, useAtualizarLead, useEmpreendimentos, useEquipe, useLeadsGrade,
} from '@/hooks/comercial/dados';
import { FONTES, STATUS_ATENDIMENTO } from '@/lib/comercial/constantes';
import { formatarData, formatarHora } from '@/lib/comercial/datas';
import { NovoLeadDialog } from '@/components/comercial/NovoLeadDialog';
import { AgendarVisitaDialog } from '@/components/comercial/AgendarVisitaDialog';
import { VisitaPainel } from '@/components/comercial/VisitaPainel';
import { useAbrirVisita } from '@/hooks/comercial/useAbrirVisita';
import { ComboboxBusca, EstadoVazio, StatusAtendimentoBadge, StatusVisitaBadge } from '@/components/comercial/ui';
import { BarraSelecaoLeads, ConfirmarExclusao } from '@/components/comercial/AcoesLeads';
import { useExcluirLeads } from '@/hooks/comercial/useExcluirLeads';
import { SincronizarPlanilha } from '@/components/comercial/SincronizarPlanilha';

const FILTROS_SALVOS: { valor: FiltroSalvo; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'novos', rotulo: 'Novos' },
  { valor: 'interessados', rotulo: 'Interessados' },
  { valor: 'visitas_semana', rotulo: 'Visitas da semana' },
  { valor: 'meus', rotulo: 'Meus leads' },
];

const COLUNAS = [
  { id: 'telefone', rotulo: 'Telefone' },
  { id: 'empreendimento', rotulo: 'Empreendimento' },
  { id: 'fonte', rotulo: 'Fonte' },
  { id: 'status', rotulo: 'Status' },
  { id: 'responsavel', rotulo: 'Responsável' },
  { id: 'entrada', rotulo: 'Entrada' },
  { id: 'proxima', rotulo: 'Próxima visita' },
] as const;
type ColunaId = (typeof COLUNAS)[number]['id'];

const FILTROS_INICIAIS: FiltrosLeads = {
  busca: '', salvo: 'todos', status: [], fontes: [], responsavel: null, empreendimento: null,
  ordem: { coluna: 'data_entrada', asc: false }, pagina: 0, porPagina: 50,
};

function useColunasVisiveis(userId?: string) {
  const chave = `core.leads.colunas.${userId ?? 'anon'}`;
  const [visiveis, setVisiveis] = useState<ColunaId[]>(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(chave) ?? 'null');
      return Array.isArray(salvo) ? salvo : COLUNAS.map((c) => c.id);
    } catch {
      return COLUNAS.map((c) => c.id);
    }
  });
  useEffect(() => localStorage.setItem(chave, JSON.stringify(visiveis)), [chave, visiveis]);
  return [visiveis, setVisiveis] as const;
}

export default function LeadsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [filtros, setFiltros] = useState<FiltrosLeads>(() => ({
    ...FILTROS_INICIAIS, salvo: (params.get('filtro') as FiltroSalvo) || 'todos',
  }));
  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [novoAberto, setNovoAberto] = useState(params.get('novo') === '1');
  const [agendarPara, setAgendarPara] = useState<LinhaLead | null>(null);
  const [visiveis, setVisiveis] = useColunasVisiveis(user?.id);
  const abrirVisita = useAbrirVisita();
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [excluirAlvo, setExcluirAlvo] = useState<{ ids: string[]; nome?: string } | null>(null);
  const exclusao = useExcluirLeads();

  const { data, isLoading, isFetching, isError, refetch } = useLeadsGrade(filtros);
  const { data: equipe = [] } = useEquipe();
  const { data: empreendimentos = [] } = useEmpreendimentos();
  const atualizar = useAtualizarLead();

  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.busca === buscaDigitada ? f : { ...f, busca: buscaDigitada, pagina: 0 })), 300);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  useEffect(() => {
    if (params.get('novo') === '1') {
      setNovoAberto(true);
      params.delete('novo');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  // Trocar filtro, busca ou página limpa a seleção (evita excluir o que não está na tela)
  useEffect(() => { setSelecionados(new Set()); }, [filtros]);

  const nomes = useMemo(() => new Map(equipe.map((u) => [u.user_id, u.nome])), [equipe]);
  const responsaveis = useMemo(() => equipe.filter((u) => u.responsavel), [equipe]);
  const nomeEmp = useMemo(() => new Map(empreendimentos.map((e) => [e.id, e.nome])), [empreendimentos]);
  const opcoesEmp = useMemo(() => empreendimentos.map((e) => ({ valor: e.id, rotulo: e.nome, detalhe: e.bairro })), [empreendimentos]);

  const salvarCampo = (linha: LinhaLead, campo: string, valor: unknown) => {
    const anterior = qc.getQueriesData({ queryKey: chaves.leads });
    qc.setQueriesData<{ linhas: LinhaLead[]; total: number }>({ queryKey: chaves.leads }, (atual) => atual && ({
      ...atual,
      linhas: atual.linhas.map((l) => (l.id === linha.id ? { ...l, [campo === 'telefone' ? 'telefone_exibicao' : campo]: valor } : l)),
    }));
    atualizar.mutate({ id: linha.id, campos: { [campo]: valor } }, {
      onError: () => anterior.forEach(([k, v]) => qc.setQueryData(k, v)),
    });
  };

  const ordenar = (coluna: FiltrosLeads['ordem']['coluna']) =>
    setFiltros((f) => ({ ...f, pagina: 0, ordem: { coluna, asc: f.ordem.coluna === coluna ? !f.ordem.asc : coluna !== 'data_entrada' } }));

  const filtrosAtivos = filtros.status.length + filtros.fontes.length + (filtros.responsavel ? 1 : 0) + (filtros.empreendimento ? 1 : 0);
  const total = data?.total ?? 0;
  const inicio = total ? filtros.pagina * filtros.porPagina + 1 : 0;
  const fim = Math.min(total, (filtros.pagina + 1) * filtros.porPagina);
  const mostrar = (c: ColunaId) => visiveis.includes(c);
  const linhasPagina = data?.linhas ?? [];
  const todosMarcados = linhasPagina.length > 0 && linhasPagina.every((l) => selecionados.has(l.id));
  const algunsMarcados = !todosMarcados && linhasPagina.some((l) => selecionados.has(l.id));
  const alternar = (id: string, marcar: boolean) => setSelecionados((atual) => {
    const novo = new Set(atual);
    if (marcar) novo.add(id); else novo.delete(id);
    return novo;
  });
  const alternarPagina = (marcar: boolean) => setSelecionados((atual) => {
    const novo = new Set(atual);
    for (const l of linhasPagina) { if (marcar) novo.add(l.id); else novo.delete(l.id); }
    return novo;
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1600px] space-y-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Carregando…' : `${total.toLocaleString('pt-BR')} ${total === 1 ? 'lead' : 'leads'}`} · clique na célula para editar
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SincronizarPlanilha />
            <Button onClick={() => setNovoAberto(true)}><UserPlus /> Novo lead</Button>
          </div>
        </header>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={buscaDigitada} onChange={(e) => setBuscaDigitada(e.target.value)}
              placeholder="Buscar por nome ou telefone" className="pl-9" aria-label="Buscar leads" />
            {buscaDigitada && (
              <button type="button" onClick={() => setBuscaDigitada('')} aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div role="tablist" aria-label="Filtros salvos" className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
            {FILTROS_SALVOS.map((f) => (
              <button key={f.valor} role="tab" type="button" aria-selected={filtros.salvo === f.valor}
                onClick={() => setFiltros((x) => ({ ...x, salvo: f.valor, pagina: 0 }))}
                className={cn('whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  filtros.salvo === f.valor ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {f.rotulo}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="relative">
                  <Filter /> Filtros
                  {filtrosAtivos > 0 && <Badge className="ml-1 h-5 min-w-5 justify-center px-1">{filtrosAtivos}</Badge>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-4">
                <FiltroMulti titulo="Status" opcoes={[...STATUS_ATENDIMENTO]} valores={filtros.status}
                  onChange={(v) => setFiltros((f) => ({ ...f, status: v, pagina: 0 }))} />
                <FiltroMulti titulo="Fonte" opcoes={[...FONTES]} valores={filtros.fontes}
                  onChange={(v) => setFiltros((f) => ({ ...f, fontes: v, pagina: 0 }))} />
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsável</p>
                  <Select value={filtros.responsavel ?? 'todos'}
                    onValueChange={(v) => setFiltros((f) => ({ ...f, responsavel: v === 'todos' ? null : v, pagina: 0 }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="sem">Sem responsável</SelectItem>
                      {responsaveis.map((r) => <SelectItem key={r.user_id} value={r.user_id}>{r.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empreendimento</p>
                  <ComboboxBusca opcoes={opcoesEmp} valor={filtros.empreendimento} permitirLimpar placeholder="Todos"
                    onChange={(v) => setFiltros((f) => ({ ...f, empreendimento: v, pagina: 0 }))} />
                </div>
                {filtrosAtivos > 0 && (
                  <Button variant="ghost" size="sm" className="w-full"
                    onClick={() => setFiltros((f) => ({ ...f, status: [], fontes: [], responsavel: null, empreendimento: null, pagina: 0 }))}>
                    Limpar filtros
                  </Button>
                )}
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Escolher colunas"><Columns3 /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COLUNAS.map((c) => (
                  <DropdownMenuCheckboxItem key={c.id} checked={mostrar(c.id)} onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(v) => setVisiveis((atual) => (v ? [...atual, c.id] : atual.filter((x) => x !== c.id)))}>
                    {c.rotulo}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/leads/classico">Abrir visão anterior</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {selecionados.size > 0 && (
          <BarraSelecaoLeads ids={[...selecionados]} responsaveis={responsaveis}
            onLimpar={() => setSelecionados(new Set())}
            onExcluir={() => setExcluirAlvo({ ids: [...selecionados] })} />
        )}

        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="relative max-h-[calc(100vh-17rem)] overflow-auto">
            {isFetching && !isLoading && <div className="absolute inset-x-0 top-0 z-20 h-0.5 animate-pulse bg-primary" />}
            <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 w-10 border-b bg-muted/50 px-3 py-2.5">
                    <Checkbox checked={todosMarcados ? true : algunsMarcados ? 'indeterminate' : false}
                      onCheckedChange={(v) => alternarPagina(v === true)} aria-label="Selecionar todos os leads da página" />
                  </th>
                  <Th className="sticky left-10 z-10 bg-muted/50" ordenavel ativa={filtros.ordem.coluna === 'nome'} asc={filtros.ordem.asc} onClick={() => ordenar('nome')}>Nome</Th>
                  {mostrar('telefone') && <Th>Telefone</Th>}
                  {mostrar('empreendimento') && <Th>Empreendimento</Th>}
                  {mostrar('fonte') && <Th ordenavel ativa={filtros.ordem.coluna === 'fonte'} asc={filtros.ordem.asc} onClick={() => ordenar('fonte')}>Fonte</Th>}
                  {mostrar('status') && <Th ordenavel ativa={filtros.ordem.coluna === 'status_atendimento'} asc={filtros.ordem.asc} onClick={() => ordenar('status_atendimento')}>Status</Th>}
                  {mostrar('responsavel') && <Th>Responsável</Th>}
                  {mostrar('entrada') && <Th ordenavel ativa={filtros.ordem.coluna === 'data_entrada'} asc={filtros.ordem.asc} onClick={() => ordenar('data_entrada')}>Entrada</Th>}
                  {mostrar('proxima') && <Th>Próxima visita</Th>}
                  <Th className="w-24"><span className="sr-only">Ações</span></Th>
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 10 }).map((__, j) => <td key={j} className="border-b px-3 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))}
                {!isLoading && data?.linhas.map((l) => (
                  <tr key={l.id} className={cn('group hover:bg-muted/60', selecionados.has(l.id) && 'bg-primary/[0.04]')}>
                    <td className="sticky left-0 z-[1] w-10 border-b bg-card px-3 py-1.5 group-hover:bg-muted/60">
                      <Checkbox checked={selecionados.has(l.id)} onCheckedChange={(v) => alternar(l.id, v === true)} aria-label={`Selecionar ${l.nome}`} />
                    </td>
                    <td className="sticky left-10 z-[1] border-b bg-card px-3 py-1.5 group-hover:bg-muted/60">
                      <CelulaNome linha={l} onSalvar={(v) => salvarCampo(l, 'nome', v)} />
                    </td>
                    {mostrar('telefone') && (
                      <td className="border-b px-1 py-1.5">
                        <CelulaTexto valor={l.telefone_exibicao ?? l.telefone} rotulo="telefone" mono
                          onSalvar={(v) => salvarCampo(l, 'telefone', v)} copiavel />
                      </td>
                    )}
                    {mostrar('empreendimento') && (
                      <td className="max-w-[240px] border-b px-1 py-1.5">
                        <ComboboxBusca opcoes={opcoesEmp} valor={l.empreendimento_id} permitirLimpar
                          placeholder={(l.planilha_extra?.empreendimento as string) ? `Planilha: ${l.planilha_extra?.empreendimento}` : '—'}
                          className="h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input"
                          onChange={(v) => salvarCampo(l, 'empreendimento_id', v)} />
                        <span className="sr-only">{nomeEmp.get(l.empreendimento_id ?? '')}</span>
                      </td>
                    )}
                    {mostrar('fonte') && (
                      <td className="border-b px-1 py-1.5">
                        <CelulaSelect valor={l.fonte ?? ''} opcoes={[...FONTES]} vazio="—" onSalvar={(v) => salvarCampo(l, 'fonte', v)} />
                      </td>
                    )}
                    {mostrar('status') && (
                      <td className="border-b px-1 py-1.5">
                        <Select value={l.status_atendimento} onValueChange={(v) => salvarCampo(l, 'status_atendimento', v)}>
                          <SelectTrigger className="h-8 w-auto gap-2 border-transparent bg-transparent px-2 shadow-none hover:border-input" aria-label="Status de atendimento">
                            <StatusAtendimentoBadge status={l.status_atendimento} />
                          </SelectTrigger>
                          <SelectContent>{STATUS_ATENDIMENTO.map((s) => <SelectItem key={s} value={s}><StatusAtendimentoBadge status={s} /></SelectItem>)}</SelectContent>
                        </Select>
                        {typeof l.planilha_extra?.status_label === 'string' && (
                          <p className="px-2 text-[11px] text-muted-foreground">Planilha: {l.planilha_extra.status_label}</p>
                        )}
                      </td>
                    )}
                    {mostrar('responsavel') && (
                      <td className="border-b px-1 py-1.5">
                        <Select value={l.responsavel_id ?? 'nenhum'} onValueChange={(v) => salvarCampo(l, 'responsavel_id', v === 'nenhum' ? null : v)}>
                          <SelectTrigger className="h-8 w-40 border-transparent bg-transparent px-2 shadow-none hover:border-input" aria-label="Responsável">
                            <span className={cn('truncate', !l.responsavel_id && 'text-muted-foreground')}>
                              {l.responsavel_id ? nomes.get(l.responsavel_id) ?? '…' : (l.planilha_extra?.responsavel as string) ? `${l.planilha_extra?.responsavel} (planilha)` : '—'}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nenhum">Sem responsável</SelectItem>
                            {responsaveis.map((r) => <SelectItem key={r.user_id} value={r.user_id}>{r.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                    {mostrar('entrada') && <td className="whitespace-nowrap border-b px-3 py-1.5 tabular-nums text-muted-foreground">{formatarData(l.data_entrada)}</td>}
                    {mostrar('proxima') && (
                      <td className="whitespace-nowrap border-b px-3 py-1.5">
                        {l.proxima_visita ? (
                          <button type="button" onClick={() => abrirVisita(l.proxima_visita!.id)} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-muted">
                            <span className="tabular-nums">{formatarData(l.proxima_visita.data_visita)} {formatarHora(l.proxima_visita.horario_visita)}</span>
                            <StatusVisitaBadge status={l.proxima_visita.status} />
                          </button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    )}
                    <td className="whitespace-nowrap border-b px-2 py-1.5 text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setAgendarPara(l)} aria-label={`Agendar visita para ${l.nome}`}>
                            <CalendarPlus />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Agendar visita</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => setExcluirAlvo({ ids: [l.id], nome: l.nome })} aria-label={`Excluir ${l.nome}`}>
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir lead</TooltipContent>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && isError && (
              <div className="p-6"><EstadoVazio icone={Users} titulo="Não foi possível carregar os leads"
                acao={<Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>} /></div>
            )}
            {!isLoading && !isError && data?.linhas.length === 0 && (
              <div className="p-6">
                <EstadoVazio icone={Users} titulo="Nenhum lead encontrado"
                  descricao={filtros.busca || filtrosAtivos || filtros.salvo !== 'todos' ? 'Ajuste a busca ou os filtros.' : 'Cadastre o primeiro lead.'}
                  acao={<Button onClick={() => setNovoAberto(true)}><UserPlus /> Lead</Button>} />
              </div>
            )}
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-4 py-2.5 text-sm">
            <span className="tabular-nums text-muted-foreground">
              {total ? `${inicio.toLocaleString('pt-BR')}–${fim.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}` : '0 resultados'}
            </span>
            <div className="flex items-center gap-2">
              <Select value={String(filtros.porPagina)} onValueChange={(v) => setFiltros((f) => ({ ...f, porPagina: Number(v), pagina: 0 }))}>
                <SelectTrigger className="h-8 w-[110px]" aria-label="Linhas por página"><SelectValue /></SelectTrigger>
                <SelectContent>{[25, 50, 100, 200].map((n) => <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>)}</SelectContent>
              </Select>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={filtros.pagina === 0}
                onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina - 1 }))} aria-label="Página anterior"><ChevronLeft /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={fim >= total}
                onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina + 1 }))} aria-label="Próxima página"><ChevronRight /></Button>
            </div>
          </footer>
        </div>
      </div>

      <NovoLeadDialog aberto={novoAberto} onOpenChange={setNovoAberto} />
      <ConfirmarExclusao aberto={!!excluirAlvo} onOpenChange={(v) => !v && setExcluirAlvo(null)}
        quantidade={excluirAlvo?.ids.length ?? 0} nome={excluirAlvo?.nome} pendente={exclusao.pendente}
        onConfirmar={() => excluirAlvo && exclusao.executar(excluirAlvo.ids, () => {
          setSelecionados((atual) => { const novo = new Set(atual); excluirAlvo.ids.forEach((id) => novo.delete(id)); return novo; });
          setExcluirAlvo(null);
        })} />
      {agendarPara && (
        <AgendarVisitaDialog aberto onOpenChange={(v) => !v && setAgendarPara(null)}
          lead={{ id: agendarPara.id, nome: agendarPara.nome, empreendimento_id: agendarPara.empreendimento_id, fonte: agendarPara.fonte }}
          onAgendada={(id) => { setAgendarPara(null); abrirVisita(id); }} />
      )}
      <VisitaPainel />
    </DashboardLayout>
  );
}

function Th({ children, className, ordenavel, ativa, asc, onClick }: {
  children: React.ReactNode; className?: string; ordenavel?: boolean; ativa?: boolean; asc?: boolean; onClick?: () => void;
}) {
  const Icone = !ativa ? ArrowUpDown : asc ? ArrowUp : ArrowDown;
  return (
    <th scope="col" className={cn('whitespace-nowrap border-b px-3 py-2.5', className)}
      aria-sort={ativa ? (asc ? 'ascending' : 'descending') : undefined}>
      {ordenavel ? (
        <button type="button" onClick={onClick} className="inline-flex items-center gap-1 uppercase hover:text-foreground">
          {children}<Icone className={cn('h-3.5 w-3.5', !ativa && 'opacity-40')} />
        </button>
      ) : children}
    </th>
  );
}

function FiltroMulti({ titulo, opcoes, valores, onChange }: {
  titulo: string; opcoes: string[]; valores: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</legend>
      <div className="grid grid-cols-2 gap-1">
        {opcoes.map((o) => (
          <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
            <Checkbox checked={valores.includes(o)}
              onCheckedChange={(v) => onChange(v ? [...valores, o] : valores.filter((x) => x !== o))} />
            <span className="truncate">{o}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function useEdicao(valor: string, onSalvar: (v: string) => void) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(valor);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editando) setRascunho(valor); }, [valor, editando]);
  useEffect(() => { if (editando) ref.current?.select(); }, [editando]);
  const confirmar = () => {
    setEditando(false);
    if (rascunho.trim() && rascunho.trim() !== valor) onSalvar(rascunho.trim());
  };
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
    if (e.key === 'Escape') { setRascunho(valor); setEditando(false); }
  };
  return { editando, setEditando, rascunho, setRascunho, ref, confirmar, teclas };
}

function CelulaNome({ linha, onSalvar }: { linha: LinhaLead; onSalvar: (v: string) => void }) {
  const e = useEdicao(linha.nome, onSalvar);
  if (e.editando) {
    return <Input ref={e.ref} value={e.rascunho} onChange={(x) => e.setRascunho(x.target.value)} onBlur={e.confirmar} onKeyDown={e.teclas}
      className="h-8 w-56" aria-label="Nome do lead" maxLength={120} />;
  }
  return (
    <div className="flex min-w-[200px] items-center gap-1">
      <Link to={`/leads/${linha.id}`} className="truncate font-medium text-foreground hover:text-primary hover:underline">{linha.nome}</Link>
      {linha.telefone_chave_conflito && (
        <Tooltip>
          <TooltipTrigger asChild><span className="rounded bg-amber-100 px-1.5 text-[10px] font-semibold uppercase text-amber-800">Duplicado</span></TooltipTrigger>
          <TooltipContent className="max-w-xs">Outro lead ativo tem o mesmo telefone. Nada foi mesclado: decida na tela de ajustes.</TooltipContent>
        </Tooltip>
      )}
      <button type="button" onClick={() => e.setEditando(true)} aria-label={`Editar nome de ${linha.nome}`}
        className="ml-auto rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus:opacity-100 group-hover:opacity-100">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CelulaTexto({ valor, onSalvar, rotulo, mono, copiavel }: {
  valor: string; onSalvar: (v: string) => void; rotulo: string; mono?: boolean; copiavel?: boolean;
}) {
  const e = useEdicao(valor, onSalvar);
  const [copiado, setCopiado] = useState(false);
  if (e.editando) {
    return <Input ref={e.ref} value={e.rascunho} onChange={(x) => e.setRascunho(x.target.value)} onBlur={e.confirmar} onKeyDown={e.teclas}
      className={cn('h-8 w-44', mono && 'tabular-nums')} aria-label={rotulo} inputMode="tel" />;
  }
  return (
    <div className="flex min-w-[11rem] items-center">
      <button type="button" onClick={() => e.setEditando(true)}
        className={cn('w-full whitespace-nowrap rounded px-2 py-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', mono && 'tabular-nums')}
        aria-label={`Editar ${rotulo}: ${valor}`}>
        {valor || <span className="text-muted-foreground">—</span>}
      </button>
      {copiavel && valor && (
        <button type="button" aria-label={`Copiar ${rotulo}`}
          onClick={async () => { await navigator.clipboard.writeText(valor.replace(/\D/g, '')); setCopiado(true); setTimeout(() => setCopiado(false), 1200); }}
          className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted focus:opacity-100 group-hover:opacity-100">
          {copiado ? <span className="text-[10px] font-semibold text-primary">OK</span> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

function CelulaSelect({ valor, opcoes, vazio, onSalvar }: { valor: string; opcoes: string[]; vazio: string; onSalvar: (v: string) => void }) {
  return (
    <Select value={valor || undefined} onValueChange={onSalvar}>
      <SelectTrigger className="h-8 w-32 border-transparent bg-transparent px-2 shadow-none hover:border-input">
        <SelectValue placeholder={vazio} />
      </SelectTrigger>
      <SelectContent>{opcoes.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

