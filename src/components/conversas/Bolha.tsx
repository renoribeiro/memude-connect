import { memo, useRef, useState } from 'react';
import {
  Download, FileText, Loader2, MapPin, Pause, Play, Reply, RotateCcw, StickyNote, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { duracao, horaCurta, semAssinatura, tamanhoArquivo, trechos } from '@/lib/conversas/formato';
import type { MensagemLocal } from '@/lib/conversas/tipos';
import { useMidiaUrl } from '@/hooks/conversas/dados';
import { Tiques } from './pecas';

function TextoFormatado({ texto, className }: { texto: string; className?: string }) {
  return (
    <p className={cn('whitespace-pre-wrap break-words [overflow-wrap:anywhere]', className)}>
      {trechos(texto).map((t, i) => {
        if (t.tipo === 'link') {
          return <a key={i} href={t.valor} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-1 underline-offset-2 hover:opacity-80">{t.valor}</a>;
        }
        if (t.tipo === 'negrito') return <strong key={i} className="font-semibold">{t.valor}</strong>;
        if (t.tipo === 'italico') return <em key={i}>{t.valor}</em>;
        if (t.tipo === 'riscado') return <s key={i}>{t.valor}</s>;
        if (t.tipo === 'codigo') return <code key={i} className="rounded bg-black/5 px-1 font-mono text-[0.85em] dark:bg-white/10">{t.valor}</code>;
        return <span key={i}>{t.valor}</span>;
      })}
    </p>
  );
}

function PlayerAudio({ src, segundos, transcricao, minha }: { src?: string; segundos?: number | null; transcricao?: string | null; minha: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [pos, setPos] = useState(0);
  const [total, setTotal] = useState(segundos ?? 0);
  const [veloc, setVeloc] = useState(1);
  const alternar = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) a.play(); else a.pause();
  };
  const trocarVelocidade = () => {
    const v = veloc === 1 ? 1.5 : veloc === 1.5 ? 2 : 1;
    setVeloc(v);
    if (ref.current) ref.current.playbackRate = v;
  };
  const pct = total ? Math.min(100, (pos / total) * 100) : 0;
  return (
    <div className="w-64 max-w-full">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={alternar} disabled={!src} aria-label={tocando ? 'Pausar áudio' : 'Ouvir áudio'}
          className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-50',
            minha ? 'bg-white/20 text-white' : 'bg-primary text-primary-foreground')}>
          {!src ? <Loader2 className="h-4 w-4 animate-spin" /> : tocando ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <input type="range" min={0} max={total || 1} step={0.1} value={pos} aria-label="Posição do áudio"
            onChange={(e) => { const v = Number(e.target.value); setPos(v); if (ref.current) ref.current.currentTime = v; }}
            className={cn('h-1 w-full cursor-pointer appearance-none rounded-full', minha ? 'accent-white' : 'accent-primary')}
            style={{ background: `linear-gradient(to right, currentColor ${pct}%, rgb(148 163 184 / 0.4) ${pct}%)` }} />
          <div className="mt-1 flex justify-between text-[11px] tabular-nums opacity-75">
            <span>{duracao(tocando || pos ? pos : total)}</span>
            <button type="button" onClick={trocarVelocidade} className="rounded px-1 font-semibold hover:bg-black/5" aria-label="Velocidade">{veloc}×</button>
          </div>
        </div>
      </div>
      {src && (
        <audio ref={ref} src={src} preload="metadata"
          onPlay={() => setTocando(true)} onPause={() => setTocando(false)} onEnded={() => { setTocando(false); setPos(0); }}
          onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => { if (Number.isFinite(e.currentTarget.duration)) setTotal(e.currentTarget.duration); }} />
      )}
      {transcricao && (
        <p className={cn('mt-2 border-t pt-1.5 text-[13px] italic leading-snug', minha ? 'border-white/20' : 'border-border')}>
          “{transcricao}”
        </p>
      )}
    </div>
  );
}

function Midia({ m, minha }: { m: MensagemLocal; minha: boolean }) {
  const { data: url } = useMidiaUrl(m.local ? null : m.midia_path);
  const src = m.previaUrl ?? url;
  const [ampliada, setAmpliada] = useState(false);
  if (m.tipo === 'audio') return <PlayerAudio src={src} segundos={m.duracao_s} transcricao={m.transcricao} minha={minha} />;
  if (!m.midia_path && !m.previaUrl) {
    return <p className="text-sm opacity-75">{m.erro ?? 'Baixando mídia…'}</p>;
  }
  if (m.tipo === 'imagem' || m.tipo === 'figurinha') {
    return (
      <>
        <button type="button" onClick={() => src && setAmpliada(true)} className="block overflow-hidden rounded-lg" aria-label="Ampliar foto">
          {src
            ? <img src={src} alt={m.texto ?? 'Foto'} loading="lazy" className={cn('max-h-80 w-auto max-w-full object-cover', m.tipo === 'figurinha' && 'max-h-32 bg-transparent')} />
            : <div className="flex h-48 w-60 items-center justify-center bg-black/5"><Loader2 className="h-5 w-5 animate-spin opacity-60" /></div>}
        </button>
        <Dialog open={ampliada} onOpenChange={setAmpliada}>
          <DialogContent className="max-w-[95vw] border-0 bg-transparent p-0 shadow-none sm:max-w-4xl">
            <DialogTitle className="sr-only">Foto</DialogTitle>
            {src && <img src={src} alt={m.texto ?? 'Foto'} className="max-h-[85vh] w-full rounded-lg object-contain" />}
          </DialogContent>
        </Dialog>
      </>
    );
  }
  if (m.tipo === 'video') {
    return src
      ? <video src={src} controls preload="metadata" playsInline className="max-h-80 w-full max-w-xs rounded-lg bg-black" />
      : <div className="flex h-40 w-60 items-center justify-center rounded-lg bg-black/10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  // documento
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" download={m.midia_nome ?? undefined}
      className={cn('flex w-64 max-w-full items-center gap-3 rounded-lg p-2.5 transition', minha ? 'bg-white/15 hover:bg-white/25' : 'bg-muted hover:bg-muted-dark/40')}>
      <FileText className="h-8 w-8 shrink-0 opacity-80" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{m.midia_nome ?? 'Documento'}</span>
        <span className="text-xs opacity-70">{[m.midia_mime?.split('/')[1]?.toUpperCase(), tamanhoArquivo(m.midia_bytes)].filter(Boolean).join(' · ')}</span>
      </span>
      <Download className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
    </a>
  );
}

