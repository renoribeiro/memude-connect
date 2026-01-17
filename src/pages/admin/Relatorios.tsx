import { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
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
import { subDays, startOfMonth, endOfMonth } from "@/utils/dateHelpers";
import { AdvancedCharts } from "@/components/charts/AdvancedCharts";
import { ReportTemplateManager } from "@/components/reports/ReportTemplateManager";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { ScheduleReportModal } from "@/components/reports/ScheduleReportModal";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d'];

export default function Relatorios() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  // Dados de leads por período
  const { data: leadsData = [], isLoading: isLoadingLeads } = useQuery({
    queryKey: ['reports-leads'],
    queryFn: async () => {
      const startDate = subDays(new Date(), 30);
      const { data, error } = await supabase
        .from('leads')
        .select('created_at, status')
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
    const statusCounts = leadsData.reduce((acc: Record<string, number>, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace('_', ' '),
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
    leadSources: [
      { name: 'Website', value: 45 },
      { name: 'Redes Sociais', value: 32 },
      { name: 'Indicação', value: 18 },
      { name: 'Google Ads', value: 12 },
      { name: 'Outros', value: 8 },
    ]
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
  if (isLoadingLeads || isLoadingCorretores || isLoadingVisitas) return <DashboardSkeleton />;

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
    // Implementation for saving template
    console.log('Saving template:', template);
  };

  const handleGenerateReport = (config: any) => {
    // Implementation for generating report
    console.log('Generating report with config:', config);
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
            <Button className="flex items-center gap-2">
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
                +12% vs mês anterior
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
                +2.4% vs mês anterior
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
                +8% vs mês anterior
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
                <ArrowDownRight className="w-3 h-3 text-red-500" />
                -0.2 vs mês anterior
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
            <ReportTemplateManager onSelectTemplate={handleSelectTemplate} />
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
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum relatório agendado</h3>
                  <p>Configure relatórios automáticos para receber insights regulares.</p>
                  <Button className="mt-4" onClick={() => setScheduleModalOpen(true)}>
                    <Clock className="w-4 h-4 mr-2" />
                    Agendar Primeiro Relatório
                  </Button>
                </div>
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
      </div>
    </DashboardLayout>
  );
}