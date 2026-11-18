import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Logo from '@/components/ui/logo';
import { EntradaLeads, Funil, Kpis, Origem } from './blocos';
import type { Painel } from './dados';

/** Modo apresentação: tela cheia, um assunto por slide, navegação por setas, clique ou teclado. */
export function Apresentacao({ painel, titulo, onFechar }: { painel: Painel; titulo: string; onFechar: () => void }) {
  const raiz = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const total = painel.atual.leads;

  const slides: { titulo: string; conteudo: React.ReactNode }[] = [
    {
      titulo: '',
      conteudo: (
        <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
          <Logo size="xl" />
          <p className="text-lg font-semibold uppercase tracking-[0.3em] text-secondary">Resultados comerciais</p>
          <h1 className="text-6xl font-extrabold text-primary">{titulo}</h1>
          <p className="text-xl text-muted-foreground">
            {painel.atual.vendas} {painel.atual.vendas === 1 ? 'venda' : 'vendas'} · {painel.atual.visitas_realizadas} visitas realizadas · {total} leads
          </p>
        </div>
      ),
    },
    { titulo: 'KPIs do período', conteudo: <Kpis atual={painel.atual} anterior={painel.anterior} grande /> },
    { titulo: 'Funil comercial', conteudo: <div className="mx-auto max-w-5xl"><Funil n={painel.atual} grande /></div> },
    { titulo: 'Entrada de leads por semana', conteudo: <EntradaLeads porDia={painel.por_dia} grande /> },
    { titulo: 'Origem dos leads', conteudo: <div className="mx-auto max-w-4xl"><Origem origem={painel.origem} grande /></div> },
  ];

  const ir = useCallback((d: number) => setI((x) => Math.min(slides.length - 1, Math.max(0, x + d))), [slides.length]);
  const fechar = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    onFechar();
  }, [onFechar]);

  useEffect(() => {
    raiz.current?.requestFullscreen?.().catch(() => undefined);
    const tecla = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); ir(1); }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); ir(-1); }
      if (e.key === 'Escape') fechar();
    };
    const saiuTelaCheia = () => { if (!document.fullscreenElement) onFechar(); };
    window.addEventListener('keydown', tecla);
    document.addEventListener('fullscreenchange', saiuTelaCheia);
    return () => { window.removeEventListener('keydown', tecla); document.removeEventListener('fullscreenchange', saiuTelaCheia); };
  }, [ir, fechar, onFechar]);

  const s = slides[i];
  return (
    <div ref={raiz} role="dialog" aria-modal aria-label="Apresentação dos resultados"
      className="fixed inset-0 z-[100] flex flex-col bg-background text-foreground">
      <div className="h-1.5 w-full bg-gradient-primary" />
      <header className="flex items-center justify-between px-10 py-5">
        {s.titulo ? <h2 className="text-3xl font-extrabold uppercase tracking-tight text-primary">{s.titulo}</h2> : <span />}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{titulo}</span>
          <Button variant="ghost" size="icon" onClick={fechar} aria-label="Sair da apresentação"><X className="h-5 w-5" /></Button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto px-10 pb-6">{s.conteudo}</main>
      <footer className="flex items-center justify-between px-10 pb-6">
        <Button variant="outline" onClick={() => ir(-1)} disabled={i === 0}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button>
        <div className="flex gap-2" role="tablist" aria-label="Slides">
          {slides.map((x, n) => (
            <button key={n} type="button" role="tab" aria-selected={n === i} aria-label={x.titulo || 'Capa'} onClick={() => setI(n)}
              className={cn('h-2.5 rounded-full transition-all', n === i ? 'w-8 bg-secondary' : 'w-2.5 bg-muted-foreground/30')} />
          ))}
        </div>
        <Button onClick={() => ir(1)} disabled={i === slides.length - 1}>Próximo<ChevronRight className="ml-1 h-4 w-4" /></Button>
      </footer>
    </div>
  );
}
