import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useCrmPipeline } from '@/hooks/useCrmPipeline';
import KanbanBoard from '@/components/crm/KanbanBoard';
import PipelineSettingsModal from '@/components/crm/PipelineSettingsModal';
import CrmAutomationsModal from '@/components/crm/CrmAutomationsModal';
import AddLeadToPipelineModal from '@/components/crm/AddLeadToPipelineModal';
import CrmLeadDetailPanel from '@/components/crm/CrmLeadDetailPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Zap, UserPlus, PlusCircle, Users, TrendingUp, Clock, Target } from 'lucide-react';
import type { CrmLead } from '@/hooks/useCrmPipeline';
import CreatePipelineModal from '@/components/crm/CreatePipelineModal';

export default function CRM() {
    const { profile } = useAuth();
    const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
    const [showSettings, setShowSettings] = useState(false);
    const [showAutomations, setShowAutomations] = useState(false);
    const [showAddLead, setShowAddLead] = useState(false);
    const [detailLead, setDetailLead] = useState<CrmLead | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const [showCreatePipeline, setShowCreatePipeline] = useState(false);

    const {
        pipelines,
        stages,
        crmLeads,
        automations,
        moveLeadToStage,
        addLeadToPipeline,
        removeLeadFromPipeline,
        createPipeline,
        updatePipeline,
        deletePipeline,
        upsertStages,
        createAutomation,
        toggleAutomation,
        deleteAutomation,
    } = useCrmPipeline(selectedPipelineId || undefined);

    // Auto-select default pipeline
    const activePipelineId = useMemo(() => {
        if (selectedPipelineId) return selectedPipelineId;
        const defaultPipeline = pipelines.data?.find((p) => p.is_default);
        const first = defaultPipeline ?? pipelines.data?.[0];
        if (first && !selectedPipelineId) {
            setSelectedPipelineId(first.id);
        }
        return first?.id ?? '';
    }, [pipelines.data, selectedPipelineId]);

    const currentPipeline = pipelines.data?.find((p) => p.id === activePipelineId);
    const stagesData = stages.data ?? [];
    const leadsData = crmLeads.data ?? [];
    const automationsData = automations.data ?? [];

    // Stats
    const totalLeads = leadsData.length;
    const leadsThisWeek = leadsData.filter((l) => {
        const d = new Date(l.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
    }).length;

    const avgTimeInStage = useMemo(() => {
        if (leadsData.length === 0) return '0d';
        const totalHours = leadsData.reduce((acc, l) => {
            const diff = Date.now() - new Date(l.moved_at).getTime();
            return acc + diff / (1000 * 60 * 60);
        }, 0);
        const avgHours = totalHours / leadsData.length;
        if (avgHours < 24) return `${Math.round(avgHours)}h`;
        return `${Math.round(avgHours / 24)}d`;
    }, [leadsData]);

    const totalEstimatedValue = leadsData.reduce(
        (acc, l) => acc + (l.valor_estimado || 0),
        0
    );

    const existingLeadIds = leadsData.map((l) => l.lead_id);

    const currentDetailStage = detailLead
        ? stagesData.find((s) => s.id === detailLead.stage_id) ?? null
        : null;

    if (!profile) return null;

    const isLoading = pipelines.isLoading || stages.isLoading || crmLeads.isLoading;

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header First Line: Title */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">CRM</h1>
                        <p className="text-muted-foreground">
                            Gerencie seus leads no funil de vendas
                        </p>
                    </div>
                </div>

                {/* Pipeline Tabs & Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1 w-full overflow-x-auto pb-1">
                        <Tabs value={activePipelineId} onValueChange={setSelectedPipelineId} className="w-full">
                            <TabsList className="h-10">
                                {pipelines.data?.map((p) => (
                                    <TabsTrigger key={p.id} value={p.id} className="min-w-[120px]">
                                        {p.nome}
                                    </TabsTrigger>
                                ))}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 ml-1 text-muted-foreground"
                                    onClick={() => setShowCreatePipeline(true)}
                                >
                                    <PlusCircle className="h-4 w-4 mr-1" />
                                    Novo Funil
                                </Button>
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAutomations(true)}
                            disabled={!activePipelineId}
                        >
                            <Zap className="h-4 w-4 mr-1.5" />
                            Automações
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSettings(true)}
                            disabled={!activePipelineId}
                        >
                            <Settings className="h-4 w-4 mr-1.5" />
                            Configurar
                        </Button>

                        <Button
                            size="sm"
                            onClick={() => setShowAddLead(true)}
                            disabled={!activePipelineId}
                        >
                            <UserPlus className="h-4 w-4 mr-1.5" />
                            Adicionar Lead
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                <Users className="h-4 w-4" />
                                Total no Funil
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalLeads}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                <PlusCircle className="h-4 w-4" />
                                Novos (7 dias)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{leadsThisWeek}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                <Clock className="h-4 w-4" />
                                Tempo Médio na Etapa
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{avgTimeInStage}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                <Target className="h-4 w-4" />
                                Valor Estimado
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {totalEstimatedValue > 0
                                    ? `R$ ${totalEstimatedValue.toLocaleString('pt-BR')}`
                                    : 'R$ 0'}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Kanban Board */}
                {isLoading ? (
                    <div className="flex gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="min-w-[300px]">
                                <Skeleton className="h-10 w-full mb-2 rounded-lg" />
                                <Skeleton className="h-24 w-full mb-2 rounded-lg" />
                                <Skeleton className="h-24 w-full rounded-lg" />
                            </div>
                        ))}
                    </div>
                ) : stagesData.length === 0 ? (
                    <Card className="py-12">
                        <CardContent className="text-center">
                            <Settings className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <h3 className="text-lg font-medium mb-1">Nenhuma etapa configurada</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Configure as etapas do seu funil para começar a organizar os leads
                            </p>
                            <Button onClick={() => setShowSettings(true)}>
                                <Settings className="h-4 w-4 mr-2" />
                                Configurar Pipeline
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <KanbanBoard
                        stages={stagesData}
                        leads={leadsData}
                        onMoveLead={(crmLeadId, newStageId, newPosition) => {
                            moveLeadToStage.mutate({ crmLeadId, newStageId, newPosition });
                        }}
                        onCardClick={(crmLead) => {
                            setDetailLead(crmLead);
                            setShowDetail(true);
                        }}
                        onRemoveLead={(crmLeadId) => {
                            removeLeadFromPipeline.mutate(crmLeadId);
                        }}
                        onConfigureClick={() => setShowSettings(true)}
                    />
                )}
            </div>

            {/* Modals */}
            {currentPipeline && (
                <>
                    <PipelineSettingsModal
                        open={showSettings}
                        onOpenChange={setShowSettings}
                        pipelineName={currentPipeline.nome}
                        pipelineDescription={currentPipeline.descricao ?? ''}
                        autoAddVisits={currentPipeline.auto_add_visits}
                        isDefault={currentPipeline.is_default || false}
                        stages={stagesData}
                        pipelineId={activePipelineId}
                        isSaving={upsertStages.isPending || updatePipeline.isPending}
                        onSave={async (data) => {
                            await updatePipeline.mutateAsync({
                                id: activePipelineId,
                                nome: data.nome,
                                descricao: data.descricao || undefined,
                                auto_add_visits: data.auto_add_visits,
                            });
                            await upsertStages.mutateAsync(data.stages);
                            setShowSettings(false);
                        }}
                        onDelete={() => {
                            deletePipeline.mutate(activePipelineId, {
                                onSuccess: () => {
                                    setShowSettings(false);
                                    setSelectedPipelineId('');
                                }
                            });
                        }}
                    />

                    <CreatePipelineModal
                        open={showCreatePipeline}
                        onOpenChange={setShowCreatePipeline}
                        isCreating={createPipeline.isPending}
                        onCreate={(data) => {
                            createPipeline.mutate(data, {
                                onSuccess: (newPipeline) => {
                                    setShowCreatePipeline(false);
                                    setSelectedPipelineId(newPipeline.id);
                                }
                            });
                        }}
                    />

                    <CrmAutomationsModal
                        open={showAutomations}
                        onOpenChange={setShowAutomations}
                        automations={automationsData}
                        stages={stagesData}
                        isCreating={createAutomation.isPending}
                        onCreateAutomation={(data) => createAutomation.mutate(data)}
                        onToggleAutomation={(id, is_active) =>
                            toggleAutomation.mutate({ id, is_active })
                        }
                        onDeleteAutomation={(id) => deleteAutomation.mutate(id)}
                    />

                    <AddLeadToPipelineModal
                        open={showAddLead}
                        onOpenChange={setShowAddLead}
                        pipelineId={activePipelineId}
                        stages={stagesData}
                        existingLeadIds={existingLeadIds}
                        isAdding={addLeadToPipeline.isPending}
                        onAdd={(leadId, stageId, valorEstimado) => {
                            addLeadToPipeline.mutate(
                                { leadId, stageId, valorEstimado },
                                { onSuccess: () => setShowAddLead(false) }
                            );
                        }}
                    />

                    <CrmLeadDetailPanel
                        open={showDetail}
                        onOpenChange={setShowDetail}
                        crmLead={detailLead}
                        currentStage={currentDetailStage}
                        pipelineId={activePipelineId}
                    />
                </>
            )}
        </DashboardLayout>
    );
}
