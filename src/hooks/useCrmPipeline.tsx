import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const db = supabase; // CRM tables now in generated types

export interface CrmPipeline {
    id: string;
    nome: string;
    descricao: string | null;
    is_default: boolean;
    auto_add_visits: boolean;
    created_at: string;
}

export interface CrmStage {
    id: string;
    pipeline_id: string;
    nome: string;
    cor: string;
    posicao: number;
    is_final: boolean;
}

export interface CrmLead {
    id: string;
    lead_id: string;
    pipeline_id: string;
    stage_id: string | null;
    posicao: number;
    valor_estimado: number | null;
    empreendimento_id: string | null;
    visita_id: string | null;
    notas: string | null;
    google_drive_url: string | null;
    moved_at: string;
    created_at: string;
    empreendimentos: { id: string; nome: string } | null;
    leads: {
        id: string;
        nome: string;
        telefone: string;
        email: string | null;
        status: string;
        origem: string;
        observacoes: string | null;
        empreendimento_id: string | null;
        corretor_designado_id: string | null;
        empreendimentos: { nome: string } | null;
        corretores: {
            profiles: { first_name: string; last_name: string };
        } | null;
    } | null;
}

export interface CrmAutomation {
    id: string;
    pipeline_id: string;
    nome: string;
    trigger_type: string;
    trigger_value: string | null;
    action_type: string;
    target_stage_id: string | null;
    is_active: boolean;
    crm_stages?: { nome: string } | null;
}

export interface CreateOpportunityInput {
    leadId: string;
    stageId: string;
    empreendimentoId?: string;
    valorEstimado?: number;
    notas?: string;
}

export interface CreateLeadOpportunityInput {
    nome: string;
    telefone: string;
    email?: string;
    origem: string;
    observacoes?: string;
    corretorDesignadoId?: string;
    stageId: string;
    empreendimentoId?: string;
    valorEstimado?: number;
    notas?: string;
}

interface SavePipelineConfigurationInput {
    id: string;
    nome: string;
    descricao: string;
    auto_add_visits: boolean;
    stages: Array<{
        id?: string;
        pipeline_id: string;
        nome: string;
        cor: string;
        posicao: number;
        is_final?: boolean;
    }>;
}

interface PipelineConfigurationRpc {
    rpc: (
        name: 'save_crm_pipeline_configuration',
        args: {
            p_pipeline_id: string;
            p_nome: string;
            p_descricao: string;
            p_auto_add_visits: boolean;
            p_stages: Array<{
                id?: string;
                nome: string;
                cor: string;
                is_final: boolean;
            }>;
        },
    ) => Promise<{ error: { message: string } | null }>;
}

