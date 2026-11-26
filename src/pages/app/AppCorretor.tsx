import { lazy, Suspense, useEffect, useState } from 'react';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Building2, CalendarCheck, Kanban, Loader2, MessagesSquare, UserRound } from 'lucide-react';
import { useTheme } from 'next-themes';
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

  // /app?convite=… (notificação ou tela Hoje) abre aquele convite em tela cheia, mesmo com o prazo esgotado
  const [conviteAberto, setConviteAberto] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(search);
    const id = params.get('convite');
    if (!id) return;
    setConviteAberto(id);
    params.delete('convite');
    navigate({ pathname, search: params.toString() ? `?${params}` : '' }, { replace: true });
  }, [search, pathname, navigate]);
  // Identidade visual do app MeMude no documento inteiro (janelas, gavetas e avisos abrem fora desta árvore)
  useEffect(() => {
    document.documentElement.classList.add('tema-memude');
    return () => document.documentElement.classList.remove('tema-memude');
  }, []);
  // Barra do sistema no tom do app (#FAF9FD no claro); volta ao roxo do Connect ao sair
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const antes = meta.content;
    meta.content = resolvedTheme === 'dark' ? '#110d1d' : '#FAF9FD';
    return () => { meta.content = antes; };
  }, [resolvedTheme]);
  // Ícone do app com contador (Android/desktop que suportam)
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (naoLidas) nav.setAppBadge?.(naoLidas).catch(() => undefined); else nav.clearAppBadge?.().catch(() => undefined);
  }, [naoLidas]);

  return (
    <div className="tema-memude flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground md:sombra-elevada md:mx-auto md:max-w-2xl md:border-x md:border-mm-borda-suave">
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
        <nav className="grid grid-cols-5 border-t border-mm-borda-suave bg-card pb-[env(safe-area-inset-bottom)]" aria-label="Navegação do app">
          {ABAS.map((a) => (
            <NavLink key={a.to} to={a.to} end={a.fim}
              className={({ isActive }) => cn('relative flex h-[68px] flex-col items-center justify-center gap-1 text-[11px] transition active:scale-95',
                isActive ? 'font-bold text-primary' : 'font-semibold text-muted-foreground')}>
              {({ isActive }) => (
                <>
                  <a.icone className="h-6 w-6" strokeWidth={isActive ? 2 : 1.8} aria-hidden />
                  {a.rotulo}
                  {a.to === '/app' && naoLidas > 0 && (
                    <span className="absolute right-[calc(50%-1.5rem)] top-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-mm-acao px-1 text-[10px] font-extrabold text-white">
                      {naoLidas}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}

      <ConviteNovo convites={convites} abrirId={conviteAberto} aoFecharAberto={() => setConviteAberto(null)} aoAceitar={(id) => navigate(id ? `/app/c/${id}` : '/app/hoje')} />
    </div>
  );
}
