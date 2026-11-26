import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, BellOff, BellRing, Gauge, Inbox, PanelRight, Smartphone, Zap } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAlertas, useConversa, useListaConversas, useTempoRealConversas } from '@/hooks/conversas/dados';
import { useMensagensDoServiceWorker, usePush } from '@/hooks/conversas/usePush';
import { nomeDaConversa } from '@/lib/conversas/formato';
import type { Filtro } from '@/lib/conversas/tipos';
import { ListaConversas } from '@/components/conversas/ListaConversas';
import { ChatConversa } from '@/components/conversas/ChatConversa';
import { PainelCliente } from '@/components/conversas/PainelCliente';
import { AlertasPainel } from '@/components/conversas/AlertasPainel';
import { DesempenhoPainel } from '@/components/conversas/DesempenhoPainel';
import { NumerosPainel } from '@/components/conversas/NumerosPainel';
import { RespostasRapidasPainel } from '@/components/conversas/RespostasRapidasPainel';
import { NovaConversaDialog } from '@/components/conversas/NovaConversaDialog';
import { Simbolo } from '@/components/app/Marca';

type Aba = 'caixa' | 'alertas' | 'desempenho' | 'respostas' | 'numeros';

function BotaoPush() {
  const { estado, ocupado, ativar, desativar } = usePush();
  if (estado === 'carregando' || estado === 'indisponivel' || estado === 'instalar') return null;
  const ativo = estado === 'ativo';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" disabled={ocupado || estado === 'negado'} onClick={ativo ? desativar : ativar}
          aria-label={ativo ? 'Desativar notificações' : 'Ativar notificações'}>
          {ativo ? <BellRing className="h-5 w-5 text-primary" /> : estado === 'negado' ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="tema-memude">
        {ativo ? 'Notificações ativas neste computador' : estado === 'negado' ? 'Notificações bloqueadas no navegador' : 'Avisar aqui quando um cliente escrever'}
      </TooltipContent>
    </Tooltip>
  );
}

