import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Settings, Users, Zap, Clock, Target, ArrowRight, Play, Pause, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DistributionRule {
  id: string;
  name: string;
  active: boolean;
  criteria: {
    bairro?: string[];
    empreendimento?: string[];
    valor_min?: number;
    valor_max?: number;
    source?: string[];
  };
  assignment_method: 'round-robin' | 'weighted' | 'availability' | 'performance';
  corretores: string[];
  priority: number;
}

interface CorretorAvailability {
  corretor_id: string;
  name: string;
  available: boolean;
  current_leads: number;
  max_leads: number;
  performance_score: number;
  weight: number;
}

export function LeadDistribution() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [autoDistribution, setAutoDistribution] = useState(true);
  const [isSavingWeights, setIsSavingWeights] = useState(false);

  // Fetch distribution settings (weights)
  const { data: distributionSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['distribution-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_settings')
        .select('*')
        .single();
      if (error) throw error;
      return data as any; // Cast to any to handle new columns not yet in types
    }
  });

  // Update weights mutation
  const updateWeightsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      setIsSavingWeights(true);
      const { error } = await supabase
        .from('distribution_settings')
        .update(newSettings)
        .eq('id', distributionSettings.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchSettings();
      toast({
        title: "Pesos atualizados",
        description: "As configurações de pontuação foram salvas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSavingWeights(false);
    }
  });

  const handleSaveWeight = (key: string, value: string) => {
    const numValue = parseInt(value) || 0;
    updateWeightsMutation.mutate({ [key]: numValue });
  };

  // Fetch distribution rules
  const { data: rules = [], isLoading: isLoadingRules } = useQuery({
    queryKey: ['distribution-rules'],
    queryFn: async () => {
      // Simulating distribution rules since we don't have this table yet
      return [
        {
          id: '1',
          name: 'Centro - Empreendimentos Premium',
          active: true,
          criteria: {
            bairro: ['Centro', 'Aldeota'],
            valor_min: 500000,
          },
          assignment_method: 'performance' as const,
          corretores: ['corretor-1', 'corretor-2'],
          priority: 1,
        },
        {
          id: '2',
          name: 'Fortaleza - Geral',
          active: true,
          criteria: {
            bairro: ['Meireles', 'Papicu', 'Cocó'],
          },
          assignment_method: 'round-robin' as const,
          corretores: ['corretor-1', 'corretor-2', 'corretor-3'],
          priority: 2,
        },
      ] as DistributionRule[];
    }
  });

  // Fetch corretor availability
  const { data: availability = [], isLoading: isLoadingAvailability } = useQuery({
    queryKey: ['corretor-availability'],
    queryFn: async () => {
      const { data: corretores, error } = await supabase
        .from('corretores')
        .select(`
          id,
          status,
          total_visitas,
          nota_media,
          profiles(first_name, last_name)
        `)
        .eq('status', 'ativo');

      if (error) throw error;

      // Get current lead count for each corretor
      const { data: leadCounts, error: leadError } = await supabase
        .from('leads')
        .select('corretor_designado_id')
        .in('status', ['novo', 'buscando_corretor', 'corretor_designado']);

      if (leadError) throw leadError;

      const leadCountMap = leadCounts.reduce((acc: Record<string, number>, lead) => {
        if (lead.corretor_designado_id) {
          acc[lead.corretor_designado_id] = (acc[lead.corretor_designado_id] || 0) + 1;
        }
        return acc;
      }, {});

      return corretores.map(corretor => ({
        corretor_id: corretor.id,
        name: `${corretor.profiles.first_name} ${corretor.profiles.last_name}`,
        available: corretor.status === 'ativo',
        current_leads: leadCountMap[corretor.id] || 0,
        max_leads: 10, // Default max leads
        performance_score: corretor.nota_media || 0,
        weight: 1, // Default weight
      })) as CorretorAvailability[];
    }
  });

  // Manual distribution mutation
  const distributeLeadMutation = useMutation({
    mutationFn: async ({ leadId, corretorId }: { leadId: string; corretorId: string }) => {
      const { error } = await supabase
        .from('leads')
        .update({
          corretor_designado_id: corretorId,
          status: 'corretor_designado'
        })
        .eq('id', leadId);

      if (error) throw error;

      // Log the distribution
      await supabase
        .from('lead_distribution_log')
        .insert({
          lead_id: leadId,
          corretor_id: corretorId,
          ordem_prioridade: 1,
          data_envio: new Date().toISOString(),
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['corretor-availability'] });
      toast({
        title: "Sucesso",
        description: "Lead distribuído com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao distribuir lead",
        variant: "destructive",
      });
    }
  });

  // Auto-distribute pending leads
  const autoDistributeMutation = useMutation({
    mutationFn: async () => {
      // Get pending leads
      const { data: pendingLeads, error } = await supabase
        .from('leads')
        .select('*')
        .in('status', ['novo', 'buscando_corretor'])
        .is('corretor_designado_id', null);

      if (error) throw error;

      const distributions = [];

      for (const lead of pendingLeads) {
        // Find available corretor using round-robin
        const availableCorretores = availability.filter(c =>
          c.available && c.current_leads < c.max_leads
        );

        if (availableCorretores.length > 0) {
          // Simple round-robin assignment
          const selectedCorretor = availableCorretores[
            distributions.length % availableCorretores.length
          ];

          distributions.push({
            leadId: lead.id,
            corretorId: selectedCorretor.corretor_id
          });
        }
      }

      // Execute all distributions
      for (const dist of distributions) {
        await distributeLeadMutation.mutateAsync(dist);
      }

      return distributions.length;
    },
    onSuccess: (count) => {
      toast({
        title: "Distribuição Automática",
        description: `${count} leads foram distribuídos automaticamente`,
      });
    }
  });

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'round-robin':
        return 'Rodízio';
      case 'weighted':
        return 'Por Peso';
      case 'availability':
        return 'Por Disponibilidade';
      case 'performance':
        return 'Por Performance';
      default:
        return method;
    }
  };

  const getAvailabilityStatus = (corretor: CorretorAvailability) => {
    const percentage = (corretor.current_leads / corretor.max_leads) * 100;

    if (percentage >= 100) return { status: 'Lotado', variant: 'destructive' as const, color: 'text-red-600' };
    if (percentage >= 80) return { status: 'Quase Lotado', variant: 'secondary' as const, color: 'text-yellow-600' };
    if (percentage >= 50) return { status: 'Moderado', variant: 'outline' as const, color: 'text-blue-600' };
    return { status: 'Disponível', variant: 'default' as const, color: 'text-green-600' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6" />
            Distribuição Automática de Leads
          </h2>
          <p className="text-muted-foreground">
            Configure regras e monitore a distribuição de leads para corretores
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-distribution"
              checked={autoDistribution}
              onCheckedChange={setAutoDistribution}
            />
            <Label htmlFor="auto-distribution">Distribuição Automática</Label>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                Distribuir Agora
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Distribuir Leads Pendentes</AlertDialogTitle>
                <AlertDialogDescription>
                  Deseja executar a distribuição automática para todos os leads pendentes?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => autoDistributeMutation.mutate()}
                  disabled={autoDistributeMutation.isPending}
                >
                  {autoDistributeMutation.isPending ? "Distribuindo..." : "Confirmar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution Rules */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Regras de Distribuição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{rule.name}</h3>
                    <Badge variant={rule.active ? 'default' : 'secondary'}>
                      {rule.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRule(rule.id)}
                    >
                      Configurar
                    </Button>
                    <Switch
                      checked={rule.active}
                      onCheckedChange={(checked) => {
                        // Update rule active status
                        console.log('Toggle rule:', rule.id, checked);
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Método:</span>
                    <div className="font-medium">{getMethodLabel(rule.assignment_method)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prioridade:</span>
                    <div className="font-medium">{rule.priority}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Corretores:</span>
                    <div className="font-medium">{rule.corretores.length}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Critérios:</span>
                    <div className="font-medium">
                      {Object.keys(rule.criteria).length} definidos
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              Nova Regra
            </Button>
          </CardContent>
        </Card>

        {/* Corretor Availability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Disponibilidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {availability.map((corretor) => {
              const status = getAvailabilityStatus(corretor);
              return (
                <div key={corretor.corretor_id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{corretor.name}</h4>
                    <Badge variant={status.variant} className="text-xs">
                      {status.status}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Leads Atuais</span>
                      <span>{corretor.current_leads}/{corretor.max_leads}</span>
                    </div>

                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${status.variant === 'destructive' ? 'bg-red-500' :
                          status.variant === 'secondary' ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                        style={{
                          width: `${Math.min((corretor.current_leads / corretor.max_leads) * 100, 100)}%`
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Performance:</span>
                      <span className="font-medium">
                        {corretor.performance_score.toFixed(1)}/5.0
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Distribution Weights Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Pesos de Distribuição (Score)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label>Match de Bairro (+Pts)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    defaultValue={distributionSettings?.score_match_bairro ?? 10000}
                    onBlur={(e) => handleSaveWeight('score_match_bairro', e.target.value)}
                  />
                  {isSavingWeights && <Loader2 className="w-4 h-4 animate-spin my-auto" />}
                </div>
                <p className="text-xs text-muted-foreground">Pontos se corretor atende o bairro</p>
              </div>

              <div className="space-y-2">
                <Label>Match de Construtora (+Pts)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    defaultValue={distributionSettings?.score_match_construtora ?? 10000}
                    onBlur={(e) => handleSaveWeight('score_match_construtora', e.target.value)}
                  />
                  {isSavingWeights && <Loader2 className="w-4 h-4 animate-spin my-auto" />}
                </div>
                <p className="text-xs text-muted-foreground">Pontos se corretor atende construtora</p>
              </div>

              <div className="space-y-2">
                <Label>Multiplicador de Nota (x)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    defaultValue={distributionSettings?.score_nota_multiplier ?? 100}
                    onBlur={(e) => handleSaveWeight('score_nota_multiplier', e.target.value)}
                  />
                  {isSavingWeights && <Loader2 className="w-4 h-4 animate-spin my-auto" />}
                </div>
                <p className="text-xs text-muted-foreground">Nota (0-5) multiplicada por X</p>
              </div>

              <div className="space-y-2">
                <Label>Penalidade por Visita (x)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    defaultValue={distributionSettings?.score_visitas_multiplier ?? 10}
                    onBlur={(e) => handleSaveWeight('score_visitas_multiplier', e.target.value)}
                  />
                  {isSavingWeights && <Loader2 className="w-4 h-4 animate-spin my-auto" />}
                </div>
                <p className="text-xs text-muted-foreground">Pontos reduzidos por visita atual</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Leads Pendentes</p>
                <p className="text-2xl font-bold">12</p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Distribuídos Hoje</p>
                <p className="text-2xl font-bold">28</p>
              </div>
              <Target className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa de Resposta</p>
                <p className="text-2xl font-bold">85%</p>
              </div>
              <ArrowRight className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold">3.2min</p>
              </div>
              <Zap className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div >
  );
}