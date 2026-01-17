import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Clock, Award, Users, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

export default function Analytics() {
  const { profile } = useAuth();

  if (profile?.role !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  // Buscar métricas dos últimos 30 dias
  const { data: metrics } = useQuery({
    queryKey: ['distribution-metrics-30d'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('distribution_metrics')
        .select('*')
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  // Buscar top corretores
  const { data: topCorretores } = useQuery({
    queryKey: ['top-corretores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corretores')
        .select(`
          *,
          profiles:profile_id (
            first_name,
            last_name
          )
        `)
        .eq('status', 'ativo')
        .not('total_accepts', 'is', null)
        .order('total_accepts', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    }
  });

  // Calcular estatísticas gerais
  const totalDistributions = metrics?.reduce((sum, m) => sum + m.total_distributions, 0) || 0;
  const totalSuccessful = metrics?.reduce((sum, m) => sum + m.successful_distributions, 0) || 0;
  const avgSuccessRate = totalDistributions > 0 ? (totalSuccessful / totalDistributions) * 100 : 0;
  
  const avgResponseTime = metrics && metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + (m.avg_response_time_minutes || 0), 0) / metrics.filter(m => m.avg_response_time_minutes).length 
    : 0;

  // Preparar dados para gráficos
  const chartData = metrics?.map(m => ({
    date: new Date(m.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    sucessoPercent: m.total_distributions > 0 ? ((m.successful_distributions / m.total_distributions) * 100).toFixed(1) : 0,
    total: m.total_distributions,
    sucesso: m.successful_distributions,
    falha: m.failed_distributions,
    tempoMedio: m.avg_response_time_minutes?.toFixed(1) || 0
  })) || [];

  const pieData = [
    { name: 'Aceitas', value: metrics?.reduce((sum, m) => sum + m.total_accepts, 0) || 0 },
    { name: 'Recusadas', value: metrics?.reduce((sum, m) => sum + m.total_rejects, 0) || 0 },
    { name: 'Timeouts', value: metrics?.reduce((sum, m) => sum + m.total_timeouts, 0) || 0 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics de Distribuição</h1>
          <p className="text-muted-foreground">Análise detalhada do desempenho do sistema</p>
        </div>

        {/* Estatísticas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
              {avgSuccessRate >= 70 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {avgSuccessRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {totalSuccessful} de {totalDistributions} distribuições
              </p>
              <Badge 
                variant={avgSuccessRate >= 70 ? "default" : "destructive"}
                className="mt-2"
              >
                {avgSuccessRate >= 70 ? 'Excelente' : 'Precisa Melhorar'}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {avgResponseTime.toFixed(1)} min
              </div>
              <p className="text-xs text-muted-foreground">
                Tempo de resposta dos corretores
              </p>
              <Badge 
                variant={avgResponseTime <= 10 ? "default" : "secondary"}
                className="mt-2"
              >
                {avgResponseTime <= 10 ? 'Rápido' : 'Normal'}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Distribuições</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalDistributions}
              </div>
              <p className="text-xs text-muted-foreground">
                Últimos 30 dias
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Economia de Tempo</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ~{(totalDistributions * 15 / 60).toFixed(0)}h
              </div>
              <p className="text-xs text-muted-foreground">
                vs distribuição manual
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                (15 min por visita economizado)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Taxa de Sucesso ao Longo do Tempo */}
          <Card>
            <CardHeader>
              <CardTitle>Taxa de Sucesso (30 dias)</CardTitle>
              <CardDescription>Percentual de distribuições bem-sucedidas</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="sucessoPercent" 
                    stroke="#10b981" 
                    name="Taxa de Sucesso (%)" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tempo Médio de Resposta */}
          <Card>
            <CardHeader>
              <CardTitle>Tempo Médio de Resposta</CardTitle>
              <CardDescription>Em minutos, por dia</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tempoMedio" fill="#3b82f6" name="Tempo (min)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Distribuição de Respostas */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Respostas</CardTitle>
              <CardDescription>Últimos 30 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Volume de Distribuições */}
          <Card>
            <CardHeader>
              <CardTitle>Volume de Distribuições</CardTitle>
              <CardDescription>Sucesso vs Falha</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sucesso" fill="#10b981" name="Sucesso" stackId="a" />
                  <Bar dataKey="falha" fill="#ef4444" name="Falha" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Corretores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Top 10 Corretores
            </CardTitle>
            <CardDescription>Ranking por visitas aceitas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCorretores && topCorretores.length > 0 ? (
                topCorretores.map((corretor, index) => {
                  const totalResponses = (corretor.total_accepts || 0) + (corretor.total_rejects || 0);
                  const acceptRate = totalResponses > 0 
                    ? ((corretor.total_accepts || 0) / totalResponses) * 100 
                    : 0;

                  return (
                    <div key={corretor.id} className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {corretor.profiles?.first_name} {corretor.profiles?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {corretor.total_accepts || 0} aceitas • {corretor.total_rejects || 0} recusadas
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="font-bold">{acceptRate.toFixed(0)}%</span>
                            </div>
                            {corretor.avg_response_time_minutes && (
                              <p className="text-xs text-muted-foreground">
                                ~{corretor.avg_response_time_minutes.toFixed(1)} min
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum dado disponível ainda
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