export default function ConversasPage() {
  const { isAdmin, user } = useAuth();
  const mobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const aba = (params.get('aba') as Aba) || 'caixa';
  const ativa = params.get('c');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');
  const [fichaAberta, setFichaAberta] = useState(true);
  const [fichaMovel, setFichaMovel] = useState(false);
  const [nova, setNova] = useState(false);

  useTempoRealConversas();
  useMensagensDoServiceWorker();
  const { data: conversas = [], isLoading, isError, refetch } = useListaConversas(filtro, busca);
  const { data: alertas = [] } = useAlertas();
  const daLista = useMemo(() => conversas.find((c) => c.id === ativa) ?? null, [conversas, ativa]);
  const { data: detalhe } = useConversa(daLista ? null : ativa);
  // Conversa aberta por link/alerta pode não estar no filtro atual: usa os dados dela mesma
  const atual = daLista ?? (detalhe ? {
    telefone: detalhe.telefone, etapa: detalhe.etapa, nome_contato: detalhe.nome_contato,
    lead_nome: (detalhe.leads as unknown as { nome?: string } | null)?.nome ?? null,
    numero_nome: (detalhe.conv_numeros as unknown as { nome?: string } | null)?.nome ?? null,
    numero_status: (detalhe.conv_numeros as unknown as { status?: string } | null)?.status ?? null,
    dono_id: detalhe.dono_id, foto_url: detalhe.foto_url,
  } : null);
  // Contador de quem espera resposta vale para todas as conversas, não só para o filtro aberto
  const { data: esperando = [] } = useListaConversas('sem_resposta', '');
  const aguardando = esperando.length;
  // Só manda o "lido" (✓✓ azul) ao cliente quem atende a conversa (ou a fila da SDR), não quem só está olhando
  const lerNoWhatsApp = !!atual && (atual.dono_id == null || atual.dono_id === user?.id);

  const mudar = useCallback((novos: Record<string, string | null>) => {
    setParams((p) => {
      const n = new URLSearchParams(p);
      Object.entries(novos).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
      return n;
    }, { replace: true });
  }, [setParams]);
  const abrir = useCallback((id: string) => mudar({ aba: null, c: id }), [mudar]);

  // Título da aba do navegador mostra quantos clientes esperam resposta
  useEffect(() => {
    const t = document.title;
    document.title = aguardando ? `(${aguardando}) Conversas · MeMude` : 'Conversas · MeMude';
    return () => { document.title = t; };
  }, [aguardando]);

  // Esc fecha a conversa
  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !ativa || e.defaultPrevented) return;
      // Esc dentro de campo, lista, menu ou janela fecha só aquilo, não a conversa
      if ((e.target as HTMLElement)?.closest('input, textarea, select, [role="dialog"], [role="listbox"], [role="menu"], [data-radix-popper-content-wrapper]')) return;
      mudar({ c: null });
    };
    window.addEventListener('keydown', ouvir);
    return () => window.removeEventListener('keydown', ouvir);
  }, [ativa, mudar]);

  const ABAS: { id: Aba; rotulo: string; icone: typeof Inbox; badge?: number; admin?: boolean }[] = [
    { id: 'caixa', rotulo: 'Conversas', icone: Inbox, badge: aguardando },
    { id: 'alertas', rotulo: 'Alertas', icone: BellRing, badge: alertas.length },
    { id: 'desempenho', rotulo: 'Desempenho', icone: Gauge },
    { id: 'respostas', rotulo: 'Respostas rápidas', icone: Zap },
    { id: 'numeros', rotulo: 'Números', icone: Smartphone, admin: true },
  ];

  const mostrarLista = !mobile || !ativa;
  const mostrarChat = !mobile || !!ativa;

  return (
    <DashboardLayout telaCheia>
      {/* Identidade visual do app MeMude vale só nesta tela (e nas janelas que ela abre) */}
      <div className="tema-memude flex h-full min-h-0 flex-col bg-background text-foreground">
        <div className="flex items-center gap-1 border-b bg-card px-2 sm:px-4">
          <nav className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Seções de conversas">
            {ABAS.filter((a) => !a.admin || isAdmin).map((a) => (
              <button key={a.id} type="button" onClick={() => mudar({ aba: a.id === 'caixa' ? null : a.id })} aria-current={aba === a.id ? 'page' : undefined}
                className={cn('flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm transition',
                  aba === a.id ? 'border-primary font-bold text-primary' : 'border-transparent font-semibold text-muted-foreground hover:text-primary')}>
                <a.icone className="h-4 w-4" aria-hidden />
                <span className={cn(a.id !== 'caixa' && 'sr-only sm:not-sr-only')}>{a.rotulo}</span>
                {!!a.badge && (
                  <span className="rounded-full bg-mm-acao px-1.5 text-[11px] font-extrabold tabular-nums text-white">
                    {a.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <BotaoPush />
        </div>

        {aba === 'caixa' ? (
          <div className="flex min-h-0 flex-1">
            {mostrarLista && (
              <div className="flex w-full min-w-0 flex-col border-r border-mm-borda-suave md:w-[340px] lg:w-[380px] md:shrink-0">
                <ListaConversas conversas={conversas} carregando={isLoading} erro={isError} aoTentar={() => refetch()} filtro={filtro} aoFiltrar={setFiltro}
                  busca={busca} aoBuscar={setBusca} ativa={ativa} aoAbrir={abrir} aoNova={() => setNova(true)} />
              </div>
            )}
            {mostrarChat && (
              <div className="flex min-w-0 flex-1">
                {ativa ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <ChatConversa key={ativa} conversaId={ativa}
                        nome={atual ? nomeDaConversa(atual) : 'Conversa'} foto={atual?.foto_url} telefone={atual?.telefone ?? ''} etapa={atual?.etapa ?? 'novo'}
                        numeroNome={atual?.numero_nome} numeroStatus={atual?.numero_status} podeResponder lerNoWhatsApp={lerNoWhatsApp}
                        aoVoltar={mobile ? () => mudar({ c: null }) : undefined}
                        aoAbrirFicha={() => (mobile || window.innerWidth < 1280 ? setFichaMovel(true) : setFichaAberta((v) => !v))}
                        acoes={(
                          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Ficha do cliente"
                            onClick={() => (mobile || window.innerWidth < 1280 ? setFichaMovel(true) : setFichaAberta((v) => !v))}>
                            <PanelRight className="h-5 w-5" />
                          </Button>
                        )} />
                    </div>
                    {fichaAberta && (
                      <aside className="hidden w-[340px] shrink-0 overflow-y-auto border-l border-mm-borda-suave bg-card xl:block" aria-label="Ficha do cliente">
                        <PainelCliente conversaId={ativa} equipe />
                      </aside>
                    )}
                  </>
                ) : (
                  <div className="hidden flex-1 flex-col items-center justify-center gap-3 bg-background p-8 text-center md:flex">
                    <Simbolo className="h-14" />
                    <h2 className="text-xl">Escolha uma conversa</h2>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      Todas as conversas dos números da MeMude ficam aqui. A IA resume e sugere; você decide.
                      Atalhos: <kbd className="rounded-md border bg-card px-1.5 text-xs font-bold">/</kbd> busca, <kbd className="rounded-md border bg-card px-1.5 text-xs font-bold">Esc</kbd> fecha.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {aba === 'alertas' && <AlertasPainel aoAbrirConversa={abrir} />}
            {aba === 'desempenho' && <DesempenhoPainel />}
            {aba === 'respostas' && <RespostasRapidasPainel />}
            {aba === 'numeros' && isAdmin && <NumerosPainel />}
          </div>
        )}
      </div>

      <Sheet open={fichaMovel && !!ativa} onOpenChange={setFichaMovel}>
        <SheetContent side="right" className="tema-memude w-full overflow-y-auto bg-card p-0 text-foreground sm:max-w-md">
          <SheetTitle className="sr-only">Ficha do cliente</SheetTitle>
          {ativa && <PainelCliente conversaId={ativa} equipe />}
        </SheetContent>
      </Sheet>
      <NovaConversaDialog aberto={nova} aoFechar={() => setNova(false)} aoAbrir={abrir} />
    </DashboardLayout>
  );
}
