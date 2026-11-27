import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, BellRing, CheckCheck, MessagesSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { iconeNotificacao } from '@/components/notifications/NotificationSystem';
import { destinoNotificacao, useMarcarLidas, useNotificacoes } from '@/hooks/useNotificacoes';
import { useAlertas } from '@/hooks/conversas/dados';
import { TIPO_ALERTA } from '@/lib/conversas/tipos';

const quando = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });

/**
 * Central de notificações da tela Hoje: visita realizada, cliente não veio, corretor aceitou, pedido de ajuda,
 * corretor que ainda não contou como foi. Ficam aqui (lidas e não lidas) por 30 dias.
 */
export function NotificacoesHoje() {
  const navegar = useNavigate();
  const { data: lista = [], isLoading } = useNotificacoes();
  const marcar = useMarcarLidas();
  const [todas, setTodas] = useState(false);
  const naoLidas = lista.filter((n) => !n.read);
  const visiveis = todas ? lista : lista.slice(0, 8);

  return (
    <section className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', naoLidas.length > 0 && 'border-primary/40')} aria-label="Notificações">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <BellRing className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">Notificações</h2>
        {naoLidas.length > 0 && <span className="rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground tabular-nums">{naoLidas.length} nova{naoLidas.length > 1 ? 's' : ''}</span>}
        {naoLidas.length > 0 && (
          <Button size="sm" variant="ghost" className="ml-auto h-7" disabled={marcar.isPending} onClick={() => marcar.mutate(naoLidas.map((n) => n.id))}>
            <CheckCheck className="h-4 w-4" /> Marcar como lidas
          </Button>
        )}
      </header>
      {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        : !lista.length ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma notificação. Aqui aparecem as visitas realizadas (com o retorno do corretor), os aceites, os pedidos de ajuda e os avisos de atraso.
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {visiveis.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => { if (!n.read) marcar.mutate([n.id]); navegar(destinoNotificacao(n)); }}
                    className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/60', !n.read && 'bg-primary/[0.04]')}>
                    <span className="mt-0.5 shrink-0">{iconeNotificacao(n)}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm', !n.read ? 'font-semibold' : 'font-medium')}>{n.title}</span>
                      <span className="line-clamp-3 block text-sm text-muted-foreground">{n.message}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{quando(n.created_at)}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />}
                  </button>
                </li>
              ))}
            </ul>
            {lista.length > 8 && (
              <button type="button" onClick={() => setTodas((t) => !t)} className="w-full border-t px-4 py-2 text-sm font-medium text-primary hover:bg-muted/60">
                {todas ? 'Mostrar menos' : `Ver todas (${lista.length})`}
              </button>
            )}
          </>
        )}
    </section>
  );
}

/** Alertas das conversas (os mesmos da aba Alertas): sem resposta, sinal de compra, pedido de ajuda… */
export function AlertasHoje() {
  const { data: alertas = [] } = useAlertas();
  if (!alertas.length) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-amber-200 bg-card shadow-sm" aria-label="Alertas das conversas">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
        <h2 className="text-sm font-semibold">Alertas das conversas</h2>
        <span className="rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-800 tabular-nums">{alertas.length}</span>
        <Link to="/conversas?aba=alertas" className="ml-auto text-xs font-medium text-primary hover:underline">Ver todos</Link>
      </header>
      <ul className="divide-y">
        {alertas.slice(0, 6).map((a) => (
          <li key={a.id}>
            <Link to={a.conversa_id ? `/conversas?c=${a.conversa_id}` : '/conversas?aba=alertas'} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/60">
              <MessagesSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{a.titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">{TIPO_ALERTA[a.tipo]?.rotulo ?? a.tipo}{a.detalhe ? ` · ${a.detalhe}` : ''} · {quando(a.criado_em)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
