import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bot, MessageSquare, Plus, Settings, BarChart3, Power, Trash2, Eye, Users } from "lucide-react";
import { AgentEditor } from "@/components/ai-agents/AgentEditor";
import { ConversationMonitor } from "@/components/ai-agents/ConversationMonitor";
import { LeadQualificationView } from "@/components/ai-agents/LeadQualificationView";
import { AIMetricsCard } from "@/components/ai-agents/AIMetricsCard";

interface AIAgent {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    persona_name: string;
    persona_role: string;
    llm_provider: 'openai' | 'gemini';
    ai_model: string;
    created_at: string;
    total_conversations?: number;
    total_leads_qualified?: number;
}

const AIAgents = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
    const [showEditor, setShowEditor] = useState(false);
    const [showMonitor, setShowMonitor] = useState(false);

    // Fetch agents
    const { data: agents, isLoading } = useQuery({
        queryKey: ['ai-agents'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ai_agents')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as AIAgent[];
        }
    });

    // Fetch conversation stats for each agent
    const { data: stats } = useQuery({
        queryKey: ['ai-agents-stats'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('agent_conversations')
                .select('agent_id, status');

            if (error) return {};

            const statsMap: Record<string, { total: number; completed: number }> = {};
            data?.forEach(conv => {
                if (!statsMap[conv.agent_id]) {
                    statsMap[conv.agent_id] = { total: 0, completed: 0 };
                }
                statsMap[conv.agent_id].total++;
                if (conv.status === 'completed') {
                    statsMap[conv.agent_id].completed++;
                }
            });
            return statsMap;
        }
    });

    // Toggle agent active status
    const toggleMutation = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            // If activating, first deactivate all other agents
            if (is_active) {
                await supabase
                    .from('ai_agents')
                    .update({ is_active: false })
                    .neq('id', id);
            }

            const { error } = await supabase
                .from('ai_agents')
                .update({ is_active })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
            toast({
                title: "Status atualizado",
                description: "O status do agente foi atualizado com sucesso."
            });
        },
        onError: (error: any) => {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    // Delete agent
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('ai_agents')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
            toast({
                title: "Agente excluído",
                description: "O agente foi excluído com sucesso."
            });
        },
        onError: (error: any) => {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const handleCreateNew = () => {
        setSelectedAgent(null);
        setShowEditor(true);
    };

    const handleEdit = (agent: AIAgent) => {
        setSelectedAgent(agent);
        setShowEditor(true);
    };

    const handleViewConversations = (agent: AIAgent) => {
        setSelectedAgent(agent);
        setShowMonitor(true);
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Bot className="h-8 w-8 text-primary" />
                            Agentes de IA
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Configure agentes inteligentes para qualificação de leads via WhatsApp
                        </p>
                    </div>

                    <Button onClick={handleCreateNew}>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Agente
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Agentes Ativos
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {agents?.filter(a => a.is_active).length || 0}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total de Agentes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {agents?.length || 0}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Conversas Hoje
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {Object.values(stats || {}).reduce((sum, s) => sum + s.total, 0)}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Taxa de Conversão
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {stats ? (
                                    Math.round(
                                        (Object.values(stats).reduce((sum, s) => sum + s.completed, 0) /
                                            Math.max(Object.values(stats).reduce((sum, s) => sum + s.total, 0), 1)) * 100
                                    )
                                ) : 0}%
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Agents List */}
                <Tabs defaultValue="agents" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="agents">
                            <Bot className="h-4 w-4 mr-2" />
                            Agentes
                        </TabsTrigger>
                        <TabsTrigger value="conversations">
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Conversas
                        </TabsTrigger>
                        <TabsTrigger value="qualifications">
                            <Users className="h-4 w-4 mr-2" />
                            Qualificações
                        </TabsTrigger>
                        <TabsTrigger value="analytics">
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Analytics
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="agents">
                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3].map(i => (
                                    <Skeleton key={i} className="h-48" />
                                ))}
                            </div>
                        ) : agents?.length === 0 ? (
                            <Card className="p-12 text-center">
                                <Bot className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Nenhum agente criado</h3>
                                <p className="text-muted-foreground mb-4">
                                    Crie seu primeiro agente de IA para começar a qualificar leads automaticamente.
                                </p>
                                <Button onClick={handleCreateNew}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Criar Primeiro Agente
                                </Button>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {agents?.map(agent => (
                                    <Card key={agent.id} className={agent.is_active ? 'border-primary' : ''}>
                                        <CardHeader>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <CardTitle className="flex items-center gap-2">
                                                        {agent.name}
                                                        {agent.is_active && (
                                                            <Badge variant="default" className="ml-2">Ativo</Badge>
                                                        )}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        {agent.persona_name} - {agent.persona_role}
                                                    </CardDescription>
                                                </div>
                                                <Switch
                                                    checked={agent.is_active}
                                                    onCheckedChange={(checked) =>
                                                        toggleMutation.mutate({ id: agent.id, is_active: checked })
                                                    }
                                                />
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                                {agent.description || 'Sem descrição'}
                                            </p>

                                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                                                <Badge variant="outline">{agent.ai_model}</Badge>
                                                <span>•</span>
                                                <span>{stats?.[agent.id]?.total || 0} conversas</span>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEdit(agent)}
                                                >
                                                    <Settings className="h-4 w-4 mr-1" />
                                                    Configurar
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleViewConversations(agent)}
                                                >
                                                    <Eye className="h-4 w-4 mr-1" />
                                                    Conversas
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive"
                                                    onClick={() => {
                                                        if (confirm(`Excluir agente "${agent.name}"?`)) {
                                                            deleteMutation.mutate(agent.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="conversations">
                        <ConversationMonitor agentId={selectedAgent?.id} />
                    </TabsContent>

                    <TabsContent value="qualifications">
                        <LeadQualificationView agentId={selectedAgent?.id} />
                    </TabsContent>

                    <TabsContent value="analytics">
                        <div className="grid gap-4 md:grid-cols-2">
                            <AIMetricsCard />
                            <Card>
                                <CardHeader>
                                    <CardTitle>Performance por Agente</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {agents?.map(agent => (
                                        <div key={agent.id} className="flex justify-between items-center py-2 border-b last:border-0">
                                            <span className="font-medium">{agent.name}</span>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">
                                                    {stats?.[agent.id]?.total || 0} conversas
                                                </Badge>
                                                <Badge variant="outline">
                                                    {stats?.[agent.id]?.completed || 0} convertidas
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Agent Editor Dialog */}
                <Dialog open={showEditor} onOpenChange={setShowEditor}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {selectedAgent ? `Editar: ${selectedAgent.name}` : 'Novo Agente de IA'}
                            </DialogTitle>
                            <DialogDescription>
                                Configure o comportamento e personalidade do agente.
                            </DialogDescription>
                        </DialogHeader>
                        <AgentEditor
                            agent={selectedAgent}
                            onClose={() => {
                                setShowEditor(false);
                                queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
                            }}
                        />
                    </DialogContent>
                </Dialog>

                {/* Conversation Monitor Dialog */}
                <Dialog open={showMonitor} onOpenChange={setShowMonitor}>
                    <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                Conversas: {selectedAgent?.name}
                            </DialogTitle>
                            <DialogDescription>
                                Histórico de conversas do agente.
                            </DialogDescription>
                        </DialogHeader>
                        <ConversationMonitor agentId={selectedAgent?.id} />
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
};

export default AIAgents;
