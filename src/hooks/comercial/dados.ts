import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { dataISO, hojeISO, somarDias } from '@/lib/comercial/datas';
import type { TemplateMensagem } from '@/lib/comercial/mensagens';

export const chaves = {
  leads: ['comercial', 'leads'] as const,
  lead: (id: string) => ['comercial', 'lead', id] as const,
  visitas: ['comercial', 'visitas'] as const,
  visita: (id: string) => ['comercial', 'visita', id] as const,
  tarefas: ['comercial', 'tarefas'] as const,
};

function mensagemErro(erro: unknown): string {
  const e = erro as { message?: string; details?: string };
  return e?.message || 'Não foi possível concluir. Tente novamente.';
}

// ===== Referências =====
export function useConfigComercial(ativo = true) {
  return useQuery({
    queryKey: ['comercial', 'config'],
    enabled: ativo,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('fase1_config').select('*').eq('id', true).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useEquipe() {
  return useQuery({
    queryKey: ['comercial', 'equipe'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('equipe_comercial');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface EmpreendimentoOpcao {
  id: string;
  nome: string;
  endereco: string | null;
  bairro: string | null;
  wp_post_id: number | null;
}

export function useEmpreendimentos() {
  return useQuery({
    queryKey: ['comercial', 'empreendimentos'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<EmpreendimentoOpcao[]> => {
      const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome, endereco, wp_post_id, bairros(nome)')
        .eq('ativo', true)
        .order('nome')
        .limit(2000);
      if (error) throw error;
      return (data ?? []).map((e) => ({
        id: e.id, nome: e.nome, endereco: e.endereco, wp_post_id: e.wp_post_id,
        bairro: (e.bairros as { nome: string } | null)?.nome ?? null,
      }));
    },
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: ['comercial', 'templates'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<TemplateMensagem[]> => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('id, name, content, metadata')
        .eq('metadata->>fase1', 'true')
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? [])
        .map((t) => {
          const m = (t.metadata ?? {}) as Record<string, string | number>;
          return {
            id: t.id, nome: t.name, conteudo: t.content, chave: String(m.chave),
            momento: m.momento, destino: m.destino, quem: m.quem, ordem: Number(m.ordem ?? 0),
          } as TemplateMensagem;
        })
        .sort((a, b) => a.ordem - b.ordem);
    },
  });
}

// ===== Leads (grade) =====
export type FiltroSalvo = 'todos' | 'novos' | 'interessados' | 'visitas_semana' | 'meus';

export interface FiltrosLeads {
  busca: string;
  salvo: FiltroSalvo;
  status: string[];
  fontes: string[];
  responsavel: string | null;
  empreendimento: string | null;
  ordem: { coluna: 'nome' | 'fonte' | 'status_atendimento' | 'data_entrada'; asc: boolean };
  pagina: number;
  porPagina: number;
}

export interface LinhaLead {
  id: string;
  nome: string;
  telefone: string;
  telefone_exibicao: string | null;
  empreendimento_id: string | null;
  fonte: string | null;
  status_atendimento: string;
  responsavel_id: string | null;
  data_entrada: string;
  telefone_chave_conflito: boolean;
  planilha_extra: Record<string, unknown> | null;
  proxima_visita: { id: string; data_visita: string; horario_visita: string; status: string } | null;
}

const limparBusca = (q: string) => q.replace(/[%,()*\\]/g, ' ').trim();

export function useLeadsGrade(f: FiltrosLeads) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...chaves.leads, f, user?.id],
    placeholderData: (anterior) => anterior,
    queryFn: async () => {
      let idsSemana: string[] | null = null;
      if (f.salvo === 'visitas_semana') {
        const hoje = hojeISO();
        const dow = new Date(`${hoje}T12:00:00Z`).getUTCDay();
        const segunda = somarDias(hoje, dow === 0 ? -6 : 1 - dow);
        const { data, error } = await supabase
          .from('visitas').select('lead_id')
          .gte('data_visita', segunda).lte('data_visita', somarDias(segunda, 6))
          .is('deleted_at', null).in('status', ['aguardando_corretor', 'agendada', 'confirmada', 'realizada', 'no_show']);
        if (error) throw error;
        idsSemana = [...new Set((data ?? []).map((v) => v.lead_id))];
        if (!idsSemana.length) return { linhas: [] as LinhaLead[], total: 0 };
      }

      let q = supabase
        .from('leads')
        .select('id, nome, telefone, telefone_exibicao, empreendimento_id, fonte, status_atendimento, responsavel_id, data_entrada, telefone_chave_conflito, planilha_extra', { count: 'exact' })
        .is('deleted_at', null);

      const busca = limparBusca(f.busca);
      if (busca) {
        const digitos = busca.replace(/\D/g, '');
        q = digitos.length >= 4
          ? q.or(`nome.ilike.%${busca}%,telefone.ilike.%${digitos.slice(-8)}%`)
          : q.ilike('nome', `%${busca}%`);
      }
      if (f.salvo === 'novos') q = q.eq('status_atendimento', 'NOVO');
      if (f.salvo === 'interessados') q = q.eq('status_atendimento', 'INTERESSADO');
      if (f.salvo === 'meus' && user) q = q.eq('responsavel_id', user.id);
      if (idsSemana) q = q.in('id', idsSemana);
      if (f.status.length) q = q.in('status_atendimento', f.status);
      if (f.fontes.length) q = q.in('fonte', f.fontes);
      if (f.responsavel) q = f.responsavel === 'sem' ? q.is('responsavel_id', null) : q.eq('responsavel_id', f.responsavel);
      if (f.empreendimento) q = q.eq('empreendimento_id', f.empreendimento);

      const de = f.pagina * f.porPagina;
      const { data, error, count } = await q
        .order(f.ordem.coluna, { ascending: f.ordem.asc, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(de, de + f.porPagina - 1);
      if (error) throw error;

      const ids = (data ?? []).map((l) => l.id);
      const proximas = new Map<string, LinhaLead['proxima_visita']>();
      if (ids.length) {
        const { data: vs, error: ev } = await supabase
          .from('visitas').select('id, lead_id, data_visita, horario_visita, status')
          .in('lead_id', ids).is('deleted_at', null)
          .in('status', ['aguardando_corretor', 'agendada', 'confirmada'])
          .gte('data_visita', hojeISO())
          .order('data_visita').order('horario_visita');
        if (ev) throw ev;
        for (const v of vs ?? []) if (!proximas.has(v.lead_id)) proximas.set(v.lead_id, v);
      }
      return {
        linhas: (data ?? []).map((l) => ({ ...l, proxima_visita: proximas.get(l.id) ?? null })) as LinhaLead[],
        total: count ?? 0,
      };
    },
  });
}

export function useAtualizarLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campos }: { id: string; campos: Record<string, unknown> }) => {
      const { data, error } = await supabase.rpc('lead_atualizar', { p_lead_id: id, p_campos: campos as never });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: chaves.leads });
      qc.invalidateQueries({ queryKey: chaves.lead(v.id) });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });
}

