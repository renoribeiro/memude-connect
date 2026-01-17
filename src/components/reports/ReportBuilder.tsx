import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar,
  BarChart3,
  PieChart,
  LineChart,
  TrendingUp,
  Users,
  Target,
  DollarSign,
  Settings,
  Play,
  Save,
} from 'lucide-react';
import { AdvancedCharts } from '@/components/charts/AdvancedCharts';

interface ReportTemplate {
  id?: string;
  name: string;
  description: string;
  template_config: any;
  category: string;
  is_public: boolean;
}

interface ReportBuilderProps {
  template?: ReportTemplate;
  onSave: (template: ReportTemplate) => void;
  onGenerate: (config: any) => void;
}

const AVAILABLE_CHARTS = [
  { id: 'leads_over_time', name: 'Leads ao longo do tempo', icon: LineChart, type: 'line' },
  { id: 'leads_by_status', name: 'Leads por status', icon: PieChart, type: 'pie' },
  { id: 'conversion_funnel', name: 'Funil de conversão', icon: Target, type: 'radial' },
  { id: 'corretor_performance', name: 'Performance de corretores', icon: BarChart3, type: 'bar' },
  { id: 'visits_by_month', name: 'Visitas por mês', icon: Calendar, type: 'line' },
  { id: 'lead_sources', name: 'Fontes de leads', icon: TrendingUp, type: 'pie' },
];

const AVAILABLE_METRICS = [
  { id: 'total_leads', name: 'Total de Leads', icon: Users },
  { id: 'conversion_rate', name: 'Taxa de Conversão', icon: Target },
  { id: 'total_visits', name: 'Total de Visitas', icon: Calendar },
  { id: 'avg_rating', name: 'Avaliação Média', icon: TrendingUp },
  { id: 'total_revenue', name: 'Receita Total', icon: DollarSign },
];

export function ReportBuilder({ template, onSave, onGenerate }: ReportBuilderProps) {
  const [config, setConfig] = useState({
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || 'custom',
    period: template?.template_config?.period || 'monthly',
    charts: template?.template_config?.charts || [],
    metrics: template?.template_config?.metrics || [],
    filters: template?.template_config?.filters || {
      empreendimento: '',
      corretor: '',
      status: '',
      date_range: 'last_30_days'
    }
  });

  const [previewData] = useState({
    leadsOverTime: [
      { name: 'Jan', value: 45 },
      { name: 'Fev', value: 52 },
      { name: 'Mar', value: 48 },
      { name: 'Abr', value: 63 },
    ],
    leadsByStatus: [
      { name: 'Novo', value: 35 },
      { name: 'Contato', value: 28 },
      { name: 'Agendado', value: 22 },
      { name: 'Convertido', value: 15 },
    ],
    conversionFunnel: [
      { name: 'Leads', value: 100, fill: 'hsl(var(--primary))' },
      { name: 'Contato', value: 75, fill: 'hsl(var(--secondary))' },
      { name: 'Visitas', value: 45, fill: 'hsl(var(--accent))' },
      { name: 'Vendas', value: 25, fill: 'hsl(var(--primary))' },
    ],
    corretorPerformance: [
      { name: 'João Silva', value: 12, visitas: 12, nota: 4.8 },
      { name: 'Maria Santos', value: 10, visitas: 10, nota: 4.6 },
      { name: 'Pedro Costa', value: 8, visitas: 8, nota: 4.4 },
    ],
    visitsByMonth: [],
    leadSources: [
      { name: 'Website', value: 45 },
      { name: 'Redes Sociais', value: 32 },
      { name: 'Indicação', value: 18 },
      { name: 'Google Ads', value: 12 },
    ]
  });

  const handleChartToggle = (chartId: string) => {
    setConfig(prev => ({
      ...prev,
      charts: prev.charts.includes(chartId)
        ? prev.charts.filter((id: string) => id !== chartId)
        : [...prev.charts, chartId]
    }));
  };

  const handleMetricToggle = (metricId: string) => {
    setConfig(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metricId)
        ? prev.metrics.filter((id: string) => id !== metricId)
        : [...prev.metrics, metricId]
    }));
  };

  const handleSave = () => {
    const templateData: ReportTemplate = {
      id: template?.id,
      name: config.name,
      description: config.description,
      category: config.category,
      is_public: false,
      template_config: {
        period: config.period,
        charts: config.charts,
        metrics: config.metrics,
        filters: config.filters
      }
    };
    onSave(templateData);
  };

  const handleGenerate = () => {
    onGenerate(config);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Construtor de Relatórios</h2>
          <p className="text-muted-foreground">
            Configure seu relatório personalizado
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Salvar Template
          </Button>
          <Button onClick={handleGenerate}>
            <Play className="mr-2 h-4 w-4" />
            Gerar Relatório
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configurações Básicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Relatório</Label>
                <Input
                  id="name"
                  placeholder="Ex: Relatório Mensal de Performance"
                  value={config.name}
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o objetivo deste relatório..."
                  value={config.description}
                  onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period">Período</Label>
                <Select value={config.period} onValueChange={(value) => setConfig(prev => ({ ...prev, period: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Charts Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Gráficos</CardTitle>
              <CardDescription>
                Selecione os gráficos que deseja incluir no relatório
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {AVAILABLE_CHARTS.map(chart => (
                <div key={chart.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={chart.id}
                    checked={config.charts.includes(chart.id)}
                    onCheckedChange={() => handleChartToggle(chart.id)}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <chart.icon className="w-4 h-4" />
                    <Label htmlFor={chart.id} className="text-sm cursor-pointer">
                      {chart.name}
                    </Label>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {chart.type}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Metrics Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Métricas</CardTitle>
              <CardDescription>
                Escolha as métricas principais para destacar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {AVAILABLE_METRICS.map(metric => (
                <div key={metric.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={metric.id}
                    checked={config.metrics.includes(metric.id)}
                    onCheckedChange={() => handleMetricToggle(metric.id)}
                  />
                  <div className="flex items-center gap-2">
                    <metric.icon className="w-4 h-4" />
                    <Label htmlFor={metric.id} className="text-sm cursor-pointer">
                      {metric.name}
                    </Label>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Preview do Relatório</CardTitle>
              <CardDescription>
                Visualize como seu relatório ficará
              </CardDescription>
            </CardHeader>
            <CardContent>
              {config.charts.length > 0 ? (
                <AdvancedCharts
                  leadsOverTime={previewData.leadsOverTime}
                  leadsByStatus={previewData.leadsByStatus}
                  conversionFunnel={previewData.conversionFunnel}
                  corretorPerformance={previewData.corretorPerformance}
                  visitsByMonth={previewData.visitsByMonth}
                  leadSources={previewData.leadSources}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Selecione gráficos para visualizar</h3>
                  <p className="text-center">
                    Escolha os gráficos na configuração à esquerda para ver o preview aqui.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}