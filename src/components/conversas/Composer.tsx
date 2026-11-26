import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  FileText, Mic, Paperclip, SendHorizontal, Smile, Sparkles, StickyNote, Trash2, X, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { duracao, semAssinatura, tamanhoArquivo } from '@/lib/conversas/formato';
import type { MensagemLocal, Sugestao } from '@/lib/conversas/tipos';
import { useDecidirSugestao, useEnviarMensagem, useRespostasRapidas } from '@/hooks/conversas/dados';
import { useGravador } from '@/hooks/conversas/useGravador';

const EMOJIS = ['😊', '😀', '😄', '🙂', '😉', '😍', '🥰', '🤩', '😅', '😂', '🙏', '👍', '👏', '🙌', '💪', '🤝', '👋', '✅', '✔️', '❤️', '💜', '💙', '🔥', '⭐', '✨', '🎉', '🥳', '🏠', '🏡', '🏢', '🔑', '📍', '📅', '🕐', '📄', '📎', '📸', '🎥', '📞', '💬', '💰', '💵', '📈', '🚗', '🌊', '☀️', '🌳', '👀', '🤔', '😮', '😢', '😔', '🙃', '😎', '🤗', '👌', '☝️', '👉', '⬇️', '❗', '❓', '⏳', '🎁', '🍀'];

const ehToque = () => window.matchMedia?.('(pointer: coarse)').matches;

interface Props {
  conversaId: string;
  podeResponder: boolean;
  bloqueio?: string | null;
  respondeA: MensagemLocal | null;
  limparResposta: () => void;
  sugestao?: Sugestao | null;
  permitirNota?: boolean;
  compacto?: boolean;
}

