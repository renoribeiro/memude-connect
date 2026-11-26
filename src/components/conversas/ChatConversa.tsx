import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, Loader2, Lock, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { mesmoDia, separadorDia, telefoneLegivel } from '@/lib/conversas/formato';
import type { MensagemLocal } from '@/lib/conversas/tipos';
import { useQueryClient } from '@tanstack/react-query';
import { cc, useEnviarMensagem, useMarcarLida, useMensagens, useReenviar, useSugestoes } from '@/hooks/conversas/dados';
import { Bolha } from './Bolha';
import { Composer } from './Composer';
import { AvatarContato, EtapaBadge } from './pecas';

interface Props {
  conversaId: string;
  nome: string;
  /** Foto do WhatsApp do cliente (copiada para o nosso armazenamento) */
  foto?: string | null;
  telefone: string;
  etapa: string;
  numeroNome?: string | null;
  numeroStatus?: string | null;
  podeResponder: boolean;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  aoVoltar?: () => void;
  aoAbrirFicha?: () => void;
  compacto?: boolean;
  /** Manda o "lido" (✓✓ azul) ao cliente; padrão: quem pode responder. */
  lerNoWhatsApp?: boolean;
  /** Conteúdo fixo no topo da conversa (ex.: resumo do atendimento anterior para o corretor). */
  topo?: ReactNode;
}

const PERTO_DO_FIM = 160;

