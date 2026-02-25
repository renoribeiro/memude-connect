import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // CRM tables not yet in generated types

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
    notas: string | null;
    moved_at: string;
    created_at: string;
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
    };
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

export function useCrmPipeline(pipelineId?: string) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const pipelines = useQuery({
        queryKey: ['crm-pipelines'],
        queryFn: async () => {
            const { data, error } = await db
                .from('crm_pipelines')
                .select('*')
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: true });
            if (error) throw error;
            return data as CrmPipeline[];
        },
    });

    const stages = useQuery({
        queryKey: ['crm-stages', pipelineId],
        queryFn: async () => {
            if (!pipelineId) return [];
            const { data, error } = await db
                .from('crm_stages')
                .select('*')
                .eq('pipeline_id', pipelineId)
                .order('posicao', { ascending: true });
            if (error) throw error;
            return data as CrmStage[];
        },
        enabled: !!pipelineId,
    });

    const crmLeads = useQuery({
        queryKey: ['crm-leads', pipelineId],
        queryFn: async () => {
            if (!pipelineId) return [];
            const { data, error } = await db
                .from('crm_leads')
                .select(`
          *,
          leads (
            id, nome, telefone, email, status, origem, observacoes,
            empreendimento_id, corretor_designado_id,
            empreendimentos(nome),
            corretores(profiles(first_name, last_name))
          )
        `)
                .eq('pipeline_id', pipelineId)
                .order('posicao', { ascending: true });
            if (error) throw error;
            return data as CrmLead[];
        },
        enabled: !!pipelineId,
    });

    const automations = useQuery({
        queryKey: ['crm-automations', pipelineId],
        queryFn: async () => {
            if (!pipelineId) return [];
            const { data, error } = await db
                .from('crm_automations')
                .select('*, crm_stages(nome)')
                .eq('pipeline_id', pipelineId)
                .order('created_at', { ascending: true });
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
            toast({ title: 'Erro ao mover lead', variant: 'destructive' });
        },
    });

    const addLeadToPipeline = useMutation({
        mutationFn: async ({
            leadId,
            stageId,
            valorEstimado,
            notas,
        }: {
            leadId: string;
            stageId: string;
            valorEstimado?: number;
            notas?: string;
        }) => {
            if (!pipelineId) throw new Error('Pipeline não selecionado');
            const { error } = await db.from('crm_leads').insert({
                lead_id: leadId,
                pipeline_id: pipelineId,
                stage_id: stageId,
                valor_estimado: valorEstimado || null,
                notas: notas || null,
                posicao: 0,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-leads', pipelineId] });
            toast({ title: 'Lead adicionado ao funil' });
        },
        onError: (error: any) => {
            const msg = error?.message?.includes('duplicate')
                ? 'Este lead já está no funil'
                : 'Erro ao adicionar lead';
            toast({ title: msg, variant: 'destructive' });
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
            toast({ title: 'Lead removido do funil' });
        },
        onError: () => {
            toast({ title: 'Erro ao remover lead', variant: 'destructive' });
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

    const updatePipeline = useMutation({
        mutationFn: async ({
            id,
            ...data
        }: {
            id: string;
            nome?: string;
            descricao?: string;
            auto_add_visits?: boolean;
            is_default?: boolean;
        }) => {
            const { error } = await db
                .from('crm_pipelines')
                .update(data)
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
            toast({ title: 'Pipeline atualizado' });
        },
        onError: () => {
            toast({ title: 'Erro ao atualizar pipeline', variant: 'destructive' });
        },
    });

    const upsertStages = useMutation({
        mutationFn: async (
            stagesData: Array<{
                id?: string;
                pipeline_id: string;
                nome: string;
                cor: string;
                posicao: number;
                is_final?: boolean;
            }>
        ) => {
            if (!pipelineId) throw new Error('Pipeline não selecionado');

            // Delete stages not in the new list
            const existingIds = stagesData
                .filter((s) => s.id)
                .map((s) => s.id as string);

            if (existingIds.length > 0) {
                const { error: delError } = await db
                    .from('crm_stages')
                    .delete()
                    .eq('pipeline_id', pipelineId)
                    .not('id', 'in', `(${existingIds.join(',')})`);
                if (delError) throw delError;
            } else {
                const { error: delError } = await db
                    .from('crm_stages')
                    .delete()
                    .eq('pipeline_id', pipelineId);
                if (delError) throw delError;
            }

            // Upsert remaining
            for (const stage of stagesData) {
                if (stage.id) {
                    const { error } = await db
                        .from('crm_stages')
                        .update({
                            nome: stage.nome,
                            cor: stage.cor,
                            posicao: stage.posicao,
                            is_final: stage.is_final ?? false,
                        })
                        .eq('id', stage.id);
                    if (error) throw error;
                } else {
                    const { error } = await db
                        .from('crm_stages')
                        .insert({
                            pipeline_id: pipelineId,
                            nome: stage.nome,
                            cor: stage.cor,
                            posicao: stage.posicao,
                            is_final: stage.is_final ?? false,
                        });
                    if (error) throw error;
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-stages', pipelineId] });
            queryClient.invalidateQueries({ queryKey: ['crm-leads', pipelineId] });
            toast({ title: 'Etapas atualizadas' });
        },
        onError: () => {
            toast({ title: 'Erro ao salvar etapas', variant: 'destructive' });
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
        addLeadToPipeline,
        removeLeadFromPipeline,
        createPipeline,
        updatePipeline,
        upsertStages,
        createAutomation,
        toggleAutomation,
        deleteAutomation,
    };
}
