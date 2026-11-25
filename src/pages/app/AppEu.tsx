import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, Download, ExternalLink, LogOut, Moon, Share, Sun, Zap } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Topo } from '@/components/app/Topo';
import { AvatarContato } from '@/components/conversas/pecas';
import { RespostasRapidasPainel } from '@/components/conversas/RespostasRapidasPainel';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useAuth } from '@/hooks/useAuth';
import { useDesempenho } from '@/hooks/conversas/dados';
import { usePush } from '@/hooks/conversas/usePush';
import { instalado } from '@/lib/conversas/push';

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function AppEu() {
  const { profile, user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const push = usePush();
  const { data: desempenho = [] } = useDesempenho(30);
  const eu = desempenho.find((d) => d.user_id === user?.id);
  const [instalar, setInstalar] = useState<EventoInstalar | null>(null);
  const [respostas, setRespostas] = useState(false);
  const nome = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const pegar = (e: Event) => { e.preventDefault(); setInstalar(e as EventoInstalar); };
    window.addEventListener('beforeinstallprompt', pegar);
    return () => window.removeEventListener('beforeinstallprompt', pegar);
  }, []);

  const kpis = [
    { r: 'Clientes ativos', v: eu?.conversas_ativas ?? 0 },
    { r: 'Resposta média', v: eu?.tempo_medio_resposta_min == null ? '—' : `${String(eu.tempo_medio_resposta_min).replace('.', ',')} min` },
    { r: 'Em até 15 min', v: eu?.respondidas_15min_pct == null ? '—' : `${Math.round(eu.respondidas_15min_pct)}%` },
    { r: 'Visitas (30 dias)', v: eu?.visitas_realizadas ?? 0 },
  ];

  return (
    <>
      <Topo titulo="Eu" />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
        <div className="flex items-center gap-3">
          <AvatarContato nome={nome} chave={user?.id} tamanho="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{nome || 'Corretor'}</p>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <section aria-label="Meu desempenho nos últimos 30 dias">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meu desempenho · 30 dias</h2>
          <div className="grid grid-cols-2 gap-2">
            {kpis.map((k) => (
              <div key={k.r} className="rounded-2xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">{k.r}</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums">{k.v}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Responder em até 15 minutos (das 8h às 20h) evita alerta para o closer.</p>
        </section>

        <section className="divide-y rounded-2xl border bg-card">
          <div className="flex items-center gap-3 p-4">
            {push.estado === 'ativo' ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium">Notificações</p>
              <p className="text-xs text-muted-foreground">
                {push.estado === 'ativo' ? 'Você recebe cliente novo e mensagens neste aparelho'
                  : push.estado === 'negado' ? 'Bloqueadas: libere nas configurações do navegador'
                    : push.estado === 'instalar' ? 'No iPhone, instale o app para ativar'
                      : push.estado === 'indisponivel' ? 'Este navegador não suporta notificações' : 'Desligadas neste aparelho'}
              </p>
            </div>
            <Switch checked={push.estado === 'ativo'} disabled={push.ocupado || ['negado', 'instalar', 'indisponivel', 'carregando'].includes(push.estado)}
              onCheckedChange={(c) => (c ? push.ativar() : push.desativar())} aria-label="Notificações" />
          </div>
          {!instalado() && (
            <div className="flex items-center gap-3 p-4">
              <Download className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Instalar o app</p>
                <p className="text-xs text-muted-foreground">
                  {ios ? <>Toque em <Share className="inline h-3 w-3" /> Compartilhar → “Adicionar à Tela de Início”</> : 'Abre em tela cheia, como um app, direto do ícone'}
                </p>
              </div>
              {instalar && <Button size="sm" onClick={async () => { await instalar.prompt(); setInstalar(null); }}>Instalar</Button>}
            </div>
          )}
          <button type="button" onClick={() => setRespostas(true)} className="flex w-full items-center gap-3 p-4 text-left">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1"><span className="block font-medium">Respostas rápidas</span><span className="text-xs text-muted-foreground">Atalhos com “/” no chat</span></span>
          </button>
          <div className="flex items-center gap-3 p-4">
            {theme === 'dark' ? <Moon className="h-5 w-5 text-muted-foreground" /> : <Sun className="h-5 w-5 text-muted-foreground" />}
            <p className="flex-1 font-medium">Tema escuro</p>
            <Switch checked={theme === 'dark'} onCheckedChange={(c) => setTheme(c ? 'dark' : 'light')} aria-label="Tema escuro" />
          </div>
          <Link to="/dashboard" className="flex items-center gap-3 p-4">
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1"><span className="block font-medium">Portal completo</span><span className="text-xs text-muted-foreground">Comissões, histórico de leads e perfil</span></span>
          </Link>
        </section>

        <Button variant="outline" className="h-12 w-full rounded-2xl text-rose-600" onClick={signOut}><LogOut className="h-4 w-4" /> Sair</Button>
        <p className="pb-2 text-center text-xs text-muted-foreground">MeMude Connect · app do corretor</p>
      </div>
      <Drawer open={respostas} onOpenChange={setRespostas}>
        <DrawerContent className="max-h-[88dvh]">
          <DrawerTitle className="sr-only">Respostas rápidas</DrawerTitle>
          <div className="overflow-y-auto"><RespostasRapidasPainel /></div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