export function ChatConversa({
  conversaId, nome, foto, telefone, etapa, numeroNome, numeroStatus, podeResponder, subtitulo, acoes, aoVoltar, aoAbrirFicha, compacto, lerNoWhatsApp, topo,
}: Props) {
  const [limite, setLimite] = useState(120);
  const { data: msgs = [], isLoading, isFetching } = useMensagens(conversaId, limite);
  const { data: sugestoes = [] } = useSugestoes(conversaId);
  const reenviar = useReenviar();
  const enviar = useEnviarMensagem();
  const qc = useQueryClient();
  const marcarLida = useMarcarLida();
  const [respondeA, setRespondeA] = useState<MensagemLocal | null>(null);
  const [novasAbaixo, setNovasAbaixo] = useState(0);
  const lista = useRef<HTMLDivElement>(null);
  const noFim = useRef(true);
  const qtdAnterior = useRef(0);
  const alturaAntes = useRef<number | null>(null);

  useEffect(() => { setLimite(120); setRespondeA(null); setNovasAbaixo(0); noFim.current = true; qtdAnterior.current = 0; }, [conversaId]);

  const porId = useMemo(() => new Map(msgs.map((m) => [m.id, m])), [msgs]);
  const ultimaEntrada = useMemo(() => [...msgs].reverse().find((m) => m.direcao === 'entrada')?.id, [msgs]);

  // Marca como lida ao abrir, quando chega mensagem nova com a conversa na tela e ao voltar para a aba
  useEffect(() => {
    if (!ultimaEntrada) return;
    const marcar = () => { if (document.visibilityState === 'visible') marcarLida(conversaId, ultimaEntrada, lerNoWhatsApp ?? podeResponder); };
    marcar();
    document.addEventListener('visibilitychange', marcar);
    return () => document.removeEventListener('visibilitychange', marcar);
  }, [conversaId, ultimaEntrada, podeResponder, lerNoWhatsApp, marcarLida]);

  // "Carregar anteriores" que não trouxe nada novo não pode deixar a âncora de rolagem armada
  useEffect(() => { if (!isFetching) alturaAntes.current = null; }, [isFetching]);

  // Rolagem: fica no fim enquanto a pessoa estiver lá; senão mostra "novas mensagens"
  useLayoutEffect(() => {
    const el = lista.current;
    if (!el) return;
    if (alturaAntes.current != null) {
      el.scrollTop = el.scrollHeight - alturaAntes.current;
      alturaAntes.current = null;
    } else if (noFim.current || qtdAnterior.current === 0) {
      el.scrollTop = el.scrollHeight;
    } else if (msgs.length > qtdAnterior.current) {
      setNovasAbaixo((n) => n + (msgs.length - qtdAnterior.current));
    }
    qtdAnterior.current = msgs.length;
  }, [msgs.length]);

  const aoRolar = () => {
    const el = lista.current;
    if (!el) return;
    noFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < PERTO_DO_FIM;
    if (noFim.current) setNovasAbaixo(0);
  };
  const descer = () => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: 'smooth' });
    setNovasAbaixo(0);
  };
  const carregarAnteriores = () => {
    alturaAntes.current = lista.current?.scrollHeight ?? null;
    setLimite((l) => l + 120);
  };

  // Resposta sugerida só faz sentido enquanto o cliente espera (última mensagem é dele)
  const ultimaConversa = useMemo(() => [...msgs].reverse().find((m) => m.direcao !== 'nota'), [msgs]);
  const sugestaoResposta = ultimaConversa?.direcao === 'entrada' ? sugestoes.find((s) => s.tipo === 'resposta') ?? null : null;
  const tentarDeNovo = (m: MensagemLocal) => {
    if (!m.local) { reenviar.mutate(m.id); return; }
    // Falhou antes de chegar ao servidor: tira a bolha e manda de novo
    qc.setQueryData<MensagemLocal[]>(cc.msgs(conversaId), (a) => (a ?? []).filter((x) => x.id !== m.id));
    if (m.previaUrl) URL.revokeObjectURL(m.previaUrl);
    enviar.mutate({ conversaId, texto: m.texto ?? undefined, arquivo: m.arquivo, duracaoS: m.duracao_s ?? undefined, respondeA: m.responde_a ? porId.get(m.responde_a) ?? null : null });
  };
  const desconectado = numeroStatus && numeroStatus !== 'aberto';
  const variosAutores = useMemo(() => new Set(msgs.filter((m) => m.direcao === 'saida').map((m) => m.autor_id ?? m.origem)).size > 1, [msgs]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className={cn('flex items-center gap-2 border-b border-mm-borda-suave bg-card px-2 py-2 sm:px-3', compacto && 'pt-[max(0.5rem,env(safe-area-inset-top))]')}>
        {aoVoltar && (
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={aoVoltar} aria-label="Voltar para a lista">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <button type="button" onClick={aoAbrirFicha} disabled={!aoAbrirFicha}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] p-1 text-left transition enabled:hover:bg-muted">
          <AvatarContato nome={nome} chave={conversaId} foto={foto} />
          <span className="min-w-0">
            <span className="block truncate text-[17px] font-extrabold leading-tight tracking-[-0.01em]">{nome}</span>
            <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              {subtitulo ?? <>{telefoneLegivel(telefone)}{numeroNome && <> · via {numeroNome}</>}</>}
            </span>
          </span>
        </button>
        {!compacto && <EtapaBadge etapa={etapa} className="hidden md:inline-flex" />}
        {acoes}
      </header>

      {desconectado && (
        <div className="flex items-center gap-2 border-b border-mm-borda-rosa bg-mm-rosa-palido px-4 py-2 text-xs font-bold text-mm-rosa-texto" role="alert">
          <WifiOff className="h-3.5 w-3.5" aria-hidden /> O número {numeroNome ? `"${numeroNome}" ` : ''}está desconectado. As mensagens não saem até reconectar.
        </div>
      )}

      <div ref={lista} onScroll={aoRolar} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-4" role="log" aria-label="Mensagens da conversa">
        {isLoading ? (
          <div className="space-y-3 p-2">
            {[60, 40, 70, 50].map((w, i) => (
              <div key={i} className={cn('flex', i % 2 ? 'justify-end' : 'justify-start')}>
                <Skeleton className="h-10 rounded-2xl" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {msgs.length >= limite && (
              <div className="mb-3 text-center">
                <Button variant="outline" size="sm" onClick={carregarAnteriores} disabled={isFetching}>
                  {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Carregar mensagens anteriores
                </Button>
              </div>
            )}
            <div className="mx-auto mb-3 flex max-w-sm items-center justify-center gap-1.5 rounded-[14px] bg-mm-lilas px-3 py-1.5 text-center text-[11px] font-semibold text-primary">
              <Lock className="h-3 w-3 shrink-0" aria-hidden /> Conversa pelo número da MeMude. A equipe acompanha para te ajudar.
            </div>
            {topo}
            {msgs.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda. Mande a primeira.</p>}
            {msgs.map((m, i) => {
              const anterior = msgs[i - 1];
              const novoDia = !anterior || !mesmoDia(anterior.criado_em, m.criado_em);
              const mudouAutor = !anterior || anterior.direcao !== m.direcao || anterior.autor_id !== m.autor_id || novoDia;
              return (
                <Fragment key={m.id}>
                  {novoDia && (
                    <div className="sticky top-0 z-10 my-3 flex justify-center">
                      <span className="rounded-full bg-card/95 px-3 py-1 text-[11px] font-bold text-muted-foreground ring-1 ring-mm-borda-suave first-letter:uppercase">
                        {separadorDia(m.criado_em)}
                      </span>
                    </div>
                  )}
                  <div className={cn(mudouAutor && i > 0 && 'mt-2')}>
                    <Bolha m={m} citada={m.responde_a ? porId.get(m.responde_a) : null}
                      mostrarAutor={variosAutores && mudouAutor} aoResponder={podeResponder ? setRespondeA : undefined}
                      aoReenviar={tentarDeNovo} reenviando={reenviar.isPending && reenviar.variables === m.id} />
                  </div>
                </Fragment>
              );
            })}
          </>
        )}
        {novasAbaixo > 0 && (
          <button type="button" onClick={descer}
            className="sombra-flutuante sticky bottom-2 float-right mr-1 flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
            <ArrowDown className="h-3.5 w-3.5" /> {novasAbaixo} nova{novasAbaixo > 1 ? 's' : ''}
          </button>
        )}
      </div>

      <Composer conversaId={conversaId} podeResponder={podeResponder} respondeA={respondeA} limparResposta={() => setRespondeA(null)}
        sugestao={sugestaoResposta} compacto={compacto} />
    </div>
  );
}
