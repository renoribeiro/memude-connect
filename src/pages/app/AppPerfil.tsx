import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, BellOff, ChevronRight, Download, ExternalLink, LogOut, Moon, Share, ShieldCheck, Sun, Zap } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Topo } from '@/components/app/Topo';
import { Bloco, CartaoNumero } from '@/components/app/ui';
import { AvatarContato } from '@/components/conversas/pecas';
import { RespostasRapidasPainel } from '@/components/conversas/RespostasRapidasPainel';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useDesempenho } from '@/hooks/conversas/dados';
import { usePush } from '@/hooks/conversas/usePush';
import { instalado } from '@/lib/conversas/push';
import { telefoneLegivel } from '@/lib/conversas/formato';

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Meu perfil: dados, desempenho, notificações, instalação e preferências. */
export default function AppPerfil() {
  const { profile, user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const push = usePush();
  const { data: desempenho = [] } = useDesempenho(30);
  const eu = desempenho.find((d) => d.user_id === user?.id);
  const { data: corretor } = useQuery({
    queryKey: ['conversas', 'meu-cadastro', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase.from('corretores').select('creci, whatsapp, email, cidade, estado, nota_media')
        .eq('profile_id', profile!.id).is('deleted_at', null).maybeSingle();
      return data;
    },
  });
  const [instalar, setInstalar] = useState<EventoInstalar | null>(null);
  const [respostas, setRespostas] = useState(false);
  const nome = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Corretor';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const pegar = (e: Event) => { e.preventDefault(); setInstalar(e as EventoInstalar); };
    window.addEventListener('beforeinstallprompt', pegar);
    return () => window.removeEventListener('beforeinstallprompt', pegar);
  }, []);

  const dados = [
    { r: 'WhatsApp', v: corretor?.whatsapp ? telefoneLegivel(corretor.whatsapp) : profile?.phone ? telefoneLegivel(profile.phone) : null },
    { r: 'E-mail', v: corretor?.email ?? user?.email ?? null },
    { r: 'Cidade', v: [corretor?.cidade, corretor?.estado].filter(Boolean).join(' · ') || null },
    { r: 'CRECI', v: corretor?.creci ?? null },
  ];
  const linha = 'flex w-full items-center gap-3 px-4 py-3.5 text-left';

  return (
    <>
      <Topo titulo="Meu perfil" />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-6 pt-1">
        <Bloco>
          <div className="flex items-center gap-3">
            <AvatarContato nome={nome} chave={user?.id} tamanho="lg" />
            <div className="min-w-0">
              <p className="truncate text-[17px] font-extrabold tracking-[-0.01em]">{nome}</p>
              <p className="truncate text-sm text-muted-foreground">Corretor parceiro · MeMude</p>
              {corretor?.creci && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-mm-sucesso-fundo px-2 py-0.5 text-[11px] font-extrabold text-mm-sucesso">
                  <ShieldCheck className="h-3 w-3" aria-hidden /> CRECI {corretor.creci}
                </span>
              )}
            </div>
          </div>
        </Bloco>

        <section className="space-y-2">
          <h2 className="text-lg leading-tight">Meu desempenho · 30 dias</h2>
          <div className="grid grid-cols-2 gap-2">
            <CartaoNumero valor={eu?.conversas_ativas ?? 0} rotulo="clientes ativos" />
            <CartaoNumero valor={eu?.tempo_medio_resposta_min == null ? '—' : `${String(eu.tempo_medio_resposta_min).replace('.', ',')} min`} rotulo="resposta média" />
            <CartaoNumero valor={eu?.respondidas_15min_pct == null ? '—' : `${Math.round(eu.respondidas_15min_pct)}%`} rotulo="respondidas em até 15 min"
              alerta={eu?.respondidas_15min_pct != null && eu.respondidas_15min_pct < 70} />
            <CartaoNumero valor={eu?.visitas_realizadas ?? 0} rotulo="visitas realizadas" />
          </div>
          <p className="text-xs text-muted-foreground">Responder em até 15 minutos (das 8h às 20h) evita alerta para o closer.</p>
        </section>

        <Bloco titulo="Meus dados" extra={<Link to="/perfil" className="font-bold text-mm-acao">Editar</Link>} semPadding>
          <dl className="divide-y divide-mm-borda-suave">
            {dados.map((d) => (
              <div key={d.r} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-muted-foreground">{d.r}</dt>
                <dd className="min-w-0 truncate text-right font-bold">{d.v ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </Bloco>

        <section className="divide-y divide-mm-borda-suave rounded-2xl border border-mm-borda-suave bg-card">
          <div className={linha}>
            {push.estado === 'ativo' ? <Bell className="h-5 w-5 text-primary" aria-hidden /> : <BellOff className="h-5 w-5 text-muted-foreground" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="font-bold">Notificações</p>
              <p className="text-xs text-muted-foreground">
                {push.estado === 'ativo' ? 'Ativas neste aparelho: cliente novo e mensagens'
                  : push.estado === 'negado' ? 'Bloqueadas: libere nas configurações do navegador'
                    : push.estado === 'instalar' ? 'No iPhone, instale o app para ativar'
                      : push.estado === 'indisponivel' ? 'Este navegador não suporta notificações' : 'Desligadas neste aparelho'}
              </p>
            </div>
            <Switch checked={push.estado === 'ativo'} disabled={push.ocupado || ['negado', 'instalar', 'indisponivel', 'carregando'].includes(push.estado)}
              onCheckedChange={(c) => (c ? push.ativar() : push.desativar())} aria-label="Notificações" />
          </div>
          {!instalado() && (
            <div className={linha}>
              <Download className="h-5 w-5 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-bold">Instalar o app</p>
                <p className="text-xs text-muted-foreground">
                  {ios ? <>Toque em <Share className="inline h-3 w-3" aria-label="Compartilhar" /> Compartilhar → “Adicionar à Tela de Início”</> : 'Abre em tela cheia, direto do ícone'}
                </p>
              </div>
              {instalar && <Button size="sm" variant="acao" onClick={async () => { await instalar.prompt(); setInstalar(null); }}>Instalar</Button>}
            </div>
          )}
          <button type="button" onClick={() => setRespostas(true)} className={linha}>
            <Zap className="h-5 w-5 text-muted-foreground" aria-hidden />
            <span className="flex-1"><span className="block font-bold">Respostas rápidas</span><span className="text-xs text-muted-foreground">Atalhos com “/” no chat</span></span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
          </button>
          <div className={linha}>
            {theme === 'dark' ? <Moon className="h-5 w-5 text-muted-foreground" aria-hidden /> : <Sun className="h-5 w-5 text-muted-foreground" aria-hidden />}
            <p className="flex-1 font-bold">Tema escuro</p>
            <Switch checked={theme === 'dark'} onCheckedChange={(c) => setTheme(c ? 'dark' : 'light')} aria-label="Tema escuro" />
          </div>
          <Link to="/dashboard" className={linha}>
            <ExternalLink className="h-5 w-5 text-muted-foreground" aria-hidden />
            <span className="flex-1"><span className="block font-bold">Portal completo</span><span className="text-xs text-muted-foreground">Comissões, histórico e cadastro</span></span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
          </Link>
        </section>

        <Button variant="outline" className="h-12 w-full text-mm-rosa-texto" onClick={signOut}><LogOut className="h-4 w-4" /> Sair</Button>
        <p className="pb-2 text-center text-xs font-semibold text-muted-foreground">MeMude Corretor · atendimento MeMude</p>
      </div>
      <Drawer open={respostas} onOpenChange={setRespostas}>
        <DrawerContent className="tema-memude max-h-[88dvh] bg-card">
          <DrawerTitle className="sr-only">Respostas rápidas</DrawerTitle>
          <div className="overflow-y-auto"><RespostasRapidasPainel /></div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
