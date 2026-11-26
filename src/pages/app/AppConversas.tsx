import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Inbox, Search, WifiOff, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Topo } from '@/components/app/Topo';
import { Vazio } from '@/components/app/ui';
import { ItemConversa } from '@/components/conversas/ListaConversas';
import { useAgora } from '@/hooks/conversas/useAgora';
import { useListaConversas } from '@/hooks/conversas/dados';
import { nomeDaConversa } from '@/lib/conversas/formato';
import type { ConversaItem } from '@/lib/conversas/tipos';

const FILTROS = [
  { v: 'todas', r: 'Todas' },
  { v: 'aguardando', r: 'Aguardando' },
  { v: 'nao_lidas', r: 'Não lidas' },
  { v: 'arquivadas', r: 'Arquivadas' },
] as const;
type FiltroApp = (typeof FILTROS)[number]['v'];

export default function AppConversas({ conversas, carregando, erro, tentar }: {
  conversas: ConversaItem[]; carregando?: boolean; erro?: boolean; tentar?: () => void;
}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const agora = useAgora(20_000);
  const inicial = params.get('filtro');
  const [filtro, setFiltro] = useState<FiltroApp>(FILTROS.some((f) => f.v === inicial) ? inicial as FiltroApp : 'todas');
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
      <Topo titulo="Conversas" subtitulo={aguardando ? `${aguardando} cliente${aguardando > 1 ? 's' : ''} esperando você` : 'Seus clientes no número da MeMude'}
        abaixo={(
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente"
                className="h-12 pl-10 pr-10 text-base" inputMode="search" />
              {busca && (
                <button type="button" className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full hover:bg-muted"
                  onClick={() => setBusca('')} aria-label="Limpar busca"><X className="h-4 w-4" /></button>
              )}
            </div>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]" role="tablist" aria-label="Filtro">
              {FILTROS.map((f) => (
                <button key={f.v} type="button" role="tab" aria-selected={filtro === f.v} onClick={() => {
                  setFiltro(f.v);
                  // O filtro vindo do Início (?filtro=) não volta a valer quando a tela remonta
                  if (params.has('filtro')) { params.delete('filtro'); setParams(params, { replace: true }); }
                }}
                  className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition',
                    filtro === f.v ? 'border-primary bg-primary font-bold text-primary-foreground' : 'border-border bg-card font-semibold text-muted-foreground')}>
                  {f.r}{f.v === 'aguardando' && aguardando ? ` · ${aguardando}` : ''}
                </button>
              ))}
            </div>
          </div>
        )} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-mm-borda-suave bg-card">
        {carregandoLista ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-mm-borda-suave px-3 py-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /></div>
            </div>
          ))
        ) : erroLista && !temDados ? (
          <Vazio icone={WifiOff} titulo="Não foi possível carregar" texto="Confira a internet e tente de novo."
            acao={<Button className="h-12 px-6" variant="acao" onClick={() => (verArquivadas ? arq.refetch() : tentar?.())}>Tentar de novo</Button>} />
        ) : lista.length === 0 ? (
          <Vazio icone={Inbox}
            titulo={busca ? 'Ninguém encontrado' : filtro === 'arquivadas' ? 'Nada arquivado' : filtro === 'todas' ? 'Nenhum cliente ainda' : 'Tudo respondido'}
            texto={filtro === 'arquivadas' && !busca ? 'Conversas arquivadas voltam sozinhas quando o cliente escreve.'
              : filtro === 'todas' && !busca ? 'Quando você aceitar um cliente novo, a conversa dele aparece aqui.' : 'Volte para "Todas" para ver seus clientes.'} />
        ) : lista.map((c) => <ItemConversa key={c.id} c={c} ativa={false} agora={agora} semDono aoAbrir={(id) => navigate(`/app/c/${id}`)} />)}
      </div>
    </>
  );
}
