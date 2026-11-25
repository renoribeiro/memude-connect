import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { chamarFuncao, mensagemErro, subirAnexo, tipoDoArquivo } from '@/lib/conversas/servidor';
import type { ConversaItem, Filtro, Mensagem, MensagemLocal, Numero } from '@/lib/conversas/tipos';

export const cc = {
  raiz: ['conversas'] as const,
  lista: (filtro: string, busca: string) => ['conversas', 'lista', filtro, busca] as const,
  msgs: (id: string) => ['conversas', 'msgs', id] as const,
  sugestoes: (id: string) => ['conversas', 'sugestoes', id] as const,
  donos: (id: string) => ['conversas', 'donos', id] as const,
  alertas: ['conversas', 'alertas'] as const,
  numeros: ['conversas', 'numeros'] as const,
  respostas: ['conversas', 'respostas'] as const,
  clientes: ['conversas', 'clientes'] as const,
  convites: ['conversas', 'convites'] as const,
  atividades: ['conversas', 'atividades'] as const,
};

// ===== Tempo real =====

/** Mantém listas, sugestões e alertas atualizados (um canal só por tela, com agrupamento de eventos). */
export function useTempoRealConversas(ativo = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!ativo) return;
    let espera: ReturnType<typeof setTimeout> | null = null;
    const pendentes = new Set<string>();
    const agendar = (chave: string) => {
      pendentes.add(chave);
      if (espera) return;
      espera = setTimeout(() => {
        espera = null;
        for (const k of pendentes) qc.invalidateQueries({ queryKey: ['conversas', k] });
        pendentes.clear();
      }, 400);
    };
    const canal = supabase.channel(`conversas-geral-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas' }, () => { agendar('lista'); agendar('clientes'); agendar('uma'); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ia_sugestoes' }, () => agendar('sugestoes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conv_alertas' }, () => agendar('alertas'))
      .subscribe();
    return () => {
      if (espera) clearTimeout(espera);
      supabase.removeChannel(canal);
    };
  }, [ativo, qc]);
}

function mesclar(qc: QueryClient, conversaId: string, nova: Mensagem) {
  qc.setQueryData<MensagemLocal[]>(cc.msgs(conversaId), (atual) => {
    if (!atual) return atual;
    const idx = atual.findIndex((m) => m.id === nova.id);
    if (idx >= 0) {
      const copia = atual.slice();
      copia[idx] = { ...copia[idx], ...nova, local: undefined };
      return copia;
    }
    // A mensagem otimista vira a real quando o servidor confirma
    const local = atual.findIndex((m) => m.local && m.autor_id === nova.autor_id && m.tipo === nova.tipo
      && (m.texto ?? '') === (nova.texto ?? '') && nova.origem === 'app');
    if (local >= 0) {
      const copia = atual.slice();
      if (copia[local].previaUrl) URL.revokeObjectURL(copia[local].previaUrl!);
      copia[local] = nova;
      return copia;
    }
    return [...atual, nova].sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  });
}

// ===== Lista e mensagens =====

export function useListaConversas(filtro: Filtro, busca: string, ativo = true) {
  return useQuery({
    queryKey: cc.lista(filtro, busca),
    enabled: ativo,
    placeholderData: (anterior) => anterior,
    refetchInterval: 90_000,
    queryFn: async (): Promise<ConversaItem[]> => {
      const { data, error } = await supabase.rpc('conversas_listar', { p_filtro: filtro, p_busca: busca || null, p_limite: 300 });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Mensagens da conversa com tempo real; `limite` cresce com "carregar anteriores". */
export function useMensagens(conversaId: string | null, limite = 120) {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: cc.msgs(conversaId ?? '-'),
    enabled: !!conversaId,
    queryFn: async (): Promise<MensagemLocal[]> => {
      const { data, error } = await supabase.from('mensagens').select('*').eq('conversa_id', conversaId!)
        .order('criado_em', { ascending: false }).limit(limite);
      if (error) throw error;
      const servidor = (data ?? []).reverse() as MensagemLocal[];
      // Mantém as bolhas otimistas que o servidor ainda não confirmou (enviando ou com erro antes de gravar)
      const locais = (qc.getQueryData<MensagemLocal[]>(cc.msgs(conversaId!)) ?? []).filter((m) => m.local && !servidor.some((s) =>
        s.origem === 'app' && s.autor_id === m.autor_id && s.tipo === m.tipo && (s.texto ?? '') === (m.texto ?? '')));
      return [...servidor, ...locais];
    },
  });
  const { refetch } = consulta;
  useEffect(() => { if (limite > 120) refetch(); }, [limite, refetch]);

  useEffect(() => {
    if (!conversaId) return;
    const canal = supabase.channel(`conversa-${conversaId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens', filter: `conversa_id=eq.${conversaId}` },
        (p) => { if (p.new && 'id' in p.new) mesclar(qc, conversaId, p.new as Mensagem); })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [conversaId, qc]);

  return consulta;
}

