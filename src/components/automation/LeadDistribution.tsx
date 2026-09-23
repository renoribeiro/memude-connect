import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Settings, Users, Zap, Clock, Target, ArrowRight, Play, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CorretorAvailability {
  corretor_id: string;
  name: string;
  available: boolean;
  current_leads: number;
  performance_score: number;
  total_accepts: number;
  total_rejects: number;
}

export function LeadDistribution() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch distribution settings (weights)
  const { data: distributionSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['distribution-settings'],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('distribution_settings')
        .select('id, auto_distribution_enabled, timeout_minutes, max_attempts, score_match_bairro, score_match_construtora, score_nota_multiplier, score_visitas_multiplier')
        .abortSignal(signal)
        .single();
      if (error) throw error;
      return data as any; // Cast to any to handle new columns not yet in types
    }
  });

  // Update weights mutation
  const updateWeightsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      if (!distributionSettings?.id) throw new Error('Configuração de distribuição não encontrada.');
      const { error } = await supabase
        .from('distribution_settings')
        .update(newSettings)
        .eq('id', distributionSettings.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchSettings();
      toast({
        title: "Configuração atualizada",
        description: "As regras operacionais foram salvas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveWeight = (key: string, value: string) => {
    const numValue = Number.parseInt(value, 10);
    if (!Number.isFinite(numValue) || numValue < 0 || numValue > 1_000_000) {
      toast({ title: 'Valor inválido', description: 'Informe um inteiro entre 0 e 1.000.000.', variant: 'destructive' });
      return;
    }
    updateWeightsMutation.mutate({ [key]: numValue });
  };

  const { data: stats } = useQuery({
    queryKey: ['lead-distribution-live-stats'],
    queryFn: async ({ signal }) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [pendingResult, metricsResult] = await Promise.all([
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .in('status', ['novo', 'buscando_corretor'])
          .is('corretor_designado_id', null)
          .abortSignal(signal),
        supabase
          .from('distribution_metrics')
          .select('total_distributions, total_attempts, total_accepts, total_rejects, total_timeouts, avg_response_time_minutes')
          .eq('date', today)
          .abortSignal(signal)
          .maybeSingle(),
      ]);
      if (pendingResult.error) throw pendingResult.error;
      if (metricsResult.error) throw metricsResult.error;
      const metrics = metricsResult.data;
      const resolvedResponses = (metrics?.total_accepts || 0) + (metrics?.total_rejects || 0);
      return {
        pending: pendingResult.count || 0,
        distributed: metrics?.total_distributions || 0,
        acceptanceRate: resolvedResponses > 0 ? ((metrics?.total_accepts || 0) / resolvedResponses) * 100 : 0,
        averageMinutes: Number(metrics?.avg_response_time_minutes || 0),
      };
    },
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
          total_accepts,
          total_rejects,
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
        performance_score: corretor.nota_media || 0,
        total_accepts: corretor.total_accepts || 0,
        total_rejects: corretor.total_rejects || 0,
      })) as CorretorAvailability[];
    }
  });

  // Auto-distribute pending leads
  const autoDistributeMutation = useMutation({
    mutationFn: async () => {
      // Get pending leads
      const { data: pendingLeads, error } = await supabase
        .from('leads')
        .select('id')
        .in('status', ['novo', 'buscando_corretor'])
        .is('corretor_designado_id', null)
        .limit(10);

      if (error) throw error;

      let successful = 0;
      const failures: string[] = [];
      for (const lead of pendingLeads || []) {
        const { data, error: invokeError } = await supabase.functions.invoke('distribute-lead', {
          body: { lead_id: lead.id },
        });
        if (invokeError || data?.error) {
          failures.push(data?.error || invokeError?.message || `Falha no lead ${lead.id}`);
        } else {
          successful += 1;
        }
      }

      return { successful, failed: failures.length, firstFailure: failures[0] };
    },
    onSuccess: ({ successful, failed, firstFailure }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['corretor-availability'] });
      queryClient.invalidateQueries({ queryKey: ['lead-distribution-live-stats'] });
      toast({
        title: failed ? "Distribuição concluída com ressalvas" : "Distribuição concluída",
        description: `${successful} lead(s) iniciado(s)${failed ? `; ${failed} falharam. ${firstFailure}` : '.'}`,
        variant: failed ? 'destructive' : 'default',
      });
    },
    onError: (error: Error) => toast({
      title: 'Erro na distribuição',
      description: error.message,
      variant: 'destructive',
    }),
  });

  const getAvailabilityStatus = (corretor: CorretorAvailability) => {
    if (corretor.current_leads >= 5) return { status: `${corretor.current_leads} leads ativos`, variant: 'secondary' as const };
    return { status: `${corretor.current_leads} lead(s) ativo(s)`, variant: 'default' as const };
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
              checked={Boolean(distributionSettings?.auto_distribution_enabled)}
              onCheckedChange={(checked) => updateWeightsMutation.mutate({ auto_distribution_enabled: checked })}
              disabled={!distributionSettings || updateWeightsMutation.isPending}
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
                  Serão processados até 10 leads pendentes usando o motor oficial de score, fila e notificações. Deseja continuar?
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
        {/* Operational rules */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Regras Operacionais Ativas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="rounded-lg border p-4"><span className="text-muted-foreground">Motor</span><p className="font-medium">Score por bairro, construtora, nota e carga</p></div>
              <div className="rounded-lg border p-4"><span className="text-muted-foreground">Timeout</span><p className="font-medium">{distributionSettings?.timeout_minutes ?? '—'} minuto(s)</p></div>
              <div className="rounded-lg border p-4"><span className="text-muted-foreground">Máximo de tentativas</span><p className="font-medium">{distributionSettings?.max_attempts ?? '—'}</p></div>
            </div>
            <p className="text-sm text-muted-foreground">
              O botão “Distribuir Agora” utiliza a mesma Edge Function do fluxo automático; não altera leads diretamente pelo navegador.
            </p>
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
            {isLoadingAvailability && <Loader2 className="h-5 w-5 animate-spin" />}
            {!isLoadingAvailability && availability.length === 0 && <p className="text-sm text-muted-foreground">Nenhum corretor ativo encontrado.</p>}
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
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Performance:</span>
                      <span className="font-medium">
                        {corretor.performance_score.toFixed(1)}/5.0
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Aceites / recusas:</span>
                      <span>{corretor.total_accepts} / {corretor.total_rejects}</span>
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
                  {updateWeightsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin my-auto" />}
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
                  {updateWeightsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin my-auto" />}
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
                  {updateWeightsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin my-auto" />}
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
                  {updateWeightsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin my-auto" />}
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
                <p className="text-2xl font-bold">{stats?.pending ?? '—'}</p>
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
                <p className="text-2xl font-bold">{stats?.distributed ?? '—'}</p>
              </div>
              <Target className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa de Aceite</p>
                <p className="text-2xl font-bold">{stats ? `${stats.acceptanceRate.toFixed(1)}%` : '—'}</p>
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
                <p className="text-2xl font-bold">{stats ? `${stats.averageMinutes.toFixed(1)} min` : '—'}</p>
              </div>
              <Zap className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div >
  );
}
