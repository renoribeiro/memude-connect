import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Marca } from './Marca';

/** Topo das telas principais do app (padrão MeMude Corretor): título 26/800 e subtítulo sobre o fundo da tela.
 *  No Início mostra o logotipo + CORRETOR em cima. Respeita a área segura do iPhone. */
export function Topo({ titulo, subtitulo, direita, marca, abaixo, className }: {
  titulo: string; subtitulo?: ReactNode; direita?: ReactNode; marca?: boolean; abaixo?: ReactNode; className?: string;
}) {
  return (
    <header className={cn('shrink-0 bg-background px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]', className)}>
      {marca && <Marca rotulo="Corretor" className="mb-4" />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[26px] leading-tight">{titulo}</h1>
          {subtitulo && <p className="mt-0.5 truncate text-[15px] text-muted-foreground">{subtitulo}</p>}
        </div>
        {direita && <div className="flex shrink-0 items-center gap-2">{direita}</div>}
      </div>
      {abaixo && <div className="mt-3">{abaixo}</div>}
    </header>
  );
}

/** Botão redondo do topo (busca, adicionar…). `cheio` = roxo, senão branco com borda. */
export function BotaoTopo({ rotulo, aoTocar, cheio, ativo, children }: { rotulo: string; aoTocar: () => void; cheio?: boolean; ativo?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={aoTocar} aria-label={rotulo} aria-pressed={ativo}
      className={cn('flex h-11 w-11 items-center justify-center rounded-full transition active:scale-95',
        cheio ? 'bg-primary text-primary-foreground' : ativo ? 'border border-primary bg-accent text-primary' : 'border border-border bg-card text-foreground')}>
      {children}
    </button>
  );
}
