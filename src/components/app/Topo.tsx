import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Barra de título das telas do app (com área segura do iPhone). */
export function Topo({ titulo, subtitulo, direita, className }: { titulo: string; subtitulo?: ReactNode; direita?: ReactNode; className?: string }) {
  return (
    <header className={cn('flex items-end justify-between gap-3 border-b bg-card px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))]', className)}>
      <div className="min-w-0">
        <h1 className="truncate text-[26px] font-bold leading-tight tracking-tight">{titulo}</h1>
        {subtitulo && <p className="truncate text-sm text-muted-foreground">{subtitulo}</p>}
      </div>
      {direita}
    </header>
  );
}
