import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { moeda } from '@/lib/comercial/periodo';
import Logo from '@/components/ui/logo';
import { EntradaLeads, Funil, Kpis, Origem } from './blocos';
import { usePainelApresentacao, type DadosApresentacao, type Painel } from './dados';
import {
  SlideCanais, SlideContratos, SlideCorretores, SlideStatus, SlideVisitasEvolucao, SlideVisitasRanking, SlideVisitasResultado,
} from './slides';

type Slide = { titulo: string; secao?: string; conteudo: React.ReactNode };

/** Modo apresentação: tela cheia, um assunto por slide, navegação por setas, clique ou teclado. */
export function Apresentacao({ painel, titulo, onFechar }: { painel: Painel; titulo: string; onFechar: () => void }) {
  const raiz = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const { data: extra, isLoading, error } = usePainelApresentacao(painel.de, painel.ate, true);
  const total = painel.atual.leads;

  // Telas que dependem dos dados extras: mostram carregando até chegar
  const comExtra = (f: (d: DadosApresentacao) => React.ReactNode) =>
    extra ? f(extra) : (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        {error ? `Não foi possível carregar: ${(error as Error).message}` : <><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</>}
      </div>
    );

  const slides: Slide[] = [
    {
      titulo: '',
      conteudo: (
        <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
          <Logo size="xl" />
          <p className="text-lg font-semibold uppercase tracking-[0.3em] text-secondary">Resultados comerciais</p>
          <h1 className="text-6xl font-black uppercase tracking-tight text-primary-dark">{titulo}</h1>
          <div className="mt-4 grid grid-cols-3 gap-6">
            {[[moeda(painel.atual.vgv), 'VGV vendido'], [String(painel.atual.visitas_realizadas), 'visitas realizadas'], [String(total), 'leads recebidos']].map(([v, r]) => (
              <div key={r} className="rounded-2xl border-t-4 border-secondary bg-muted/60 px-8 py-5">
                <p className="text-4xl font-black tabular-nums text-secondary">{v}</p>
                <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{r}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    { titulo: 'Resultado do período', conteudo: <Kpis atual={painel.atual} anterior={painel.anterior} grande /> },
    { titulo: 'Funil comercial', conteudo: <div className="mx-auto max-w-5xl"><Funil n={painel.atual} grande /></div> },
    { titulo: 'Contratos assinados', conteudo: comExtra((d) => <SlideContratos d={d} />) },
    { titulo: 'Origem de leads e vendas por canal', conteudo: comExtra((d) => <SlideCanais d={d} atual={painel.atual} anterior={painel.anterior} />) },
    { titulo: 'Origem dos leads', conteudo: <div className="mx-auto max-w-4xl"><Origem origem={painel.origem} grande /></div> },
    { titulo: 'Entrada de leads por semana', conteudo: <EntradaLeads porDia={painel.por_dia} grande /> },
    { titulo: 'Status dos leads no CRM', conteudo: comExtra((d) => <SlideStatus d={d} />) },
    { titulo: 'Desempenho por corretor', conteudo: comExtra((d) => <SlideCorretores d={d} />) },
    { secao: 'Anexo · Visitas', titulo: 'Resultado e origem', conteudo: comExtra((d) => <SlideVisitasResultado d={d} />) },
    { secao: 'Anexo · Visitas', titulo: `Evolução até ${titulo}`, conteudo: comExtra((d) => <SlideVisitasEvolucao d={d} />) },
    { secao: 'Anexo · Visitas', titulo: 'Corretores e empreendimentos', conteudo: comExtra((d) => <SlideVisitasRanking d={d} />) },
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
      <header className="flex items-end justify-between gap-6 px-12 pb-5 pt-7">
        {s.titulo ? (
          <div>
            {s.secao && <p className="text-sm font-bold uppercase tracking-[0.25em] text-secondary">{s.secao}</p>}
            <h2 className="text-4xl font-black uppercase leading-none tracking-tight text-primary-dark">{s.titulo}</h2>
          </div>
        ) : <span />}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-label="Carregando dados" />}
          <span className="font-medium">{titulo}</span>
          <span className="tabular-nums">{i + 1}/{slides.length}</span>
          <Button variant="ghost" size="icon" onClick={fechar} aria-label="Sair da apresentação"><X className="h-5 w-5" /></Button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto px-12 pb-6">{s.conteudo}</main>
      <footer className="flex items-center justify-between px-12 pb-6">
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
