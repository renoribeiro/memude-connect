import { useState, useEffect } from "react";
import { Bell, CheckCircle, AlertCircle, Info, X, Calendar, UserPlus, Clock, XCircle, LifeBuoy, MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { CHAVE_NOTIFICACOES, destinoNotificacao, useMarcarLidas, useNotificacoes, type Notificacao } from "@/hooks/useNotificacoes";

export function iconeNotificacao(n: Pick<Notificacao, 'type' | 'metadata'>) {
  if (n.metadata?.tipo === 'pedido_ajuda') return <LifeBuoy className="h-4 w-4 text-rose-500" />;
  switch (n.type) {
    case 'new_lead':
    case 'lead_distributed':
      return <UserPlus className="h-4 w-4 text-blue-500" />;
    case 'lead_accepted':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'lead_rejected':
    case 'lead_timeout':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'new_visit':
    case 'visit_confirmed':
      return <Calendar className="h-4 w-4 text-teal-500" />;
    case 'visit_completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'visit_cancelled':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'distribution_timeout':
      return <Clock className="h-4 w-4 text-orange-500" />;
    case 'system_alert':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

/** Sininho do Connect: só as notificações da própria pessoa; visita realizada e pedido de ajuda abrem um pop-up. */
export function NotificationSystem() {
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<Notificacao | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: notifications = [], isLoading } = useNotificacoes();
  const marcar = useMarcarLidas();

  // Tempo real: só o que é para esta pessoa (antes, o admin recebia aviso de tudo de todos)
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notificacoes-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        queryClient.invalidateQueries({ queryKey: CHAVE_NOTIFICACOES });
        const n = payload.new as Notificacao;
        if (n.user_id !== user.id) return;
        if (n.metadata?.popup) setPopup(n);
        else toast({ title: n.title, description: n.message });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user?.id]);

  const abrir = (n: Notificacao) => {
    if (!n.read) marcar.mutate([n.id]);
    setOpen(false);
    setPopup(null);
    navigate(destinoNotificacao(n));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const fb = popup?.metadata as Record<string, string | boolean | null> | null | undefined;

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notificações: ${unreadCount} não lidas`}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Notificações</h3>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => marcar.mutate(notifications.filter((n) => !n.read).map((n) => n.id))} disabled={marcar.isPending}>
                Marcar todas como lidas
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setOpen(false); navigate('/hoje'); }}>Ver todas</Button>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Carregando...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent/30 ${notification.read ? 'bg-background' : 'bg-accent/50'}`}
                  onClick={() => abrir(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{iconeNotificacao(notification)}</div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium leading-snug">{notification.title}</p>
                      <p className="line-clamp-3 text-sm text-muted-foreground">{notification.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {!notification.read && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                        onClick={(e) => { e.stopPropagation(); marcar.mutate([notification.id]); }} aria-label="Marcar notificação como lida">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>

    {/* Pop-up: visita realizada / cliente não veio / pedido de ajuda */}
    <Dialog open={!!popup} onOpenChange={(o) => { if (!o && popup) { marcar.mutate([popup.id]); setPopup(null); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{popup && iconeNotificacao(popup)} {popup?.title}</DialogTitle>
          <DialogDescription>
            {[fb?.empreendimento, fb?.data, fb?.corretor && `Corretor: ${fb.corretor}`].filter(Boolean).join(' · ') || popup?.message}
          </DialogDescription>
        </DialogHeader>
        {fb?.feedback ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MessageSquareQuote className="h-3.5 w-3.5" /> {fb.rotulo ? String(fb.rotulo) : 'Retorno do corretor'}
            </p>
            <p className="whitespace-pre-wrap">{String(fb.feedback)}</p>
          </div>
        ) : popup?.message ? <p className="text-sm">{popup.message}</p> : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { if (popup) marcar.mutate([popup.id]); setPopup(null); }}>Ok, vi</Button>
          {popup && <Button onClick={() => abrir(popup)}>{popup.related_visit_id ? 'Abrir a visita' : 'Abrir'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

/**
 * Hook to programmatically create notifications
 */
export const useNotification = () => {
  const createNotification = async (notification: {
    user_id: string;
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, any>;
    related_lead_id?: string;
    related_visit_id?: string;
    related_corretor_id?: string;
  }) => {
    try {
      const { error } = await supabase.functions.invoke('create-notification', {
        body: notification,
      });

      if (error) throw error;

      toast({
        title: notification.title,
        description: notification.message,
      });
    } catch (error) {
      console.error('Error creating notification:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a notificação',
        variant: 'destructive',
      });
    }
  };

  return { createNotification };
};
