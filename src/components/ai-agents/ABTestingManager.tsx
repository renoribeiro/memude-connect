import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
    FlaskConical,
    Plus,
    Play,
    Pause,
    CheckCircle,
    XCircle,
    BarChart3,
    Users,
    TrendingUp
} from "lucide-react";

interface ABTestingManagerProps {
    agentId: string;
}

interface Experiment {
    id: string;
    agent_id: string;
    name: string;
    description: string | null;
    experiment_type: string;
    variants: {
        id: string;
        weight: number;
        config: Record<string, any>;
    }[];
    primary_metric: string;
    secondary_metrics: string[];
    status: "draft" | "running" | "paused" | "completed" | "cancelled";
    started_at: string | null;
    ended_at: string | null;
    target_sample_size: number;
    created_at: string;
}

interface ExperimentResult {
    variant_id: string;
    sample_size: number;
    conversions: number;
    conversion_rate: number;
    avg_metric_value: number;
    confidence_level: string;
}

const EXPERIMENT_TYPES = [
    { value: "prompt_variation", label: "Variação de Prompt" },
    { value: "greeting_message", label: "Mensagem de Saudação" },
    { value: "followup_timing", label: "Timing de Follow-up" },
    { value: "response_style", label: "Estilo de Resposta" },
    { value: "objection_handling", label: "Tratamento de Objeções" },
    { value: "qualification_order", label: "Ordem de Qualificação" }
];

const METRICS = [
    { value: "conversion_rate", label: "Taxa de Conversão" },
    { value: "qualification_rate", label: "Taxa de Qualificação" },
    { value: "avg_bant_score", label: "BANT Score Médio" },
    { value: "avg_messages", label: "Média de Mensagens" },
    { value: "visit_schedule_rate", label: "Taxa de Visita" },
    { value: "response_time", label: "Tempo de Resposta" }
];