export interface ResultadoCriarLead {
  criado: boolean;
  duplicado: boolean;
  lead_id: string;
  lead: { id: string; nome: string; telefone_exibicao: string; status_atendimento: string; responsavel: string | null; empreendimento: string | null };
}

export function useCriarLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: Record<string, unknown>): Promise<ResultadoCriarLead> => {
      const { data, error } = await supabase.rpc('lead_criar', { p_dados: dados as never });
      if (error) throw error;
      return data as unknown as ResultadoCriarLead;
    },
    onSuccess: (r) => {
      if (r.criado) qc.invalidateQueries({ queryKey: chaves.leads });
    },
  });
}

export async function buscarLeadPorTelefone(telefone: string) {
  const { data, error } = await supabase.rpc('lead_buscar_por_telefone', { p_telefone: telefone });
  if (error) throw error;
  return data as unknown as { existe: boolean; valido: boolean; lead: ResultadoCriarLead['lead'] | null };
}

// ===== Perfil do lead =====
export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: chaves.lead(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const [lead, eventos, visitas, oportunidades] = await Promise.all([
        supabase.from('leads').select('*, empreendimentos(id, nome, wp_post_id)').eq('id', id!).single(),
        supabase.from('lead_eventos').select('*').eq('lead_id', id!).order('criado_em', { ascending: false }).limit(200),
        supabase.from('visitas')
          .select('id, data_visita, horario_visita, status, local_nome, meeting_address, created_at, empreendimentos(nome), corretores(profiles(first_name, last_name))')
          .eq('lead_id', id!).is('deleted_at', null).order('data_visita', { ascending: false }),
        supabase.from('crm_leads')
          .select('id, valor_estimado, tag, created_at, moved_at, crm_stages(nome, cor), crm_pipelines(nome), empreendimentos(nome)')
          .eq('lead_id', id!).order('created_at', { ascending: false }),
      ]);
      if (lead.error) throw lead.error;
      return {
        lead: lead.data,
        eventos: eventos.data ?? [],
        visitas: visitas.data ?? [],
        oportunidades: oportunidades.error ? [] : oportunidades.data ?? [],
      };
    },
  });
}

