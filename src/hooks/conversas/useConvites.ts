import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Convite } from '@/lib/conversas/tipos';
import { cc } from './dados';

/** Convites pendentes do corretor, com tempo real (o banco avisa quando a SDR manda um cliente). */
export function useConvites(ativo: boolean) {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: cc.convites,
    enabled: ativo,
    refetchInterval: 30_000,
    queryFn: async (): Promise<Convite[]> => {
      const { data, error } = await supabase.rpc('corretor_meus_convites');
      if (error) return []; // quem não é corretor não tem convites
      return data ?? [];
    },
  });
  useEffect(() => {
    if (!ativo) return;
    const canal = supabase.channel(`convites-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visita_convites' }, () => qc.invalidateQueries({ queryKey: cc.convites }))
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [ativo, qc]);
  return consulta;
}