interface Props {
  m: MensagemLocal;
  citada?: MensagemLocal | null;
  mostrarAutor?: boolean;
  aoResponder?: (m: MensagemLocal) => void;
  aoReenviar?: (m: MensagemLocal) => void;
  reenviando?: boolean;
}

/** Uma mensagem da conversa: cliente à esquerda, equipe à direita, nota interna em amarelo no centro. */
export const Bolha = memo(function Bolha({ m, citada, mostrarAutor, aoResponder, aoReenviar, reenviando }: Props) {
  if (m.tipo === 'sistema') {
    return <div className="my-2 text-center"><span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{m.texto}</span></div>;
  }
  if (m.direcao === 'nota') {
    return (
      <div className="mx-auto my-2 max-w-[85%] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 shadow-sm dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
        <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          <StickyNote className="h-3 w-3" aria-hidden /> Nota interna · {m.autor_nome ?? 'Equipe'} · {horaCurta(m.criado_em)}
        </div>
        <TextoFormatado texto={m.texto ?? ''} />
      </div>
    );
  }
  const minha = m.direcao === 'saida';
  const texto = minha ? semAssinatura(m.texto) : m.texto;
  if (m.tipo === 'reacao') {
    return (
      <div className={cn('my-0.5 flex', minha ? 'justify-end' : 'justify-start')}>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{minha ? 'Você' : 'Cliente'} reagiu {m.texto}</span>
      </div>
    );
  }
  const temMidia = ['imagem', 'video', 'audio', 'documento', 'figurinha'].includes(m.tipo);
  return (
    <div className={cn('group my-0.5 flex items-end gap-1', minha ? 'justify-end' : 'justify-start')}>
      {minha && aoResponder && m.wa_id && (
        <button type="button" onClick={() => aoResponder(m)} aria-label="Responder esta mensagem"
          className="mb-2 rounded-full p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100">
          <Reply className="h-4 w-4" />
        </button>
      )}
      <div className={cn(
        'relative max-w-[82%] rounded-2xl px-3 py-1.5 text-[15px] leading-snug shadow-sm sm:max-w-[68%]',
        minha ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border border-border/60 bg-card text-card-foreground',
        m.status === 'erro' && 'ring-2 ring-rose-400',
        m.local && m.status === 'pendente' && 'opacity-80',
      )}>
        {mostrarAutor && minha && (
          <p className="mb-0.5 text-[11px] font-semibold opacity-80">{m.origem === 'celular' ? 'Pelo celular do número' : m.autor_nome}</p>
        )}
        {citada && (
          <div className={cn('mb-1.5 rounded-lg border-l-4 px-2 py-1 text-xs', minha ? 'border-white/60 bg-white/15' : 'border-primary bg-muted')}>
            <p className="font-semibold">{citada.direcao === 'entrada' ? 'Cliente' : 'Você'}</p>
            <p className="line-clamp-2 opacity-80">{semAssinatura(citada.texto) || (citada.tipo === 'audio' ? '🎤 Áudio' : '📎 Anexo')}</p>
          </div>
        )}
        {m.tipo === 'localizacao' && <MapPin className="mb-1 h-4 w-4" aria-hidden />}
        {m.tipo === 'contato' && <User className="mb-1 h-4 w-4" aria-hidden />}
        {temMidia && <div className={cn(texto && 'mb-1')}><Midia m={m} minha={minha} /></div>}
        {texto && <TextoFormatado texto={texto} />}
        <div className={cn('mt-0.5 flex items-center justify-end gap-1 text-[11px] tabular-nums', minha ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
          <span>{horaCurta(m.criado_em)}</span>
          {minha && <Tiques status={m.status} className={m.status === 'lida' ? 'text-sky-300' : undefined} />}
        </div>
        {m.status === 'erro' && (
          <div className="mt-1 flex items-center gap-2 border-t border-white/20 pt-1 text-xs">
            <span className="flex-1">{m.erro ?? 'Não enviada'}</span>
            {aoReenviar && !m.local && (
              <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" disabled={reenviando} onClick={() => aoReenviar(m)}>
                {reenviando ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Tentar de novo
              </Button>
            )}
          </div>
        )}
      </div>
      {!minha && aoResponder && m.wa_id && (
        <button type="button" onClick={() => aoResponder(m)} aria-label="Responder esta mensagem"
          className="mb-2 rounded-full p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100">
          <Reply className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});
