import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Building2, CalendarCheck, Kanban, Loader2, MessagesSquare, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useListaConversas, useTempoRealConversas } from '@/hooks/conversas/dados';
import { useConvites } from '@/hooks/conversas/useConvites';
import { useMensagensDoServiceWorker } from '@/hooks/conversas/usePush';
import { ConviteNovo } from '@/components/app/ConviteNovo';
import AppConversas from './AppConversas';

const AppChat = lazy(() => import('./AppChat'));
const AppHoje = lazy(() => import('./AppHoje'));
const AppFunil = lazy(() => import('./AppFunil'));
const AppImoveis = lazy(() => import('./AppImoveis'));
const AppEu = lazy(() => import('./AppEu'));

const ABAS = [
  { to: '/app', rotulo: 'Conversas', icone: MessagesSquare, fim: true },
  { to: '/app/hoje', rotulo: 'Hoje', icone: CalendarCheck },
  { to: '/app/funil', rotulo: 'Funil', icone: Kanban },
  { to: '/app/imoveis', rotulo: 'Imóveis', icone: Building2 },
  { to: '/app/eu', rotulo: 'Eu', icone: UserRound },
];

function Carregando() {
  return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}

/** App do corretor: uma tela por vez, barra inferior, feito para o polegar. Também funciona no computador. */
export default function AppCorretor() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const noChat = pathname.startsWith('/app/c/');
  const { data: conversas = [], isLoading: carregando, isError: erro, refetch } = useListaConversas('minhas', '');
  const { data: convites = [] } = useConvites(true);
  useTempoRealConversas();
  useMensagensDoServiceWorker();

  const naoLidas = conversas.reduce((s, c) => s + (c.nao_lidas > 0 ? 1 : 0), 0);

  // Notificação de convite abre /app?convite=…: o convite já aparece em tela cheia; limpa a URL
  useEffect(() => { if (search.includes('convite=')) navigate('/app', { replace: true }); }, [search, navigate]);
  // Ícone do app com contador (Android/desktop que suportam)
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (naoLidas) nav.setAppBadge?.(naoLidas).catch(() => undefined); else nav.clearAppBadge?.().catch(() => undefined);
  }, [naoLidas]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground md:mx-auto md:max-w-2xl md:border-x md:shadow-xl">
      <main className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<Carregando />}>
          <Routes>
            <Route index element={<AppConversas conversas={conversas} carregando={carregando} erro={erro} tentar={() => refetch()} />} />
            <Route path="c/:id" element={<AppChat />} />
            <Route path="hoje" element={<AppHoje />} />
            <Route path="funil" element={<AppFunil conversas={conversas} carregando={carregando} erro={erro} tentar={() => refetch()} />} />
            <Route path="imoveis" element={<AppImoveis />} />
            <Route path="eu" element={<AppEu />} />
            <Route path="*" element={<AppConversas conversas={conversas} carregando={carregando} erro={erro} tentar={() => refetch()} />} />
          </Routes>
        </Suspense>
      </main>

      {!noChat && (
        <nav className="grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-card/85" aria-label="Navegação do app">
          {ABAS.map((a) => (
            <NavLink key={a.to} to={a.to} end={a.fim}
              className={({ isActive }) => cn('relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition active:scale-95',
                isActive ? 'text-primary' : 'text-muted-foreground')}>
              {({ isActive }) => (
                <>
                  <span className={cn('flex h-8 w-14 items-center justify-center rounded-full transition', isActive && 'bg-primary/10')}>
                    <a.icone className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                  </span>
                  {a.rotulo}
                  {a.to === '/app' && naoLidas > 0 && (
                    <span className="absolute right-[calc(50%-1.6rem)] top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-white">
                      {naoLidas}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}

      <ConviteNovo convites={convites} aoAceitar={(id) => navigate(id ? `/app/c/${id}` : '/app/hoje')} />
    </div>
  );
}
