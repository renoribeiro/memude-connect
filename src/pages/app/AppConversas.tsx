import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, Inbox, Search, WifiOff, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Topo } from '@/components/app/Topo';
import { ItemConversa } from '@/components/conversas/ListaConversas';
import { useAgora } from '@/hooks/conversas/useAgora';
import { useListaConversas } from '@/hooks/conversas/dados';
import { usePush } from '@/hooks/conversas/usePush';
import { nomeDaConversa } from '@/lib/conversas/formato';
import type { ConversaItem } from '@/lib/conversas/tipos';

const FILTROS = [
  { v: 'todas', r: 'Todas' },
  { v: 'aguardando', r: 'Aguardando' },
  { v: 'nao_lidas', r: 'Não lidas' },
  { v: 'arquivadas', r: 'Arquivadas' },
] as const;

export default function AppConversas({ conversas, carregando, erro, tentar }: {
  conversas: ConversaItem[]; carregando?: boolean; erro?: boolean; tentar?: () => void;
}) {
  const navigate = useNavigate();
  const agora = useAgora(20_000);
  const push = usePush();
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['v']>('todas');
  const [busca, setBusca] = useState('');
  const arq = useListaConversas('arquivadas', '', filtro === 'arquivadas');
  const arquivadas = useMemo(() => arq.data ?? [], [arq.data]);
  const verArquivadas = filtro === 'arquivadas';
  const carregandoLista = verArquivadas ? arq.isLoading : carregando;
  const erroLista = verArquivadas ? arq.isError : erro;
  const temDados = verArquivadas ? arquivadas.length > 0 : conversas.length > 0;

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const d = t.replace(/\D/g, '');
    const base = filtro === 'arquivadas' ? arquivadas : conversas;
    return base.filter((c) => (filtro === 'aguardando' ? !!c.aguardando_desde : filtro === 'nao_lidas' ? c.nao_lidas > 0 : true)
      && (!t || nomeDaConversa(c).toLowerCase().includes(t) || (d.length >= 3 && c.telefone.includes(d))));
  }, [conversas, arquivadas, filtro, busca]);
  const aguardando = conversas.filter((c) => c.aguardando_desde).length;

  return (
    <>
      <Topo titulo="Conversas" subtitulo={aguardando ? `${aguardando} cliente${aguardando > 1 ? 's' : ''} esperando você` : 'Seus clientes no número da MeMude'} />
      {(push.estado === 'inativo' || push.estado === 'instalar') && (
        <div className="mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-primary/10 p-3">
          <BellRing className="h-5 w-5 shrink-0 text-primary" />
          <p className="flex-1 text-sm leading-snug">
            {push.estado === 'instalar'
              ? 'Instale o app (Compartilhar → Adicionar à Tela de Início) para receber o aviso de cliente novo.'
              : 'Ative as notificações para não perder nenhum cliente novo.'}
          </p>
          {push.estado === 'inativo' && <Button size="sm" onClick={push.ativar} disabled={push.ocupado}>Ativar</Button>}
        </div>
      )}
      <div className="space-y-2 px-3 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente"
            className="h-11 rounded-full border-0 bg-muted pl-10 text-base" inputMode="search" />
          {busca && <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-1" onClick={() => setBusca('')} aria-label="Limpar"><X className="h-4 w-4" /></button>}
        </div>
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]" role="tablist" aria-label="Filtro">
          {FILTROS.map((f) => (
            <button key={f.v} type="button" role="tab" aria-selected={filtro === f.v} onClick={() => setFiltro(f.v)}
              className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition', filtro === f.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              {f.r}{f.v === 'aguardando' && aguardando ? ` · ${aguardando}` : ''}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {carregandoLista ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b px-3 py-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /></div>
            </div>
          ))
        ) : erroLista && !temDados ? (
          <div className="flex flex-col items-center px-8 py-16 text-center">
            <span className="mb-3 rounded-full bg-rose-50 p-4 dark:bg-rose-950"><WifiOff className="h-7 w-7 text-rose-600" /></span>
            <p className="text-lg font-semibold">Não foi possível carregar</p>
            <p className="mt-1 text-sm text-muted-foreground">Confira a internet e tente de novo.</p>
            <Button className="mt-4" onClick={() => (verArquivadas ? arq.refetch() : tentar?.())}>Tentar de novo</Button>
          </div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center px-8 py-16 text-center">
            <span className="mb-3 rounded-full bg-primary/10 p-4"><Inbox className="h-7 w-7 text-primary" /></span>
            <p className="text-lg font-semibold">{busca ? 'Ninguém encontrado' : filtro === 'arquivadas' ? 'Nada arquivado' : filtro === 'todas' ? 'Nenhum cliente ainda' : 'Tudo respondido 👏'}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtro === 'arquivadas' && !busca ? 'Conversas arquivadas voltam sozinhas quando o cliente escreve.' : filtro === 'todas' && !busca ? 'Quando você aceitar um cliente novo, a conversa dele aparece aqui.' : 'Volte para "Todas" para ver seus clientes.'}
            </p>
          </div>
        ) : lista.map((c) => <ItemConversa key={c.id} c={c} ativa={false} agora={agora} aoAbrir={(id) => navigate(`/app/c/${id}`)} />)}
      </div>
    </>
  );
}