export function useCrmPipeline(pipelineId?: string) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const pipelines = useQuery({
        queryKey: ['crm-pipelines'],
        queryFn: async ({ signal }) => {
            const { data, error } = await db
                .from('crm_pipelines')
                .select('id, nome, descricao, is_default, auto_add_visits, created_at')
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: true })
                .limit(100)
                .abortSignal(signal);
            if (error) throw error;
            return data as CrmPipeline[];
        },
    });

    const stages = useQuery({
        queryKey: ['crm-stages', pipelineId],
        queryFn: async ({ signal }) => {
            if (!pipelineId) return [];
            const { data, error } = await db
                .from('crm_stages')
                .select('id, pipeline_id, nome, cor, posicao, is_final')
                .eq('pipeline_id', pipelineId)
                .order('posicao', { ascending: true })
                .limit(200)
                .abortSignal(signal);
            if (error) throw error;
            return data as CrmStage[];
        },
        enabled: !!pipelineId,
    });

    const crmLeads = useQuery({
        queryKey: ['crm-leads', pipelineId],
        queryFn: async ({ signal }) => {
            if (!pipelineId) return [];
            const { data, error } = await db
                .from('crm_leads')
                .select(`
          id, lead_id, pipeline_id, stage_id, posicao, valor_estimado,
          empreendimento_id, visita_id,
          notas, google_drive_url, moved_at, created_at,
          empreendimentos(id, nome),
          leads (
            id, nome, telefone, email, status, origem, observacoes,
            empreendimento_id, corretor_designado_id,
            empreendimentos(nome),
            corretores(profiles(first_name, last_name))
          )
        `)
                .eq('pipeline_id', pipelineId)
                .order('posicao', { ascending: true })
                .limit(500)
                .abortSignal(signal);
            if (error) throw error;
            return data as CrmLead[];
        },
        enabled: !!pipelineId,
    });

    const automations = useQuery({
        queryKey: ['crm-automations', pipelineId],
        queryFn: async ({ signal }) => {
            if (!pipelineId) return [];
            const { data, error } = await db
                .from('crm_automations')
                .select('id, pipeline_id, nome, trigger_type, trigger_value, action_type, target_stage_id, is_active, crm_stages(nome)')
                .eq('pipeline_id', pipelineId)
                .order('created_at', { ascending: true })
                .limit(200)
                .abortSignal(signal);
            if (error) throw error;
            return data as CrmAutomation[];
        },
        enabled: !!pipelineId,
    });

    const moveLeadToStage = useMutation({
        mutationFn: async ({
            crmLeadId,
            newStageId,
            newPosition,
        }: {
            crmLeadId: string;
            newStageId: string;
            newPosition: number;
        }) => {
            const { error } = await db
                .from('crm_leads')
                .update({
                    stage_id: newStageId,
                    posicao: newPosition,
                    moved_at: new Date().toISOString(),
                })
                .eq('id', crmLeadId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-leads', pipelineId] });
        },
        onError: () => {
            toast({ title: 'Erro ao mover oportunidade', variant: 'destructive' });
        },
    });

    const createOpportunity = useMutation({
        mutationFn: async ({ leadId, stageId, empreendimentoId, valorEstimado, notas }: CreateOpportunityInput) => {
            if (!pipelineId) throw new Error('Pipeline não selecionado');
            const { data, error } = await db.rpc('create_crm_opportunity', {
                p_lead_id: leadId,
                p_pipeline_id: pipelineId,
                p_stage_id: stageId,
                p_empreendimento_id: empreendimentoId || undefined,
                p_valor_estimado: valorEstimado,
                p_notas: notas || undefined,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-leads', pipelineId] });
            toast({ title: 'Oportunidade criada com sucesso' });
        },
        onError: (error: Error) => {
            toast({
                title: 'Erro ao criar oportunidade',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const createLeadWithOpportunity = useMutation({
        mutationFn: async (input: CreateLeadOpportunityInput) => {
            if (!pipelineId) throw new Error('Pipeline não selecionado');
            const { data, error } = await db.rpc('create_lead_with_crm_opportunity', {
                p_input: {
                    nome: input.nome,
                    telefone: input.telefone,
                    email: input.email || null,
                    origem: input.origem,
                    observacoes: input.observacoes || null,
                    corretor_designado_id: input.corretorDesignadoId || null,
                    pipeline_id: pipelineId,
                    stage_id: input.stageId,
                    empreendimento_id: input.empreendimentoId || null,
                    valor_estimado: input.valorEstimado ?? null,
                    notas: input.notas || null,
                },
            });
            if (error) throw error;

            const result = data as { lead_id: string; opportunity_id: string };
            let distributionFailed = false;
            if (!input.corretorDesignadoId) {
                const { error: distributionError } = await supabase.functions.invoke('distribute-lead', {
                    body: { lead_id: result.lead_id },
                });
                distributionFailed = Boolean(distributionError);
            }

            return { ...result, distributionFailed };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['crm-leads', pipelineId] });
            toast({
                title: 'Lead e oportunidade criados',
                description: result.distributionFailed
                    ? 'Os registros foram salvos, mas a distribuição automática deverá ser iniciada novamente.'
                    : 'O novo atendimento já está disponível no funil.',
                variant: result.distributionFailed ? 'destructive' : 'default',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Erro ao cadastrar lead no funil',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const removeLeadFromPipeline = useMutation({
        mutationFn: async (crmLeadId: string) => {
            const { error } = await db
                .from('crm_leads')
                .delete()
                .eq('id', crmLeadId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-leads', pipelineId] });
            toast({ title: 'Oportunidade removida do funil' });
        },
        onError: () => {
            toast({ title: 'Erro ao remover oportunidade', variant: 'destructive' });
        },
    });

    const createPipeline = useMutation({
        mutationFn: async (data: {
            nome: string;
            descricao?: string;
            auto_add_visits?: boolean;
        }) => {
            const { data: result, error } = await db
                .from('crm_pipelines')
                .insert(data)
                .select()
                .single();
            if (error) throw error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
            toast({ title: 'Pipeline criado com sucesso' });
        },
        onError: () => {
            toast({ title: 'Erro ao criar pipeline', variant: 'destructive' });
        },
    });

    const deletePipeline = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await db
                .from('crm_pipelines')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
            toast({ title: 'Pipeline excluído com sucesso' });
        },
        onError: () => {
            toast({ title: 'Erro ao excluir pipeline', variant: 'destructive' });
        },
    });

    const savePipelineConfiguration = useMutation({
        mutationFn: async (data: SavePipelineConfigurationInput) => {
            if (!pipelineId || data.id !== pipelineId) {
                throw new Error('Pipeline não selecionado');
            }
            if (data.stages.length === 0) {
                throw new Error('O pipeline deve ter pelo menos uma etapa');
            }

            // O RPC é adicionado pela migração desta alteração. O cast local
            // evita editar manualmente o arquivo de tipos gerado pelo Supabase.
            const rpcClient = db as unknown as PipelineConfigurationRpc;
            const { error } = await rpcClient.rpc('save_crm_pipeline_configuration', {
                p_pipeline_id: data.id,
                p_nome: data.nome,
                p_descricao: data.descricao,
                p_auto_add_visits: data.auto_add_visits,
                p_stages: data.stages.map((stage) => ({
                    ...(stage.id ? { id: stage.id } : {}),
                    nome: stage.nome,
                    cor: stage.cor,
                    is_final: stage.is_final ?? false,
                })),
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
            queryClient.invalidateQueries({ queryKey: ['crm-stages', pipelineId] });
            queryClient.invalidateQueries({ queryKey: ['crm-leads', pipelineId] });
            toast({ title: 'Pipeline atualizado com sucesso' });
        },
        onError: (error: Error) => {
            toast({
                title: 'Erro ao salvar pipeline',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const createAutomation = useMutation({
        mutationFn: async (data: {
            nome: string;
            trigger_type: string;
            trigger_value?: string;
            target_stage_id: string;
        }) => {
            if (!pipelineId) throw new Error('Pipeline não selecionado');
            const { error } = await db.from('crm_automations').insert({
                ...data,
                pipeline_id: pipelineId,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['crm-automations', pipelineId],
            });
            toast({ title: 'Automação criada' });
        },
        onError: () => {
            toast({ title: 'Erro ao criar automação', variant: 'destructive' });
        },
    });

    const toggleAutomation = useMutation({
        mutationFn: async ({
            id,
            is_active,
        }: {
            id: string;
            is_active: boolean;
        }) => {
            const { error } = await db
                .from('crm_automations')
                .update({ is_active })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['crm-automations', pipelineId],
            });
        },
        onError: () => {
            toast({ title: 'Erro ao atualizar automação', variant: 'destructive' });
        },
    });

    const deleteAutomation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await db
                .from('crm_automations')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['crm-automations', pipelineId],
            });
            toast({ title: 'Automação removida' });
        },
        onError: () => {
            toast({ title: 'Erro ao remover automação', variant: 'destructive' });
        },
    });

    return {
        pipelines,
        stages,
        crmLeads,
        automations,
        moveLeadToStage,
        createOpportunity,
        createLeadWithOpportunity,
        removeLeadFromPipeline,
        createPipeline,
        deletePipeline,
        savePipelineConfiguration,
        createAutomation,
        toggleAutomation,
        deleteAutomation,
    };
}