export function ABTestingManager({ agentId }: ABTestingManagerProps) {
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedExperiment, setSelectedExperiment] = useState<string | null>(null);

    // Form state
    const [newExperiment, setNewExperiment] = useState({
        name: "",
        description: "",
        experiment_type: "prompt_variation",
        primary_metric: "conversion_rate",
        target_sample_size: 100,
        variants: [
            { id: "control", weight: 50, config: { name: "Controle" } },
            { id: "variant_a", weight: 50, config: { name: "Variante A" } }
        ]
    });

    // Fetch experiments
    const { data: experiments, isLoading } = useQuery({
        queryKey: ["ab-experiments", agentId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("ab_experiments")
                .select("*")
                .eq("agent_id", agentId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as Experiment[];
        }
    });

    // Fetch results for selected experiment
    const { data: experimentResults } = useQuery({
        queryKey: ["ab-results", selectedExperiment],
        queryFn: async () => {
            if (!selectedExperiment) return null;
            const { data, error } = await supabase.rpc("get_ab_test_results", {
                p_experiment_id: selectedExperiment
            });
            if (error) throw error;
            return data as ExperimentResult[];
        },
        enabled: !!selectedExperiment
    });

    // Create experiment mutation
    const createMutation = useMutation({
        mutationFn: async (experiment: typeof newExperiment) => {
            const { data, error } = await supabase
                .from("ab_experiments")
                .insert({
                    agent_id: agentId,
                    name: experiment.name,
                    description: experiment.description || null,
                    experiment_type: experiment.experiment_type,
                    variants: experiment.variants,
                    primary_metric: experiment.primary_metric,
                    target_sample_size: experiment.target_sample_size,
                    status: "draft"
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ab-experiments"] });
            setIsCreateOpen(false);
            setNewExperiment({
                name: "",
                description: "",
                experiment_type: "prompt_variation",
                primary_metric: "conversion_rate",
                target_sample_size: 100,
                variants: [
                    { id: "control", weight: 50, config: { name: "Controle" } },
                    { id: "variant_a", weight: 50, config: { name: "Variante A" } }
                ]
            });
            toast.success("Experimento criado com sucesso!");
        },
        onError: (error) => {
            toast.error("Erro ao criar experimento: " + error.message);
        }
    });

    // Update status mutation
    const statusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const updates: Record<string, any> = { status };
            if (status === "running") {
                updates.started_at = new Date().toISOString();
            } else if (status === "completed" || status === "cancelled") {
                updates.ended_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from("ab_experiments")
                .update(updates)
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ab-experiments"] });
            toast.success("Status atualizado!");
        }
    });

    const getStatusBadge = (status: string) => {
        const configs: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
            draft: { variant: "outline", label: "Rascunho" },
            running: { variant: "default", label: "Em Execução" },
            paused: { variant: "secondary", label: "Pausado" },
            completed: { variant: "secondary", label: "Concluído" },
            cancelled: { variant: "destructive", label: "Cancelado" }
        };
        const config = configs[status] || configs.draft;
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    const getTotalSamples = (results: ExperimentResult[] | null) => {
        if (!results) return 0;
        return results.reduce((sum, r) => sum + r.sample_size, 0);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <FlaskConical className="h-6 w-6" />
                        A/B Testing
                    </h2>
                    <p className="text-muted-foreground">
                        Gerencie experimentos para otimizar a performance do agente
                    </p>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Novo Experimento
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Criar Novo Experimento</DialogTitle>
                            <DialogDescription>
                                Configure um novo teste A/B para o agente
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nome do Experimento</Label>
                                <Input
                                    id="name"
                                    value={newExperiment.name}
                                    onChange={(e) => setNewExperiment({
                                        ...newExperiment,
                                        name: e.target.value
                                    })}
                                    placeholder="Ex: Teste de saudação personalizada"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="description">Descrição</Label>
                                <Textarea
                                    id="description"
                                    value={newExperiment.description}
                                    onChange={(e) => setNewExperiment({
                                        ...newExperiment,
                                        description: e.target.value
                                    })}
                                    placeholder="Descreva o objetivo do experimento..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Tipo de Experimento</Label>
                                    <Select
                                        value={newExperiment.experiment_type}
                                        onValueChange={(v) => setNewExperiment({
                                            ...newExperiment,
                                            experiment_type: v
                                        })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {EXPERIMENT_TYPES.map((type) => (
                                                <SelectItem key={type.value} value={type.value}>
                                                    {type.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label>Métrica Principal</Label>
                                    <Select
                                        value={newExperiment.primary_metric}
                                        onValueChange={(v) => setNewExperiment({
                                            ...newExperiment,
                                            primary_metric: v
                                        })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {METRICS.map((metric) => (
                                                <SelectItem key={metric.value} value={metric.value}>
                                                    {metric.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label>Tamanho da Amostra</Label>
                                <Input
                                    type="number"
                                    value={newExperiment.target_sample_size}
                                    onChange={(e) => setNewExperiment({
                                        ...newExperiment,
                                        target_sample_size: parseInt(e.target.value) || 100
                                    })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Número de conversas para cada variante
                                </p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => createMutation.mutate(newExperiment)}
                                disabled={!newExperiment.name || createMutation.isPending}
                            >
                                Criar Experimento
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Experiments Grid */}
            {experiments?.length === 0 ? (
                <Card className="p-8 text-center">
                    <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhum experimento</h3>
                    <p className="text-muted-foreground mb-4">
                        Crie seu primeiro teste A/B para otimizar o agente
                    </p>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Experimento
                    </Button>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {experiments?.map((exp) => (
                        <Card
                            key={exp.id}
                            className={`cursor-pointer transition-shadow hover:shadow-md ${selectedExperiment === exp.id ? 'ring-2 ring-primary' : ''
                                }`}
                            onClick={() => setSelectedExperiment(
                                selectedExperiment === exp.id ? null : exp.id
                            )}
                        >
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-base">{exp.name}</CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            {EXPERIMENT_TYPES.find(t => t.value === exp.experiment_type)?.label}
                                        </CardDescription>
                                    </div>
                                    {getStatusBadge(exp.status)}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-muted-foreground mb-4">
                                    {exp.description || "Sem descrição"}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        <span>{exp.variants.length} variantes</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <BarChart3 className="h-3 w-3" />
                                        <span>{exp.target_sample_size} amostra</span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="flex gap-2">
                                {exp.status === "draft" && (
                                    <Button
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            statusMutation.mutate({ id: exp.id, status: "running" });
                                        }}
                                    >
                                        <Play className="h-3 w-3 mr-1" />
                                        Iniciar
                                    </Button>
                                )}
                                {exp.status === "running" && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                statusMutation.mutate({ id: exp.id, status: "paused" });
                                            }}
                                        >
                                            <Pause className="h-3 w-3 mr-1" />
                                            Pausar
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                statusMutation.mutate({ id: exp.id, status: "completed" });
                                            }}
                                        >
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Concluir
                                        </Button>
                                    </>
                                )}
                                {exp.status === "paused" && (
                                    <Button
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            statusMutation.mutate({ id: exp.id, status: "running" });
                                        }}
                                    >
                                        <Play className="h-3 w-3 mr-1" />
                                        Retomar
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Results Detail */}
            {selectedExperiment && experimentResults && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Resultados do Experimento
                        </CardTitle>
                        <CardDescription>
                            Total de amostras: {getTotalSamples(experimentResults)}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {experimentResults.map((result, index) => (
                                <div key={result.variant_id} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={index === 0 ? "default" : "outline"}>
                                                {result.variant_id === "control" ? "Controle" : result.variant_id}
                                            </Badge>
                                            {index === 0 && (
                                                <Badge variant="secondary" className="text-xs">
                                                    Vencedor
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-sm">
                                            <span className="font-bold text-lg">{result.conversion_rate}%</span>
                                            <span className="text-muted-foreground ml-2">
                                                ({result.conversions}/{result.sample_size})
                                            </span>
                                        </div>
                                    </div>
                                    <Progress value={result.conversion_rate} className="h-2" />
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Métrica média: {result.avg_metric_value}</span>
                                        <span>{result.confidence_level}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