export function Composer({ conversaId, podeResponder, bloqueio, respondeA, limparResposta, sugestao, permitirNota = true, compacto }: Props) {
  const chaveRascunho = `memude:rascunho:${conversaId}`;
  const [texto, setTexto] = useState(() => sessionStorage.getItem(chaveRascunho) ?? '');
  const [nota, setNota] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [indiceAtalho, setIndiceAtalho] = useState(0);
  const [emojiAberto, setEmojiAberto] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const enviar = useEnviarMensagem();
  const decidir = useDecidirSugestao();
  const { data: respostas = [] } = useRespostasRapidas();
  const grav = useGravador();

  // Rascunho por conversa
  useEffect(() => { setTexto(sessionStorage.getItem(chaveRascunho) ?? ''); setArquivo(null); setNota(false); }, [chaveRascunho]);
  useEffect(() => {
    if (texto) sessionStorage.setItem(chaveRascunho, texto); else sessionStorage.removeItem(chaveRascunho);
  }, [texto, chaveRascunho]);
  useEffect(() => { if (respondeA) area.current?.focus(); }, [respondeA]);
  useEffect(() => {
    if (!arquivo || !arquivo.type.startsWith('image/')) { setPrevia(null); return; }
    const u = URL.createObjectURL(arquivo);
    setPrevia(u);
    return () => URL.revokeObjectURL(u);
  }, [arquivo]);
  useEffect(() => { if (grav.erro) toast.error(grav.erro); }, [grav.erro]);
  // Chegou ao limite de 5 min: o áudio sai sozinho (não perde o que foi gravado)
  const { noLimite, limparNoLimite } = grav;
  useEffect(() => {
    if (!noLimite) return;
    limparNoLimite();
    enviar.mutate({ conversaId, arquivo: noLimite, duracaoS: (noLimite as File & { duracao?: number }).duracao });
    toast.info('Áudio de 5 minutos enviado. Para falar mais, grave outro.');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara só quando chega um áudio novo
  }, [noLimite]);

  // Altura automática até 6 linhas
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [texto]);

  const buscaAtalho = texto.startsWith('/') && !texto.includes('\n') ? texto.slice(1).toLowerCase() : null;
  const atalhos = useMemo(() => (buscaAtalho == null ? [] : respostas.filter((r) =>
    r.atalho.includes(buscaAtalho) || r.titulo.toLowerCase().includes(buscaAtalho)).slice(0, 8)), [buscaAtalho, respostas]);
  useEffect(() => setIndiceAtalho(0), [buscaAtalho]);

  const usarAtalho = (t: string) => { setTexto(t); requestAnimationFrame(() => area.current?.focus()); };

  const mandar = async () => {
    const t = texto.trim();
    if (!t && !arquivo) return;
    if (nota && !t) return;
    const pedido = { conversaId, texto: t || undefined, arquivo: nota ? undefined : arquivo ?? undefined, respondeA: nota ? null : respondeA, nota };
    setTexto('');
    setArquivo(null);
    limparResposta();
    area.current?.focus();
    enviar.mutate(pedido, {
      onSuccess: () => { if (nota) toast.success('Nota salva (só a equipe vê)'); },
      onError: () => { if (nota) setTexto(t); },
    });
  };

  const aoTeclar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (atalhos.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceAtalho((i) => (i + 1) % atalhos.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceAtalho((i) => (i - 1 + atalhos.length) % atalhos.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); usarAtalho(atalhos[indiceAtalho].texto); return; }
      if (e.key === 'Escape') { e.preventDefault(); setTexto(''); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !ehToque() && !e.nativeEvent.isComposing) {
      e.preventDefault();
      mandar();
    }
  };

  const inserirEmoji = (em: string) => {
    const el = area.current;
    const ini = el?.selectionStart ?? texto.length;
    const fim = el?.selectionEnd ?? texto.length;
    setTexto(texto.slice(0, ini) + em + texto.slice(fim));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(ini + em.length, ini + em.length); });
  };

  const gravarOuParar = async () => {
    if (!grav.gravando) { await grav.iniciar(); return; }
    const audio = await grav.parar(true) as (File & { duracao?: number }) | null;
    if (!audio) { toast.info('Áudio muito curto'); return; }
    enviar.mutate({ conversaId, arquivo: audio, duracaoS: audio.duracao, respondeA });
    limparResposta();
  };

  if (!podeResponder) {
    return (
      <div className="border-t border-mm-borda-suave bg-card px-4 py-3 text-center text-sm font-semibold text-muted-foreground">
        {bloqueio ?? 'Só quem atende esta conversa pode responder.'}
      </div>
    );
  }

  const podeEnviar = (texto.trim().length > 0 || !!arquivo) && !grav.gravando;
  const respostaIA = sugestao?.tipo === 'resposta' ? String((sugestao.conteudo as { texto?: string })?.texto ?? '') : '';

  return (
    <div className={cn('border-t border-mm-borda-suave bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-card/85', compacto ? 'px-2 pt-2' : 'px-3 pt-2.5')}>
      {bloqueio && <p className="mb-2 rounded-[14px] bg-mm-alerta-fundo px-3 py-2 text-xs font-semibold text-mm-alerta">{bloqueio}</p>}

      {respostaIA && !texto && !arquivo && !nota && (
        <div className="mb-2 flex items-start gap-2 rounded-[14px] bg-mm-lilas p-2 pl-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="line-clamp-2 flex-1 text-sm text-foreground">{respostaIA}</p>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => decidir.mutate({ id: sugestao!.id, aceitar: false })}
              aria-label="Descartar sugestão">Descartar</Button>
            <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => {
              usarAtalho(respostaIA);
              decidir.mutate({ id: sugestao!.id, aceitar: true });
            }}>Usar</Button>
          </div>
        </div>
      )}

      {respondeA && (
        <div className="mb-2 flex items-center gap-2 rounded-[14px] border-l-4 border-primary bg-mm-lilas px-3 py-1.5">
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-bold text-primary">Respondendo {respondeA.direcao === 'entrada' ? 'ao cliente' : `a ${respondeA.autor_nome?.split(' ')[0] ?? 'equipe'}`}</p>
            <p className="truncate text-muted-foreground">{semAssinatura(respondeA.texto) || 'Anexo'}</p>
          </div>
          <button type="button" onClick={limparResposta} className="rounded-full p-1 hover:bg-card" aria-label="Cancelar resposta"><X className="h-4 w-4" /></button>
        </div>
      )}

      {arquivo && (
        <div className="mb-2 flex items-center gap-3 rounded-2xl border border-mm-borda-suave bg-card p-2">
          {previa
            ? <img src={previa} alt="" className="h-14 w-14 rounded-xl object-cover" />
            : <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-mm-rosa-claro"><FileText className="h-6 w-6 text-mm-acao" /></span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{arquivo.name}</p>
            <p className="text-xs text-muted-foreground">{tamanhoArquivo(arquivo.size)} · escreva uma legenda (opcional)</p>
          </div>
          <button type="button" onClick={() => setArquivo(null)} className="rounded-full p-1.5 hover:bg-muted" aria-label="Remover anexo"><X className="h-4 w-4" /></button>
        </div>
      )}

      {atalhos.length > 0 && (
        <div role="listbox" aria-label="Respostas rápidas" className="sombra-elevada mb-2 max-h-60 overflow-y-auto rounded-2xl border border-mm-borda-suave bg-popover p-1">
          {atalhos.map((r, i) => (
            <button key={r.id} type="button" role="option" aria-selected={i === indiceAtalho}
              onMouseDown={(e) => { e.preventDefault(); usarAtalho(r.texto); }}
              className={cn('flex w-full flex-col items-start rounded-xl px-3 py-2 text-left', i === indiceAtalho ? 'bg-accent' : 'hover:bg-accent/60')}>
              <span className="text-sm font-bold"><span className="text-primary">/{r.atalho}</span> · {r.titulo}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">{r.texto}</span>
            </button>
          ))}
        </div>
      )}

      {grav.gravando ? (
        <div className="flex items-center gap-2 pb-2.5">
          <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0 rounded-full text-mm-rosa-texto" onClick={() => grav.parar(false)} aria-label="Descartar áudio">
            <Trash2 className="h-5 w-5" />
          </Button>
          <div className="flex flex-1 items-center gap-2 rounded-full bg-mm-rosa-palido px-4 py-2.5 text-mm-rosa-texto">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-mm-rosa" aria-hidden />
            <span className="font-bold tabular-nums">{duracao(grav.segundos)}</span>
            <span className="text-sm opacity-80">Gravando…</span>
          </div>
          <Button size="icon" variant="acao" className="h-11 w-11 shrink-0" onClick={gravarOuParar} aria-label="Enviar áudio">
            <SendHorizontal className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-1.5 pb-2.5">
          <div className="flex shrink-0 items-center">
            <Popover open={emojiAberto} onOpenChange={setEmojiAberto}>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full text-muted-foreground" aria-label="Emojis"><Smile className="h-5 w-5" /></Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="tema-memude w-72 rounded-2xl p-2">
                <div className="grid grid-cols-8 gap-0.5">
                  {EMOJIS.map((em) => (
                    <button key={em} type="button" onClick={() => inserirEmoji(em)} className="rounded-md p-1 text-xl leading-none transition hover:bg-accent active:scale-90" aria-label={`Emoji ${em}`}>{em}</button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {!nota && (
              <>
                <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full text-muted-foreground" onClick={() => seletor.current?.click()} aria-label="Anexar foto, vídeo ou documento">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <input ref={seletor} type="file" hidden accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setArquivo(f); e.target.value = ''; }} />
              </>
            )}
            {!compacto && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full text-muted-foreground" onClick={() => { setTexto('/'); area.current?.focus(); }} aria-label="Respostas rápidas">
                    <Zap className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="tema-memude">Respostas rápidas (digite /)</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className={cn('flex min-w-0 flex-1 items-end rounded-3xl border px-3.5 py-2 transition focus-within:ring-[3px]',
            nota ? 'border-mm-alerta/40 bg-mm-alerta-fundo focus-within:ring-mm-alerta/20' : 'border-input bg-card focus-within:border-primary focus-within:ring-primary/15')}>
            <textarea ref={area} rows={1} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={aoTeclar}
              placeholder={nota ? 'Nota interna — o cliente não vê' : arquivo ? 'Legenda (opcional)' : 'Mensagem  ·  / para respostas rápidas'}
              aria-label={nota ? 'Nota interna' : 'Mensagem para o cliente'} maxLength={4000} enterKeyHint={ehToque() ? 'enter' : 'send'}
              className="max-h-40 min-h-[24px] w-full resize-none bg-transparent text-base leading-6 outline-none sm:text-[15px]" />
            {permitirNota && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={() => setNota((v) => !v)} aria-pressed={nota} aria-label="Alternar nota interna"
                    className={cn('-my-1.5 -mr-2 ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition', nota ? 'text-mm-alerta' : 'text-muted-foreground hover:text-primary')}>
                    <StickyNote className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="tema-memude">{nota ? 'Voltar para mensagem ao cliente' : 'Nota interna (só a equipe vê)'}</TooltipContent>
              </Tooltip>
            )}
          </div>
          {podeEnviar || nota ? (
            <Button size="icon" variant="acao" className={cn('h-11 w-11 shrink-0 transition active:scale-95', nota && 'bg-mm-alerta text-mm-alerta-fundo hover:bg-mm-alerta/90')}
              onClick={mandar} disabled={!podeEnviar} aria-label={nota ? 'Salvar nota' : 'Enviar'}>
              <SendHorizontal className="h-5 w-5" />
            </Button>
          ) : (
            <Button size="icon" className="h-11 w-11 shrink-0 transition active:scale-95" onClick={gravarOuParar} aria-label="Gravar áudio">
              <Mic className="h-5 w-5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
