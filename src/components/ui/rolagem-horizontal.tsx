import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Área com rolagem horizontal cuja barra fica sempre à vista: ela gruda no rodapé da tela
 * enquanto o conteúdo estiver visível, em vez de aparecer só no fim de tabelas longas.
 */
export function RolagemHorizontal({ children, className, classNameConteudo }: {
  children: ReactNode;
  className?: string;
  classNameConteudo?: string;
}) {
  const conteudo = useRef<HTMLDivElement>(null);
  const barra = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [transborda, setTransborda] = useState(false);

  const medir = useCallback(() => {
    const el = conteudo.current;
    if (!el) return;
    setLargura(el.scrollWidth);
    setTransborda(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    const el = conteudo.current;
    if (!el) return;
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    const mo = new MutationObserver(medir);
    mo.observe(el, { childList: true, subtree: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [medir]);

  useEffect(() => {
    if (transborda && barra.current && conteudo.current) barra.current.scrollLeft = conteudo.current.scrollLeft;
  }, [transborda]);

  // Só copia quando difere: o eco do outro lado chega igual e para aí.
  const espelhar = (origem: HTMLDivElement | null, destino: HTMLDivElement | null) => {
    if (origem && destino && Math.abs(destino.scrollLeft - origem.scrollLeft) > 0.5) destino.scrollLeft = origem.scrollLeft;
  };

  return (
    <div className={cn('relative w-full', className)}>
      <div
        ref={conteudo}
        onScroll={() => espelhar(conteudo.current, barra.current)}
        className={cn('overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', classNameConteudo)}
      >
        {children}
      </div>
      {transborda && (
        <div
          ref={barra}
          onScroll={() => espelhar(barra.current, conteudo.current)}
          aria-hidden
          className="sticky bottom-0 z-20 overflow-x-scroll overflow-y-hidden border-t border-border/60 bg-card/85 backdrop-blur-sm"
        >
          <div style={{ width: largura, height: 1 }} />
        </div>
      )}
    </div>
  );
}
