import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, CircleUserRound, House, Loader2, MessagesSquare, Users } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useListaConversas, useTempoRealConversas } from '@/hooks/conversas/dados';
import { useConvites } from '@/hooks/conversas/useConvites';
import { useMensagensDoServiceWorker } from '@/hooks/conversas/usePush';
import { ConviteNovo } from '@/components/app/ConviteNovo';
import { BotaoAjuda, PedirAjuda } from '@/components/app/PedirAjuda';
import { ComoFoiVisita } from '@/components/app/ComoFoiVisita';
import { useVisitasParaContar } from '@/hooks/conversas/app';
import AppInicio from './AppInicio';

const AppConversas = lazy(() => import('./AppConversas'));
const AppChat = lazy(() => import('./AppChat'));
const AppAgenda = lazy(() => import('./AppAgenda'));
const AppClientes = lazy(() => import('./AppClientes'));
const AppImoveis = lazy(() => import('./AppImoveis'));
const AppPerfil = lazy(() => import('./AppPerfil'));
const AppComissoes = lazy(() => import('./AppComissoes'));

// Mesmas cinco abas do app MeMude Corretor, adaptadas ao atendimento
const ABAS = [
  { to: '/app', rotulo: 'Início', icone: House, fim: true },
  { to: '/app/conversas', rotulo: 'Conversas', icone: MessagesSquare },
  { to: '/app/agenda', rotulo: 'Agenda', icone: CalendarDays },
  { to: '/app/clientes', rotulo: 'Clientes', icone: Users },
  { to: '/app/perfil', rotulo: 'Meu perfil', icone: CircleUserRound },
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

  const [ajuda, setAjuda] = useState(false);
  // Retorno obrigatório: 1 hora depois do horário da visita, o app pede o retorno e só fecha quando o corretor envia
  const { data: paraContar = [] } = useVisitasParaContar();
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 60_000); return () => clearInterval(t); }, []);
  const cobrar = [...paraContar]
    .filter((v) => new Date(`${v.data_visita}T${String(v.horario_visita).slice(0, 5)}:00-03:00`).getTime() + 60 * 60_000 <= agora)
    .sort((a, b) => `${a.data_visita}${a.horario_visita}`.localeCompare(`${b.data_visita}${b.horario_visita}`))[0] ?? null;
  const naoLidas = conversas.reduce((s, c) => s + (c.nao_lidas > 0 ? 1 : 0), 0);
  const lista = { conversas, carregando, erro, tentar: () => { refetch(); } };

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
    <div className="tema-memude relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground md:sombra-elevada md:mx-auto md:max-w-[480px] md:border-x md:border-mm-borda-suave">
      <main data-sob-convite className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<Carregando />}>
          <Routes>
            <Route index element={<AppInicio {...lista} />} />
            <Route path="conversas" element={<AppConversas {...lista} />} />
            <Route path="c/:id" element={<AppChat />} />
            <Route path="agenda" element={<AppAgenda />} />
            <Route path="clientes" element={<AppClientes {...lista} />} />
            <Route path="imoveis" element={<AppImoveis />} />
            <Route path="perfil" element={<AppPerfil />} />
            <Route path="comissoes" element={<AppComissoes />} />
            {/* Endereços antigos (notificações e atalhos já instalados) */}
            <Route path="hoje" element={<Navigate to="/app/agenda" replace />} />
            <Route path="funil" element={<Navigate to="/app/clientes" replace />} />
            <Route path="eu" element={<Navigate to="/app/perfil" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </Suspense>
      </main>

      {!noChat && (
        <BotaoAjuda aoTocar={() => setAjuda(true)} className="absolute bottom-[calc(80px+env(safe-area-inset-bottom))] right-4 z-30" />
      )}
      <PedirAjuda aberto={ajuda} aoFechar={() => setAjuda(false)} />
      <ComoFoiVisita visita={cobrar} aberto={!!cobrar && !convites.length && !conviteAberto && !ajuda} aoFechar={() => undefined} obrigatorio />

      {!noChat && (
        <nav data-sob-convite className="grid shrink-0 grid-cols-5 border-t border-mm-borda-suave bg-card pb-[env(safe-area-inset-bottom)]" aria-label="Navegação do app">
          {ABAS.map((a) => (
            <NavLink key={a.to} to={a.to} end={a.fim}
              className={({ isActive }) => cn('relative flex h-[68px] flex-col items-center justify-center gap-1 text-[11px] transition active:scale-95',
                isActive ? 'font-bold text-primary' : 'font-semibold text-muted-foreground')}>
              {({ isActive }) => (
                <>
                  <a.icone className="h-6 w-6" strokeWidth={isActive ? 2 : 1.8} aria-hidden />
                  {a.rotulo}
                  {a.to === '/app/conversas' && naoLidas > 0 && (
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

      <ConviteNovo convites={convites} abrirId={conviteAberto} aoFecharAberto={() => setConviteAberto(null)} aoAceitar={(id) => navigate(id ? `/app/c/${id}` : '/app/agenda')} />
    </div>
  );
}
