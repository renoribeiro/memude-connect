import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users, 
  MessageSquare, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Timer,
  Target
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MetricsData {
  totalAttempts: number;
  successRate: number;
  averageResponseTime: number;
  topPerformers: Array<{
    corretor_id: string;
    nome: string;
    acceptance_rate: number;
    response_time: number;
    total_leads: number;
  }>;
  dailyStats: Array<{
    date: string;
    attempts: number;
    successes: number;
    failures: number;
  }>;
  timeoutAnalysis: {
    total_timeouts: number;
    average_timeout_time: number;
    timeout_rate: number;
  };
  distributionEfficiency: {
    first_attempt_success: number;
    second_attempt_success: number;
    third_attempt_success: number;
    failed_distributions: number;
  };
}

interface AdvancedDistributionMetricsProps {
  startDate?: Date;
  endDate?: Date;
}

export const AdvancedDistributionMetrics = ({ 
  startDate = subDays(new Date(), 7), 
  endDate = new Date() 
}: AdvancedDistributionMetricsProps) => {
  
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['advanced-distribution-metrics', startDate, endDate],
    queryFn: async (): Promise<MetricsData> => {
      const start = startOfDay(startDate).toISOString();
      const end = endOfDay(endDate).toISOString();

      // Total de tentativas no período
      const { data: attempts } = await supabase
        .from('distribution_attempts')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end);

      const totalAttempts = attempts?.length || 0;
      const successfulAttempts = attempts?.filter(a => a.status === 'accepted').length || 0;
      const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

      // Tempo médio de resposta
      const responseTimes = attempts
        ?.filter(a => a.response_received_at && a.message_sent_at)
        .map(a => {
          const sent = new Date(a.message_sent_at).getTime();
          const received = new Date(a.response_received_at!).getTime();
          return (received - sent) / (1000 * 60); // em minutos
        }) || [];
      
      const averageResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0;

      // Top performers
      const { data: corretorStats } = await supabase
        .from('distribution_attempts')
        .select(`
          corretor_id,
          status,
          response_received_at,
          message_sent_at,
          corretores!inner(
            profile_id,
            profiles!inner(first_name, last_name)
          )
        `)
        .gte('created_at', start)
        .lte('created_at', end);

      const corretorMetrics = new Map();
      
      corretorStats?.forEach(attempt => {
        const id = attempt.corretor_id;
        if (!corretorMetrics.has(id)) {
          corretorMetrics.set(id, {
            corretor_id: id,
            nome: `${attempt.corretores.profiles.first_name} ${attempt.corretores.profiles.last_name}`,
            total_leads: 0,
            accepted: 0,
            response_times: []
          });
        }
        
        const stats = corretorMetrics.get(id);
        stats.total_leads++;
        
        if (attempt.status === 'accepted') {
          stats.accepted++;
        }
        
        if (attempt.response_received_at && attempt.message_sent_at) {
          const responseTime = (new Date(attempt.response_received_at).getTime() - 
                              new Date(attempt.message_sent_at).getTime()) / (1000 * 60);
          stats.response_times.push(responseTime);
        }
      });

      const topPerformers = Array.from(corretorMetrics.values())
        .map(stats => ({
          ...stats,
          acceptance_rate: stats.total_leads > 0 ? (stats.accepted / stats.total_leads) * 100 : 0,
          response_time: stats.response_times.length > 0 
            ? stats.response_times.reduce((a: number, b: number) => a + b, 0) / stats.response_times.length 
            : 0
        }))
        .sort((a, b) => b.acceptance_rate - a.acceptance_rate)
        .slice(0, 5);

      // Estatísticas diárias
      const dailyStats: MetricsData['dailyStats'] = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayStart = startOfDay(d).toISOString();
        const dayEnd = endOfDay(d).toISOString();
        
        const dayAttempts = attempts?.filter(a => 
          a.created_at >= dayStart && a.created_at <= dayEnd
        ) || [];
        
        dailyStats.push({
          date: format(d, 'dd/MM', { locale: ptBR }),
          attempts: dayAttempts.length,
          successes: dayAttempts.filter(a => a.status === 'accepted').length,
          failures: dayAttempts.filter(a => a.status === 'timeout' || a.status === 'rejected').length
        });
      }

      // Análise de timeouts
      const timeouts = attempts?.filter(a => a.status === 'timeout') || [];
      const timeoutAnalysis = {
        total_timeouts: timeouts.length,
        average_timeout_time: 0, // Calcular baseado no tempo até timeout
        timeout_rate: totalAttempts > 0 ? (timeouts.length / totalAttempts) * 100 : 0
      };

      // Eficiência de distribuição por tentativa
      const { data: queueData } = await supabase
        .from('distribution_queue')
        .select('current_attempt, status')
        .gte('created_at', start)
        .lte('created_at', end);

      const completed = queueData?.filter(q => q.status === 'completed') || [];
      const failed = queueData?.filter(q => q.status === 'failed') || [];
      
      const distributionEfficiency = {
        first_attempt_success: completed.filter(q => q.current_attempt === 1).length,
        second_attempt_success: completed.filter(q => q.current_attempt === 2).length,
        third_attempt_success: completed.filter(q => q.current_attempt >= 3).length,
        failed_distributions: failed.length
      };

      return {
        totalAttempts,
        successRate,
        averageResponseTime,
        topPerformers,
        dailyStats,
        timeoutAnalysis,
        distributionEfficiency
      };
    },
    refetchInterval: 30000 // Atualiza a cada 30 segundos
  });

  if (isLoading) {
    return <div className="text-center p-4">Carregando métricas avançadas...</div>;
  }

  if (!metrics) {
    return <div className="text-center p-4">Erro ao carregar métricas</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</div>
            <Progress value={metrics.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio de Resposta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageResponseTime.toFixed(1)} min</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tempo até primeira resposta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tentativas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalAttempts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              No período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Timeout</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.timeoutAnalysis.timeout_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.timeoutAnalysis.total_timeouts} timeouts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Eficiência por Tentativa */}
      <Card>
        <CardHeader>
          <CardTitle>Eficiência por Tentativa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {metrics.distributionEfficiency.first_attempt_success}
              </div>
              <p className="text-sm text-muted-foreground">1ª Tentativa</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {metrics.distributionEfficiency.second_attempt_success}
              </div>
              <p className="text-sm text-muted-foreground">2ª Tentativa</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {metrics.distributionEfficiency.third_attempt_success}
              </div>
              <p className="text-sm text-muted-foreground">3ª+ Tentativa</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {metrics.distributionEfficiency.failed_distributions}
              </div>
              <p className="text-sm text-muted-foreground">Falharam</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top Performers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.topPerformers.map((performer, index) => (
              <div key={performer.corretor_id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant={index === 0 ? "default" : "secondary"}>
                    #{index + 1}
                  </Badge>
                  <div>
                    <p className="font-medium">{performer.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {performer.total_leads} leads • {performer.response_time.toFixed(1)} min resposta
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{performer.acceptance_rate.toFixed(1)}%</div>
                  <p className="text-sm text-muted-foreground">Taxa de aceitação</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas Diárias */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência Diária</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {metrics.dailyStats.map((day) => (
              <div key={day.date} className="text-center p-2 border rounded">
                <div className="text-xs font-medium">{day.date}</div>
                <div className="text-lg font-bold">{day.attempts}</div>
                <div className="flex justify-center gap-1 mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded" title={`${day.successes} sucessos`}></div>
                  <div className="w-2 h-2 bg-red-500 rounded" title={`${day.failures} falhas`}></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};