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
    // A SDR pode remarcar ou cancelar a qualquer momento, e a virada do dia muda o "hoje"
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('visitas')
        .select('id, data_visita, horario_visita, status, local_nome, meeting_address, meeting_neighborhood, lead_id, leads(nome), empreendimentos(nome, imagem_url)')
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

/** Visitas do corretor que já aconteceram e ainda esperam ele contar como foram (últimos 7 dias). */
export function useVisitasParaContar() {
  return useQuery({
    queryKey: ['conversas', 'visitas-para-contar'],
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('visitas')
        .select('id, data_visita, horario_visita, status, lead_id, leads(nome), empreendimentos(nome, imagem_url)')
        .is('deleted_at', null).is('resultado_cliente', null)
        .gte('data_visita', daquiDiasISO(-7)).lte('data_visita', hojeISO())
        .in('status', ['agendada', 'confirmada', 'realizada'])
        .order('data_visita', { ascending: false }).order('horario_visita', { ascending: false });
      if (error) throw error;
      const agora = Date.now();
      // Só depois do horário marcado (com 30 min de folga, como o banco exige)
      return (data ?? []).filter((v) => new Date(`${v.data_visita}T${String(v.horario_visita).slice(0, 5)}:00-03:00`).getTime() - 30 * 60_000 <= agora);
    },
  });
}
export type VisitaParaContar = NonNullable<ReturnType<typeof useVisitasParaContar>['data']>[number];

export type ResultadoVisita = 'vai_comprar' | 'pensando' | 'nao_gostou' | 'quer_outros' | 'no_show';

export function useRegistrarVisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ visita, resultado, observacao }: { visita: string; resultado: ResultadoVisita; observacao?: string }) => {
      const { data, error } = await supabase.rpc('corretor_registrar_visita', {
        p_visita: visita, p_resultado: resultado, p_observacao: observacao?.trim() || null,
      });
      if (error) throw error;
      return data as { volta_para_sdr?: boolean };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: cc.raiz });
      toast.success(r?.volta_para_sdr ? 'Obrigado! A equipe da MeMude assume o cliente daqui.' : 'Obrigado! O cliente continua com você.');
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });
}

/** Corretor cria um lembrete (tarefa na Agenda); o celular avisa na hora marcada. */
export function useCriarLembrete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ titulo, quando, conversa, lead }: { titulo: string; quando: Date; conversa?: string | null; lead?: string | null }) => {
      const { error } = await supabase.rpc('minha_atividade_criar', {
        p_titulo: titulo.trim(), p_quando: quando.toISOString(), p_conversa: conversa ?? undefined, p_lead: lead ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cc.atividades });
      toast.success('Lembrete criado. O celular avisa na hora.');
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });
}
