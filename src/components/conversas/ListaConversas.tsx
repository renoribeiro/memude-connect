import { memo, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Inbox, MessageSquarePlus, Search, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ETAPA, FILTROS, PAPEL_DONO, type ConversaItem, type Etapa, type Filtro } from '@/lib/conversas/tipos';
import { nomeDaConversa, quandoNaLista } from '@/lib/conversas/formato';
import { useAgora } from '@/hooks/conversas/useAgora';
import { AvatarContato, ContadorNaoLidas, Espera, Temperatura } from './pecas';

export const ItemConversa = memo(function ItemConversa({ c, ativa, agora, aoAbrir }: {
  c: ConversaItem; ativa: boolean; agora: number; aoAbrir: (id: string) => void;
}) {
  const nome = nomeDaConversa(c);
  const etapa = ETAPA[c.etapa as Etapa];
  return (
    <button type="button" onClick={() => aoAbrir(c.id)} aria-current={ativa ? 'true' : undefined}
      className={cn('group flex w-full items-center gap-3 border-b border-border/50 px-3 py-2.5 text-left transition',
        ativa ? 'bg-primary/[0.07]' : 'hover:bg-muted/60', c.nao_lidas > 0 && !ativa && 'bg-secondary/[0.035]')}>
      <span className="relative">
        <AvatarContato nome={nome} chave={c.id} />
        {etapa && <span className={cn('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card', etapa.ponto)} title={etapa.rotulo} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn('truncate text-[15px]', c.nao_lidas ? 'font-bold' : 'font-semibold')}>{nome}</span>
          <Temperatura valor={c.temperatura} />
          <span className={cn('ml-auto shrink-0 text-[11px] tabular-nums', c.nao_lidas ? 'font-semibold text-secondary' : 'text-muted-foreground')}>
            {quandoNaLista(c.ultima_mensagem_em, new Date(agora))}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={cn('min-w-0 flex-1 truncate text-[13px]', c.nao_lidas ? 'text-foreground' : 'text-muted-foreground')}>
            {c.ultima_direcao === 'saida' && <span className="text-muted-foreground">Você: </span>}
            {c.ultima_direcao === 'nota' && <span className="text-amber-600">Nota: </span>}
            {c.ultima_previa ?? 'Conversa iniciada'}
          </span>
          <ContadorNaoLidas n={c.nao_lidas} />
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {c.aguardando_desde && <Espera desde={c.aguardando_desde} agora={agora} compacto />}
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {PAPEL_DONO[c.dono_papel] ?? c.dono_papel}{c.dono_nome ? ` · ${c.dono_nome.split(' ')[0]}` : ' · fila'}
          </span>
          {c.alertas_abertos > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-rose-600" title="Alertas abertos">
              <AlertTriangle className="h-3 w-3" /> {c.alertas_abertos}
            </span>
          )}
          {c.sugestoes_abertas > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary" title="Sugestões da IA esperando decisão">
              <Sparkles className="h-3 w-3" /> {c.sugestoes_abertas}
            </span>
          )}
        </span>
      </span>
    </button>
  );
});

interface Props {
  conversas: ConversaItem[];
  carregando: boolean;
  filtro: Filtro;
  aoFiltrar: (f: Filtro) => void;
  busca: string;
  aoBuscar: (b: string) => void;
  ativa: string | null;
  aoAbrir: (id: string) => void;
  aoNova?: () => void;
  totais?: Partial<Record<Filtro, number>>;
}

export function ListaConversas({ conversas, carregando, filtro, aoFiltrar, busca, aoBuscar, ativa, aoAbrir, aoNova, totais }: Props) {
  const agora = useAgora(20_000);
  const [texto, setTexto] = useState(busca);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => aoBuscar(texto.trim()), 250);
    return () => clearTimeout(t);
  }, [texto, aoBuscar]);
  // Atalho: "/" ou Ctrl+K foca a busca
  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo?.closest('input, textarea, [contenteditable]')) return;
      if (e.key === '/' || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); campo.current?.focus(); }
    };
    window.addEventListener('keydown', ouvir);
    return () => window.removeEventListener('keydown', ouvir);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input ref={campo} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar nome ou telefone"
              aria-label="Buscar conversa" className="h-10 rounded-full bg-muted/60 pl-9 pr-9" />
            {texto && (
              <button type="button" onClick={() => setTexto('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-background" aria-label="Limpar busca">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {aoNova && (
            <button type="button" onClick={aoNova} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:bg-primary-light active:scale-95"
              aria-label="Nova conversa com um lead" title="Nova conversa com um lead">
              <MessageSquarePlus className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="tablist" aria-label="Filtrar conversas">
          {FILTROS.map((f) => (
            <button key={f.valor} type="button" role="tab" aria-selected={filtro === f.valor} onClick={() => aoFiltrar(f.valor)}
              className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-medium transition',
                filtro === f.valor ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted-dark/40 hover:text-foreground')}>
              {f.rotulo}
              {totais?.[f.valor] ? <span className="ml-1 opacity-80 tabular-nums">{totais[f.valor]}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {carregando ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b px-3 py-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /></div>
            </div>
          ))
        ) : conversas.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="mb-3 rounded-full bg-primary/10 p-3"><Inbox className="h-6 w-6 text-primary" /></span>
            <p className="font-semibold">{busca ? 'Nada encontrado' : filtro === 'sem_resposta' ? 'Ninguém esperando resposta' : 'Nenhuma conversa aqui'}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {busca ? 'Tente outro nome ou parte do telefone.' : filtro === 'sem_resposta' ? 'Todos os clientes foram respondidos. 👏' : 'Quando um cliente escrever para o número da MeMude, a conversa aparece aqui.'}
            </p>
          </div>
        ) : (
          conversas.map((c) => <ItemConversa key={c.id} c={c} ativa={c.id === ativa} agora={agora} aoAbrir={aoAbrir} />)
        )}
      </div>
    </div>
  );
}
