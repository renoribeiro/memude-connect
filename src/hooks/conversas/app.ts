import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { daquiDiasISO, hojeISO } from '@/lib/conversas/agenda';
import { mensagemErro } from '@/lib/conversas/servidor';
import { cc } from './dados';

/** Atividades pendentes do corretor (lembretes, retornos, tarefas da visita). */
export function useAtividades() {
  return useQuery({
    queryKey: cc.atividades,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_atividades');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useConcluirAtividade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('minha_atividade_concluir', { p_tarefa: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Atividade concluída'); qc.invalidateQueries({ queryKey: cc.atividades }); },
    onError: (e) => toast.error(mensagemErro(e)),
  });
}

/** Visitas do corretor de hoje até daqui 7 dias (a RLS só devolve as dele). */
export function useMinhasVisitas() {
  return useQuery({
    queryKey: ['conversas', 'minhas-visitas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('visitas')
        .select('id, data_visita, horario_visita, status, local_nome, meeting_neighborhood, lead_id, leads(nome), empreendimentos(nome)')
        .is('deleted_at', null).gte('data_visita', hojeISO()).lte('data_visita', daquiDiasISO(7))
        .in('status', ['agendada', 'confirmada', 'aguardando_corretor']).order('data_visita').order('horario_visita');
      if (error) throw error;
      return data ?? [];
    },
  });
}
export type MinhaVisita = NonNullable<ReturnType<typeof useMinhasVisitas>['data']>[number];

/** Conversa de cada lead (para abrir o chat a partir da visita). */
export function useConversaDoLead(leadIds: (string | null)[]) {
  const ids = [...new Set(leadIds.filter(Boolean) as string[])].sort();
  return useQuery({
    queryKey: ['conversas', 'por-lead', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('conversas').select('id, lead_id').in('lead_id', ids);
      return Object.fromEntries((data ?? []).map((c) => [c.lead_id, c.id])) as Record<string, string>;
    },
  });
}

/** Clientes do corretor com a próxima visita e o empreendimento. */
export function useMeusClientes() {
  return useQuery({
    queryKey: cc.clientes,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('corretor_meus_clientes');
      if (error) throw error;
      return data ?? [];
    },
  });
}
