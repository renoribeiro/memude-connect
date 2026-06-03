import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GeneratedReportDialog } from "@/components/reports/GeneratedReportDialog";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import {
  Download,
  TrendingUp,
  Users,
  Calendar,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Settings,
  Clock,
  BarChart3
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { subDays, startOfMonth, endOfMonth } from "@/utils/dateHelpers";
import { AdvancedCharts } from "@/components/charts/AdvancedCharts";
import { ReportTemplateManager } from "@/components/reports/ReportTemplateManager";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { ScheduleReportModal } from "@/components/reports/ScheduleReportModal";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d'];

export default function Relatorios() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const [generatedReportOpen, setGeneratedReportOpen] = useState(false);
  const [generatedReportConfig, setGeneratedReportConfig] = useState<any>(null);
  const [generatedReportData, setGeneratedReportData] = useState<any>(null);

  // Dados de vendas para faturamento
  const { data: vendasData = [], isLoading: isLoadingVendas } = useQuery({
    queryKey: ['reports-vendas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select('valor_imovel, valor_comissao_bruta, status, created_at');
      
      if (error) throw error;
      return data;
    }
  });

  // Relatórios agendados
  const { data: scheduledReports = [], isLoading: isLoadingScheduled } = useQuery({
    queryKey: ['scheduled-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_reports')
        .select('*, report_templates(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_reports')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast({
        title: 'Agendamento cancelado',
        description: 'O envio programado foi cancelado com sucesso.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao cancelar agendamento',
        description: err.message || 'Não foi possível cancelar o agendamento.',
        variant: 'destructive',
      });
    }
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (template: any) => {
      if (!profile) throw new Error('Perfil não encontrado');

      const templatePayload = {
        name: template.name,
        description: template.description,
        template_config: template.template_config,
        category: template.category,
        is_public: template.is_public || false,
        created_by: profile.id,
      };

      if (template.id) {
        const { error } = await supabase
          .from('report_templates')
          .update(templatePayload)
          .eq('id', template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('report_templates')
          .insert(templatePayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      toast({
        title: 'Template salvo',
        description: 'O template de relatório foi salvo com sucesso.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao salvar template',
        description: err.message || 'Não foi possível salvar o template.',
        variant: 'destructive',
      });
    }
  });

  // Dados de leads por período
  const { data: leadsData = [], isLoading: isLoadingLeads } = useQuery({
    queryKey: ['reports-leads'],
    queryFn: async () => {
      const startDate = subDays(new Date(), 365); // Busca 365 dias para habilitar relatórios históricos
      const { data, error } = await supabase
        .from('leads')
        .select('created_at, status, nome')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    }
  });

  // Dados de corretores
  const { data: corretoresData = [], isLoading: isLoadingCorretores } = useQuery({
    queryKey: ['reports-corretores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corretores')
        .select('status, nota_media, total_visitas, profiles(first_name, last_name)')
        .order('total_visitas', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    }
  });

  // Dados de visitas
  const { data: visitasData = [], isLoading: isLoadingVisitas } = useQuery({
    queryKey: ['reports-visitas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitas')
        .select('data_visita, status, avaliacao_lead')
        .order('data_visita', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Processamento dos dados para gráficos
  // Process data for advanced charts
  const processLeadsData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), i);
      return {
        date: format(date, 'dd/MM', { locale: ptBR }),
        leads: leadsData.filter(lead =>
          format(new Date(lead.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        ).length
      };
    }).reverse();
    return last7Days;
  };

  const processStatusData = () => {
    // Filtra para os últimos 30 dias no gráfico do Dashboard principal
    const cutoffDate = subDays(new Date(), 30);
    const recentLeads = leadsData.filter(l => new Date(l.created_at) >= cutoffDate);
    
    const statusCounts = recentLeads.reduce((acc: Record<string, number>, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace(/_/g, ' '),
      value: count
    }));
  };

  const processedData = {
    leadsOverTime: processLeadsData(),
    leadsByStatus: processStatusData(),
    conversionFunnel: [
      { name: 'Leads Recebidos', value: leadsData.length, fill: 'hsl(var(--primary))' },
      { name: 'Visitas Agendadas', value: leadsData.filter(l => l.status === 'visita_agendada').length, fill: 'hsl(var(--secondary))' },
      { name: 'Visitas Realizadas', value: leadsData.filter(l => l.status === 'visita_realizada').length, fill: 'hsl(var(--accent))' },
      { name: 'Convertidos', value: leadsData.filter(l => l.status === 'visita_realizada').length, fill: 'hsl(var(--primary))' },
    ],
    corretorPerformance: corretoresData.slice(0, 5).map(c => ({
      name: `${c.profiles.first_name} ${c.profiles.last_name}`,
      visitas: c.total_visitas || 0,
      nota: c.nota_media || 0,
    })),
    visitsByMonth: visitasData.reduce((acc: any[], visita) => {
      const month = format(new Date(visita.data_visita), 'MMM', { locale: ptBR });
      const existing = acc.find(item => item.month === month);

      if (existing) {
        if (visita.status === 'realizada') existing.realizadas++;
        else existing.agendadas++;
      } else {
        acc.push({
          month,
          realizadas: visita.status === 'realizada' ? 1 : 0,
          agendadas: visita.status !== 'realizada' ? 1 : 0,
        });
      }

      return acc;
    }, []),
    leadSources: leadsData.reduce((acc: { name: string; value: number }[], lead) => {
      const key = lead.status?.replace('_', ' ') || 'Outro';
      const existing = acc.find(s => s.name === key);
      if (existing) existing.value++;
      else acc.push({ name: key, value: 1 });
      return acc;
    }, [])
  };

  const processConversionData = () => {
    const thisMonth = leadsData.filter(lead => {
      const leadDate = new Date(lead.created_at);
      return leadDate >= startOfMonth(new Date()) && leadDate <= endOfMonth(new Date());
    });

    const converted = thisMonth.filter(lead => lead.status === 'visita_realizada').length;
    const total = thisMonth.length;
    const rate = total > 0 ? (converted / total) * 100 : 0;

    return { converted, total, rate };
  };

  if (!profile) return null;
  if (isLoadingLeads || isLoadingCorretores || isLoadingVisitas || isLoadingVendas || isLoadingScheduled) return <DashboardSkeleton />;

  const chartData = processLeadsData();
  const statusData = processStatusData();
  const conversionMetrics = processConversionData();
  const avgRating = corretoresData.length > 0
    ? (corretoresData.reduce((acc, c) => acc + c.nota_media, 0) / corretoresData.length).toFixed(1)
    : '0.0';

  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    setActiveTab('builder');
  };

  const handleSaveTemplate = (template: any) => {
    saveTemplateMutation.mutate(template);
  };

  const handleGenerateReport = (config: any) => {
    const { filters } = config;

    // 1. Filtrar leads com base nos filtros
    let filteredLeads = [...leadsData];
    if (filters.status) {
      filteredLeads = filteredLeads.filter(l => l.status === filters.status);
    }
    
    // Filtrar por período de data
    const now = new Date();
    let startDate = subDays(now, 30); // default 30 dias
    if (filters.date_range === 'last_7_days') startDate = subDays(now, 7);
    else if (filters.date_range === 'last_90_days') startDate = subDays(now, 90);
    else if (filters.date_range === 'this_year') startDate = new Date(now.getFullYear(), 0, 1);

    filteredLeads = filteredLeads.filter(l => new Date(l.created_at) >= startDate);

    // 2. Filtrar visitas
    let filteredVisitas = visitasData.filter(v => new Date(v.data_visita) >= startDate);

    // 3. Filtrar vendas
    let filteredVendas = vendasData.filter(v => new Date(v.created_at) >= startDate);

    // 4. Calcular métricas
    const totalLeads = filteredLeads.length;
    const totalVisits = filteredVisitas.length;
    
    const convertedLeads = filteredLeads.filter(l => l.status === 'visita_realizada').length;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    const computedAvgRating = corretoresData.length > 0
      ? corretoresData.reduce((acc, c) => acc + c.nota_media, 0) / corretoresData.length
      : 0;

    const totalRevenue = filteredVendas.reduce((acc: number, v: any) => acc + (v.valor_comissao_bruta || 0), 0);

    // 5. Preparar dados dos gráficos
    const leadsOverTime = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), i);
      return {
        name: format(date, 'dd/MM', { locale: ptBR }),
        value: filteredLeads.filter(lead =>
          format(new Date(lead.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        ).length
      };
    }).reverse();

    const statusCounts = filteredLeads.reduce((acc: Record<string, number>, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {});

    const leadsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      name: status?.replace('_', ' ') || 'Outro',
      value: count
    }));

    const conversionFunnel = [
      { name: 'Leads', value: totalLeads },
      { name: 'Visitas', value: totalVisits },
      { name: 'Vendas', value: filteredVendas.length },
    ];

    const corretorPerformance = corretoresData.slice(0, 5).map(c => ({
      name: `${c.profiles.first_name} ${c.profiles.last_name}`,
      visitas: c.total_visitas || 0,
      nota: c.nota_media || 0,
    }));

    const visitsByMonth = filteredVisitas.reduce((acc: any[], visita) => {
      const month = format(new Date(visita.data_visita), 'MMM', { locale: ptBR });
      const existing = acc.find(item => item.month === month);

      if (existing) {
        if (visita.status === 'realizada') existing.realizadas++;
        else existing.agendadas++;
      } else {
        acc.push({
          month,
          realizadas: visita.status === 'realizada' ? 1 : 0,
          agendadas: visita.status !== 'realizada' ? 1 : 0,
        });
      }
      return acc;
    }, []);

    const leadSources = filteredLeads.reduce((acc: { name: string; value: number }[], lead) => {
      const key = lead.status?.replace('_', ' ') || 'Outro';
      const existing = acc.find(s => s.name === key);
      if (existing) existing.value++;
      else acc.push({ name: key, value: 1 });
      return acc;
    }, []);

    setGeneratedReportConfig({
      name: config.name || 'Relatório de Performance',
      description: config.description || 'Relatório detalhado gerado dinamicamente com filtros do sistema.',
      period: config.period,
      charts: config.charts,
      metrics: config.metrics,
      filters: config.filters
    });
    setGeneratedReportData({
      leadsOverTime,
      leadsByStatus,
      conversionFunnel,
      corretorPerformance,
      visitsByMonth,
      leadSources,
      metrics: {
        totalLeads,
        conversionRate,
        totalVisits,
        avgRating: computedAvgRating,
        totalRevenue
      },
      rawLeads: filteredLeads,
      rawVisitas: filteredVisitas,
      rawVendas: filteredVendas
    });
    setGeneratedReportOpen(true);
  };

  const handleExportDashboard = async () => {
    try {
      toast({
        title: "Exportando dados...",
        description: "Carregando planilha do dashboard.",
      });

      const payload = leadsData.map(l => ({
        Nome: l.nome || 'Sem Nome',
        Status: l.status ? l.status.replace(/_/g, ' ') : 'Novo',
        CriadoEm: format(new Date(l.created_at), 'dd/MM/yyyy HH:mm')
      }));

      const response = await supabase.functions.invoke('export-reports', {
        body: {
          format: 'csv',
          data: payload,
          title: 'Dashboard_Leads',
          period: '30_dias'
        }
      });

      if (response.error) throw new Error(response.error.message || 'Erro ao exportar');

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_dashboard_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Exportação Concluída",
        description: "Os dados do dashboard foram salvos em CSV.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao exportar",
        description: err.message || "Não foi possível exportar os dados do dashboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatórios e Analytics</h1>
            <p className="text-muted-foreground">
              Sistema completo de relatórios e insights
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => setScheduleModalOpen(true)}
            >
              <Clock className="w-4 h-4" />
              Agendar Relatório
            </Button>
            <Button
              className="flex items-center gap-2"
              onClick={handleExportDashboard}
            >
              <Download className="w-4 h-4" />
              Exportar Dados
            </Button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="builder" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Construtor
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Agendados
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Leads Este Mês
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{conversionMetrics.total}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    total no período
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Taxa de Conversão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{conversionMetrics.rate.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                    média atual
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Visitas Realizadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {visitasData.filter(v => v.status === 'realizada').length}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                    total acumulado
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Nota Média Corretores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgRating}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <span className="opacity-70">avaliação geral</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Leads por Dia */}
              <Card>
                <CardHeader>
                  <CardTitle>Leads por Dia (Últimos 7 dias)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="leads" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Status dos Leads */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição por Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {statusData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Top Corretores */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Corretores por Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {corretoresData.map((corretor, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="font-semibold">
                            {corretor.profiles.first_name} {corretor.profiles.last_name}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant={corretor.status === 'ativo' ? 'success' : 'secondary'}>
                              {corretor.status}
                            </Badge>
                            <span>•</span>
                            <span>{corretor.total_visitas} visitas</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{corretor.nota_media.toFixed(1)}/5.0</div>
                        <div className="text-sm text-muted-foreground">Avaliação</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <ReportTemplateManager 
              onSelectTemplate={handleSelectTemplate} 
              onNewTemplate={() => { setSelectedTemplate(null); setActiveTab('builder'); }}
            />
          </TabsContent>

          {/* Builder Tab */}
          <TabsContent value="builder">
            <ReportBuilder
              template={selectedTemplate}
              onSave={handleSaveTemplate}
              onGenerate={handleGenerateReport}
            />
          </TabsContent>

          {/* Scheduled Reports Tab */}
          <TabsContent value="scheduled">
            <Card>
              <CardHeader>
                <CardTitle>Relatórios Agendados</CardTitle>
                <CardDescription>
                  Gerencie seus relatórios programados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {scheduledReports.length > 0 ? (
                  <div className="space-y-4">
                    {scheduledReports.map((schedule: any) => (
                      <div
                        key={schedule.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <div className="space-y-1">
                          <h4 className="font-semibold text-sm">
                            {schedule.report_templates?.name || 'Template de Relatório'}
                          </h4>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                            <Badge variant="secondary" className="capitalize">
                              {schedule.schedule_type === 'daily' ? 'Diário' :
                               schedule.schedule_type === 'weekly' ? 'Semanal' :
                               schedule.schedule_type === 'monthly' ? 'Mensal' : 'Trimestral'}
                            </Badge>
                            <span>•</span>
                            <span>Próximo envio: {new Date(schedule.next_run).toLocaleDateString('pt-BR')}</span>
                            <span>•</span>
                            <span className="truncate max-w-[200px]" title={schedule.recipients.join(', ')}>
                              Destinatários: {schedule.recipients.length} email(s)
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/5"
                          onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                          disabled={deleteScheduleMutation.isPending}
                        >
                          Cancelar Agendamento
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum relatório agendado</h3>
                    <p>Configure relatórios automáticos para receber insights regulares.</p>
                    <Button className="mt-4" onClick={() => setScheduleModalOpen(true)}>
                      <Clock className="w-4 h-4 mr-2" />
                      Agendar Primeiro Relatório
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Schedule Report Modal */}
        <ScheduleReportModal
          open={scheduleModalOpen}
          onOpenChange={setScheduleModalOpen}
          template={selectedTemplate}
        />

        {/* Generated Report Dialog */}
        {generatedReportConfig && generatedReportData && (
          <GeneratedReportDialog
            open={generatedReportOpen}
            onOpenChange={setGeneratedReportOpen}
            config={generatedReportConfig}
            data={generatedReportData}
          />
        )}
      </div>
    </DashboardLayout>
  );
}