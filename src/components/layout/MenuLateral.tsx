import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ehGrupo, rotaAtiva, type EntradaNav, type GrupoNav, type ItemNav } from './navegacao';

const CHAVE = 'memude.menu.abertos';

function lerAbertos(): string[] {
  try { return JSON.parse(localStorage.getItem(CHAVE) ?? '[]'); } catch { return []; }
}

export function MenuLateral({ entradas, aoNavegar }: { entradas: EntradaNav[]; aoNavegar?: () => void }) {
  const { pathname, search } = useLocation();
  const ativo = (href: string) => rotaAtiva(href, pathname, search);
  const [abertos, setAbertos] = useState<string[]>(lerAbertos);

  // Abre sozinho o grupo da tela atual (o primeiro que a contém), sem fechar os que a pessoa abriu.
  useEffect(() => {
    const grupos = entradas.filter(ehGrupo);
    if (grupos.some((g) => abertos.includes(g.nome) && g.itens.some((i) => ativo(i.href)))) return;
    const dono = grupos.find((g) => g.itens.some((i) => ativo(i.href)));
    if (dono) setAbertos((a) => [...a, dono.nome]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  useEffect(() => { localStorage.setItem(CHAVE, JSON.stringify(abertos)); }, [abertos]);

  const alternar = (nome: string) => setAbertos((a) => (a.includes(nome) ? a.filter((x) => x !== nome) : [...a, nome]));

  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-0.5 px-3">
      {entradas.map((e) => (ehGrupo(e)
        ? <Grupo key={e.nome} grupo={e} aberto={abertos.includes(e.nome)} alternar={() => alternar(e.nome)} ativo={ativo} aoNavegar={aoNavegar} />
        : <Item key={e.href} item={e} ativo={ativo(e.href)} aoNavegar={aoNavegar} />))}
    </nav>
  );
}

function Item({ item, ativo, aoNavegar, filho = false }: { item: ItemNav; ativo: boolean; aoNavegar?: () => void; filho?: boolean }) {
  const Icone = item.icone;
  return (
    <Link
      to={item.href}
      onClick={aoNavegar}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        filho ? 'h-8' : 'h-9',
        ativo ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {ativo && <span aria-hidden className={cn('absolute inset-y-1.5 rounded-full bg-secondary', filho ? '-left-[10px] w-[3px]' : '-left-3 w-1 rounded-l-none')} />}
      <Icone aria-hidden className={cn('shrink-0', filho ? 'h-4 w-4' : 'h-[18px] w-[18px]', ativo ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground/70')} />
      <span className="truncate">{item.nome}</span>
    </Link>
  );
}

function Grupo({ grupo, aberto, alternar, ativo, aoNavegar }: {
  grupo: GrupoNav; aberto: boolean; alternar: () => void; ativo: (href: string) => boolean; aoNavegar?: () => void;
}) {
  const Icone = grupo.icone;
  const contemAtivo = grupo.itens.some((i) => ativo(i.href));
  const id = `grupo-${grupo.nome.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <div>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        aria-controls={id}
        className={cn(
          'group flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          contemAtivo && !aberto ? 'font-semibold text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Icone aria-hidden className={cn('h-[18px] w-[18px] shrink-0', contemAtivo ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground/70')} />
        <span className="flex-1 truncate text-left">{grupo.nome}</span>
        <ChevronRight aria-hidden className={cn('h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform', aberto && 'rotate-90')} />
      </button>
      {aberto && (
        <div id={id} className="ml-[21px] mt-0.5 flex flex-col gap-0.5 border-l border-border pb-1 pl-2">
          {grupo.itens.map((i) => <Item key={i.href} item={i} ativo={ativo(i.href)} aoNavegar={aoNavegar} filho />)}
        </div>
      )}
    </div>
  );
}