export function useConversa(conversaId: string | null) {
  return useQuery({
    queryKey: ['conversas', 'uma', conversaId],
    enabled: !!conversaId,
    queryFn: async () => {
      const { data, error } = await supabase.from('conversas')
        .select('*, conv_numeros(nome, status), leads(id, nome, status_atendimento, qualificacao, empreendimento_id, fonte, observacoes, empreendimentos(nome))')
        .eq('id', conversaId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ===== Envio =====

export interface PedidoEnvio {
  conversaId: string; texto?: string; arquivo?: File; duracaoS?: number; respondeA?: Mensagem | null; nota?: boolean;
}

export function useEnviarMensagem() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async (p: PedidoEnvio) => {
      if (p.nota) {
        const { error } = await supabase.rpc('conversa_nota', { p_conversa: p.conversaId, p_texto: p.texto ?? '' });
        if (error) throw error;
        return;
      }
      let anexo: Awaited<ReturnType<typeof subirAnexo>> | null = null;
      if (p.arquivo) anexo = await subirAnexo(p.arquivo, user!.id);
      await chamarFuncao('conversas-enviar', {
        acao: 'enviar', conversa_id: p.conversaId, texto: p.texto ?? null,
        tipo: anexo ? tipoDoArquivo(anexo.mime) : 'texto',
        midia_path: anexo?.path, midia_mime: anexo?.mime, midia_nome: anexo?.nome, midia_bytes: anexo?.bytes,
        duracao_s: p.duracaoS ?? null, responde_a: p.respondeA?.id ?? null,
      });
    },
    onMutate: async (p) => {
      if (p.nota) return undefined;
      await qc.cancelQueries({ queryKey: cc.msgs(p.conversaId) });
      const local: MensagemLocal = {
        id: `local-${crypto.randomUUID()}`, conversa_id: p.conversaId, wa_id: null, direcao: 'saida',
        tipo: p.arquivo ? tipoDoArquivo(p.arquivo.type) : 'texto', texto: p.texto?.trim() || null,
        midia_path: null, midia_mime: p.arquivo?.type ?? null, midia_nome: p.arquivo?.name ?? null, midia_bytes: p.arquivo?.size ?? null,
        duracao_s: p.duracaoS ?? null, transcricao: null, autor_id: user?.id ?? null,
        autor_nome: [profile?.first_name, profile?.last_name].filter(Boolean).join(' '), origem: 'app', status: 'pendente',
        erro: null, responde_a: p.respondeA?.id ?? null, criado_em: new Date().toISOString(), local: true,
        previaUrl: p.arquivo ? URL.createObjectURL(p.arquivo) : undefined, arquivo: p.arquivo,
      };
      qc.setQueryData<MensagemLocal[]>(cc.msgs(p.conversaId), (a) => [...(a ?? []), local]);
      return { localId: local.id };
    },
    onError: (e, p, ctx) => {
      if (ctx?.localId) {
        qc.setQueryData<MensagemLocal[]>(cc.msgs(p.conversaId), (a) => (a ?? []).map((m) => (m.id === ctx.localId
          ? { ...m, status: 'erro', erro: mensagemErro(e) } : m)));
      }
      toast.error(mensagemErro(e));
    },
    onSettled: (_d, _e, p) => {
      qc.invalidateQueries({ queryKey: ['conversas', 'lista'] });
      // Se o tempo real atrasar, a lista de mensagens é recarregada do servidor
      setTimeout(() => {
        const atual = qc.getQueryData<MensagemLocal[]>(cc.msgs(p.conversaId));
        if (atual?.some((m) => m.local && m.status !== 'erro')) qc.invalidateQueries({ queryKey: cc.msgs(p.conversaId) });
      }, 4000);
    },
  });
}

export function useReenviar() {
  return useMutation({
    mutationFn: (mensagemId: string) => chamarFuncao('conversas-enviar', { acao: 'reenviar', mensagem_id: mensagemId }),
    onError: (e) => toast.error(mensagemErro(e)),
  });
}

/** Marca como lida no Connect e, para quem responde, também no WhatsApp do cliente (✓✓ azul). Uma vez por mensagem nova. */
export function useMarcarLida() {
  const qc = useQueryClient();
  const ultima = useRef<string | null>(null);
  return useCallback((conversaId: string, ultimaMensagemId: string, noWhatsApp: boolean) => {
    const chave = `${conversaId}:${ultimaMensagemId}`;
    if (ultima.current === chave) return;
    ultima.current = chave;
    supabase.rpc('conversa_marcar_lida', { p_conversa: conversaId }).then(() => qc.invalidateQueries({ queryKey: ['conversas', 'lista'] }));
    if (noWhatsApp) chamarFuncao('conversas-enviar', { acao: 'lida', conversa_id: conversaId }).catch(() => undefined);
  }, [qc]);
}

// ===== Ações da conversa =====

function useAcao<A>(fn: (a: A) => Promise<unknown>, sucesso?: string | ((a: A) => string)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, a) => {
      if (sucesso) toast.success(typeof sucesso === 'function' ? sucesso(a) : sucesso);
      qc.invalidateQueries({ queryKey: cc.raiz });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });
}

