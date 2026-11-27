import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Notificacao {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  related_lead_id: string | null;
  related_visit_id: string | null;
  created_at: string;
  read_at: string | null;
}

export const CHAVE_NOTIFICACOES = ['notifications'] as const;

/** Notificações da própria pessoa (últimos 30 dias). O admin enxerga as de todos no banco; aqui é só a dele. */
export function useNotificacoes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...CHAVE_NOTIFICACOES, user?.id ?? ''],
    enabled: !!user?.id,
    queryFn: async () => {
      const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data, error } = await supabase.from('notifications')
        .select('id, user_id, type, title, message, read, metadata, related_lead_id, related_visit_id, created_at, read_at')
        .eq('user_id', user!.id).gte('created_at', desde)
        .order('created_at', { ascending: false }).limit(80);
      if (error) throw error;
      return (data ?? []) as Notificacao[];
    },
  });
}

export function useMarcarLidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase.from('notifications').update({ read: true, read_at: new Date().toISOString() }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_NOTIFICACOES }),
  });
}

/** Para onde a notificação leva (visita abre o painel na tela Hoje). */
export function destinoNotificacao(n: Notificacao): string {
  const url = typeof n.metadata?.url === 'string' ? n.metadata.url : null;
  if (url && url.startsWith('/')) return url;
  if (n.related_visit_id) return `/hoje?visita=${n.related_visit_id}`;
  if (n.related_lead_id) return `/leads/${n.related_lead_id}`;
  return '/hoje';
}
