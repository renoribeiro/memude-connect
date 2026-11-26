import { cn } from '@/lib/utils';
import logotipo from '@/assets/memude-logotipo.svg';
import simbolo from '@/assets/memude-simbolo.svg';

/** Logotipo MeMude (balão roxo com o M + nome em rosa), com rótulo opcional ao lado: "me mude | CORRETOR".
 *  Altura mínima na tela: 26 px. Não recolorir nem esticar. */
export function Marca({ rotulo, className }: { rotulo?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src={logotipo} alt="MeMude" className="h-[26px] w-auto" />
      {rotulo && (
        <>
          <span className="h-4 w-px bg-mm-divisor" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{rotulo}</span>
        </>
      )}
    </span>
  );
}

/** Só o balão com o M (ícone, telas vazias, abertura). */
export function Simbolo({ className }: { className?: string }) {
  return <img src={simbolo} alt="" aria-hidden className={cn('h-10 w-auto', className)} />;
}