const rpc = async (nome: string, args: Record<string, unknown>) => {
  const { data, error } = await (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>)(nome, args);
  if (error) throw error;
  return data;
};

export const useAssumir = () => useAcao((id: string) => rpc('conversa_assumir', { p_conversa: id }), 'Agora a conversa é sua');
export const useTransferir = () => useAcao(
  (a: { id: string; para: string | null; papel: string; motivo?: string; nome?: string }) =>
    rpc('conversa_transferir', { p_conversa: a.id, p_para: a.para, p_papel: a.papel, p_motivo: a.motivo ?? null }),
  (a) => (a.nome ? `Conversa transferida para ${a.nome}` : 'Conversa devolvida para a fila da SDR'),
);
export const useArquivar = () => useAcao(
  (a: { id: string; arquivar: boolean }) => rpc('conversa_arquivar', { p_conversa: a.id, p_arquivar: a.arquivar }),
  (a) => (a.arquivar ? 'Conversa arquivada' : 'Conversa de volta à caixa de entrada'),
);
export const useMoverEtapa = () => useAcao((a: { id: string; etapa: string }) => rpc('conversa_mover_etapa', { p_conversa: a.id, p_etapa: a.etapa }));
export const useVincularLead = () => useAcao((a: { id: string; lead: string }) => rpc('conversa_vincular_lead', { p_conversa: a.id, p_lead: a.lead }), 'Lead vinculado');
export const useIniciarConversa = () => useAcao((a: { lead: string; numero?: string }) => rpc('conversa_iniciar', { p_lead: a.lead, p_numero: a.numero ?? null }));

// ===== IA =====