// ===== Visitas =====
const SELECT_VISITA_LISTA = 'id, visit_code, data_visita, horario_visita, status, local_nome, meeting_address, meeting_neighborhood, fase1, criado_por, corretor_id, empreendimento_id, lead_id, leads(id, nome, telefone, telefone_exibicao, fonte), empreendimentos(id, nome), corretores(id, whatsapp, profiles(first_name, last_name))' as const;

export function useVisitasPeriodo(inicio: string, fim: string) {
  return useQuery({
    queryKey: [...chaves.visitas, inicio, fim],
    placeholderData: (anterior) => anterior,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitas').select(SELECT_VISITA_LISTA)
        .gte('data_visita', inicio).lte('data_visita', fim).is('deleted_at', null)
        .order('data_visita').order('horario_visita').limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useVisita(id: string | null) {
  return useQuery({
    queryKey: chaves.visita(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const [v, ciclo, convites, tarefas, eventos] = await Promise.all([
        supabase.from('visitas')
          .select('*, leads(id, nome, telefone, telefone_exibicao, fonte, observacoes), empreendimentos(id, nome, wp_post_id, endereco), corretores(id, whatsapp, telefone, profiles(first_name, last_name))')
          .eq('id', id!).single(),
        supabase.from('visit_cycles').select('*').eq('visita_id', id!).maybeSingle(),
        supabase.from('visita_convites').select('*, corretores(profiles(first_name, last_name))').eq('visita_id', id!).order('enviado_em', { ascending: false }),
        supabase.from('tarefas').select('*').eq('visita_id', id!).order('vence_em'),
        supabase.from('visit_events').select('id, kind, payload, created_at, ator_id').eq('visita_id', id!).order('created_at', { ascending: false }).limit(200),
      ]);
      if (v.error) throw v.error;
      let anterior: { id: string; data_visita: string; horario_visita: string } | null = null;
      let proxima: { id: string; data_visita: string; horario_visita: string } | null = null;
      if (ciclo.data?.previous_visita_id) {
        const { data } = await supabase.from('visitas').select('id, data_visita, horario_visita').eq('id', ciclo.data.previous_visita_id).maybeSingle();
        anterior = data;
      }
      const { data: seguinte } = await supabase.from('visit_cycles').select('visita_id').eq('previous_visita_id', id!).maybeSingle();
      if (seguinte) {
        const { data } = await supabase.from('visitas').select('id, data_visita, horario_visita').eq('id', seguinte.visita_id).maybeSingle();
        proxima = data;
      }
      return {
        visita: v.data,
        ciclo: ciclo.data,
        convites: convites.data ?? [],
        tarefas: tarefas.data ?? [],
        eventos: eventos.data ?? [],
        anterior,
        proxima,
      };
    },
  });
}

export function useSugestoesCorretor(params: {
  empreendimentoId: string | null; data: string | null; hora: string | null; visitaId?: string | null; excluir?: string[]; ativo?: boolean;
}) {
  return useQuery({
    queryKey: ['comercial', 'sugestoes', params],
    enabled: !!params.empreendimentoId && params.ativo !== false,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('corretores_sugeridos', {
        p_empreendimento_id: params.empreendimentoId!,
        p_data: params.data || undefined,
        p_hora: params.hora || undefined,
        p_visita_id: params.visitaId || undefined,
        p_excluir: params.excluir ?? [],
        p_limite: 50,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Executa uma RPC do ciclo de visita e atualiza tudo que depende dela. */
export function useAcaoVisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rpc, args }: { rpc: string; args: Record<string, unknown>; sucesso?: string }) => {
      const { data, error } = await supabase.rpc(rpc as never, args as never);
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['comercial'] });
      if (v.sucesso) toast.success(v.sucesso);
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });
}

export async function registrarUsoMensagem(visitaId: string, template: string, destino: string, acao: 'copiar' | 'whatsapp') {
  await supabase.rpc('mensagem_registrar_uso', { p_visita_id: visitaId, p_template: template, p_destino: destino, p_acao: acao });
}

// ===== Tarefas (tela Hoje) =====
export function useTarefasPendentes() {
  return useQuery({
    queryKey: chaves.tarefas,
    refetchInterval: 120_000,
    queryFn: async () => {
      const fimDoDia = new Date(`${somarDias(hojeISO(), 1)}T00:00:00-03:00`).toISOString();
      const { data, error } = await supabase
        .from('tarefas')
        .select('*, visitas(id, visit_code, data_visita, horario_visita, status, local_nome, tentativas_remarcar, no_show_em, escalada_em, leads(nome, telefone_exibicao), empreendimentos(nome), corretores(profiles(first_name, last_name))), leads(id, nome)')
        .eq('status', 'pendente')
        .lt('disponivel_em', fimDoDia)
        .order('vence_em')
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ===== Atividades agendadas (próximo passo pós-visita e lembretes) na Agenda =====
export function useAtividadesPeriodo(inicio: string, fim: string) {
  return useQuery({
    queryKey: ['comercial', 'atividades', inicio, fim],
    queryFn: async () => {
      const de = new Date(`${inicio}T00:00:00-03:00`).toISOString();
      const ate = new Date(`${somarDias(fim, 1)}T00:00:00-03:00`).toISOString();
      const { data, error } = await supabase
        .from('tarefas')
        .select('id, tipo, titulo, status, disponivel_em, vence_em, observacao, dono_id, visita_id, lead_id, leads(id, nome)')
        .in('tipo', ['atividade', 'manual'])
        .neq('status', 'cancelada')
        .gte('disponivel_em', de)
        .lt('disponivel_em', ate)
        .order('disponivel_em')
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ===== Histórico completo do cliente (card do CRM) =====
export type ItemHistorico = {
  id: string; quando: string; ator_id: string | null;
  origem: 'lead' | 'visita' | 'atividade';
  tipo: string; payload?: unknown; campo?: string | null; de?: string | null; para?: string | null; observacao?: string | null;
  titulo?: string | null; status?: string | null; visita?: { data_visita: string; empreendimento: string | null } | null;
};

export function useHistoricoLead(leadId: string | null | undefined, ativo = true) {
  return useQuery({
    queryKey: ['comercial', 'historico-lead', leadId ?? ''],
    enabled: !!leadId && ativo,
    queryFn: async () => {
      const { data: visitas, error: ev } = await supabase.from('visitas')
        .select('id, data_visita, empreendimentos(nome)').eq('lead_id', leadId!).is('deleted_at', null);
      if (ev) throw ev;
      const ids = (visitas ?? []).map((v) => v.id);
      const porVisita = new Map((visitas ?? []).map((v) => [v.id, { data_visita: v.data_visita, empreendimento: (v.empreendimentos as { nome: string } | null)?.nome ?? null }]));
      const [lead, eventos, atividades] = await Promise.all([
        supabase.from('lead_eventos').select('id, tipo, campo, de, para, observacao, ator_id, criado_em').eq('lead_id', leadId!)
          .order('criado_em', { ascending: false }).limit(300),
        ids.length
          ? supabase.from('visit_events').select('id, visita_id, kind, payload, created_at, ator_id').in('visita_id', ids)
            .order('created_at', { ascending: false }).limit(500)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('tarefas').select('id, tipo, titulo, status, disponivel_em, criado_em, dono_id, visita_id').eq('lead_id', leadId!)
          .in('tipo', ['atividade', 'manual']).neq('status', 'cancelada').order('criado_em', { ascending: false }).limit(100),
      ]);
      if (lead.error) throw lead.error;
      const itens: ItemHistorico[] = [
        ...(lead.data ?? []).map((e) => ({
          id: `l-${e.id}`, quando: e.criado_em, ator_id: e.ator_id, origem: 'lead' as const, tipo: e.tipo,
          campo: e.campo, de: e.de, para: e.para, observacao: e.observacao,
        })),
        ...((eventos.data ?? []) as { id: string; visita_id: string; kind: string; payload: unknown; created_at: string; ator_id: string | null }[])
          // As 341 importações da planilha não dizem nada para quem lê o card
          .filter((e) => e.kind !== 'f1_importada')
          .map((e) => ({
            id: `v-${e.id}`, quando: e.created_at, ator_id: e.ator_id, origem: 'visita' as const, tipo: e.kind, payload: e.payload,
            visita: porVisita.get(e.visita_id) ?? null,
          })),
        ...(atividades.data ?? []).map((t) => ({
          id: `t-${t.id}`, quando: t.criado_em, ator_id: t.dono_id, origem: 'atividade' as const, tipo: t.tipo,
          titulo: t.titulo, status: t.status, para: t.disponivel_em,
        })),
      ];
      return itens.sort((a, b) => b.quando.localeCompare(a.quando));
    },
  });
}

export function useVisitasDoDia() {
  const hoje = hojeISO();
  return useVisitasPeriodo(hoje, hoje);
}

export { dataISO };

// ===== Leads: ações em massa e lixeira =====
export function useLeadsEmMassa() {
  const qc = useQueryClient();
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: chaves.leads });
    qc.invalidateQueries({ queryKey: ['crm-leads'] });
  };
  const excluir = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.rpc('leads_excluir', { p_ids: ids });
      if (error) throw error;
      return data as { excluidos: number; ids: string[] };
    },
    onSuccess: invalidar,
    onError: (e) => toast.error(mensagemErro(e)),
  });
  const restaurar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.rpc('leads_restaurar', { p_ids: ids });
      if (error) throw error;
      return data as { restaurados: number };
    },
    onSuccess: invalidar,
    onError: (e) => toast.error(mensagemErro(e)),
  });
  const alterar = useMutation({
    mutationFn: async ({ ids, campos }: { ids: string[]; campos: Record<string, unknown> }) => {
      const { data, error } = await supabase.rpc('leads_em_massa', { p_ids: ids, p_campos: campos as never });
      if (error) throw error;
      return data as { alterados: number };
    },
    onSuccess: invalidar,
    onError: (e) => toast.error(mensagemErro(e)),
  });
  return { excluir, restaurar, alterar };
}
