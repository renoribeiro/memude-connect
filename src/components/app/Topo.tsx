import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Marca } from './Marca';

/** Barra de título das telas do app (com área segura do iPhone). Na tela inicial mostra o logotipo + CORRETOR. */
export function Topo({ titulo, subtitulo, direita, marca, className }: {
  titulo: string; subtitulo?: ReactNode; direita?: ReactNode; marca?: boolean; className?: string;
}) {
  return (
    <header className={cn('flex items-end justify-between gap-3 border-b border-mm-borda-suave bg-card px-5 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))]', className)}>
      <div className="min-w-0">
        {marca && <Marca rotulo="Corretor" className="mb-3" />}
        <h1 className="truncate text-2xl leading-tight">{titulo}</h1>
        {subtitulo && <p className="truncate text-sm text-muted-foreground">{subtitulo}</p>}
      </div>
      {direita}
    </header>
  );
}