export function useSugestoes(conversaId: string | null) {
  return useQuery({
    queryKey: cc.sugestoes(conversaId ?? '-'),
    enabled: !!conversaId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ia_sugestoes').select('*').eq('conversa_id', conversaId!).eq('status', 'aberta')
        .order('criada_em', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDecidirSugestao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { id: string; aceitar: boolean; valor?: Record<string, unknown> }) => {
      const { error } = await supabase.rpc('ia_sugestao_decidir', { p_sugestao: a.id, p_aceitar: a.aceitar, p_valor: (a.valor ?? null) as never });
      if (error) throw error;
    },
    onSuccess: (_d, a) => {
      if (a.aceitar) toast.success('Feito! Ficou registrado no Connect.');
      qc.invalidateQueries({ queryKey: cc.raiz });
      qc.invalidateQueries({ queryKey: ['comercial'] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });
}

export function useHistoricoDono(conversaId: string | null) {
  return useQuery({
    queryKey: cc.donos(conversaId ?? '-'),
    enabled: !!conversaId,
    queryFn: async () => {
      const { data, error } = await supabase.from('conversa_donos').select('*').eq('conversa_id', conversaId!)
        .order('criado_em', { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ===== Alertas =====

export function useAlertas(ativo = true) {
  return useQuery({
    queryKey: cc.alertas,
    enabled: ativo,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('conv_alertas').select('*').is('resolvido_em', null)
        .order('criado_em', { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export const useResolverAlerta = () => useAcao((id: string) => rpc('conv_alerta_resolver', { p_alerta: id }));

// ===== Respostas rápidas =====

export function useRespostasRapidas() {
  return useQuery({
    queryKey: cc.respostas,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('respostas_rapidas').select('*').order('atalho');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export const useSalvarResposta = () => useAcao(
  (a: { id?: string | null; atalho: string; titulo: string; texto: string; equipe: boolean }) =>
    rpc('resposta_rapida_salvar', { p_id: a.id ?? null, p_atalho: a.atalho, p_titulo: a.titulo, p_texto: a.texto, p_equipe: a.equipe }),
  'Resposta rápida salva',
);
export const useExcluirResposta = () => useAcao((id: string) => rpc('resposta_rapida_excluir', { p_id: id }), 'Resposta rápida excluída');

// ===== Números (admin) =====

export function useNumeros(ativo = true) {
  return useQuery({
    queryKey: cc.numeros,
    enabled: ativo,
    queryFn: async (): Promise<Numero[]> => {
      const { data, error } = await supabase.from('conv_numeros').select('*').order('criado_em');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAcaoNumero() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (corpo: Record<string, unknown>) => chamarFuncao<{ numero?: Numero; qr?: string; codigo_pareamento?: string | null; ok?: boolean }>(
      'conversas-numeros', corpo),
    onSettled: () => qc.invalidateQueries({ queryKey: cc.numeros }),
    onError: (e) => toast.error(mensagemErro(e)),
  });
}

// ===== Desempenho =====

export function useDesempenho(dias: number) {
  return useQuery({
    queryKey: ['conversas', 'desempenho', dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('conversas_desempenho', { p_dias: dias });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Lista de conversas a partir da equipe (para transferir). */
export function useCorretoresComApp() {
  return useQuery({
    queryKey: ['conversas', 'corretores-app'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('corretores').select('id, status, profiles!inner(user_id, first_name, last_name)')
        .is('deleted_at', null).not('profiles.user_id', 'is', null);
      if (error) throw error;
      return (data ?? []).map((c) => {
        const p = c.profiles as unknown as { user_id: string; first_name: string | null; last_name: string | null };
        return { corretorId: c.id, userId: p.user_id, nome: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Corretor', ativo: c.status === 'ativo' };
      }).sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });
}

// ===== Mídia =====

/** Link temporário (1 h) para ver a mídia de uma conversa visível ao usuário. */
export function useMidiaUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['conversas', 'midia', path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('conversas').createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
