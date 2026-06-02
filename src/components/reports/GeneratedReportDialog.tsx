import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  Legend
} from 'recharts';
import {
  Users,
  Target,
  Calendar,
  Star,
  DollarSign,
  Download,
  Printer,
  TrendingUp,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d', '#ffc658'];

interface GeneratedReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: {
    name: string;
    description: string;
    period: string;
    charts: string[];
    metrics: string[];
    filters: any;
  };
  data: {
    leadsOverTime: any[];
    leadsByStatus: any[];
    conversionFunnel: any[];
    corretorPerformance: any[];
    visitsByMonth: any[];
    leadSources: any[];
    metrics: {
      totalLeads: number;
      conversionRate: number;
      totalVisits: number;
      avgRating: number;
      totalRevenue: number;
    };
    rawLeads: any[];
    rawVisitas: any[];
    rawVendas: any[];
  };
}

export function GeneratedReportDialog({ open, onOpenChange, config, data }: GeneratedReportDialogProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'daily': return 'Diário';
      case 'weekly': return 'Semanal';
      case 'monthly': return 'Mensal';
      case 'quarterly': return 'Trimestral';
      case 'yearly': return 'Anual';
      default: return period;
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('report-printable-area');
    if (!printContent) return;

    const originalContent = document.body.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Inject styles and content
    printWindow.document.write(`
      <html>
        <head>
          <title>${config.name || 'Relatório'}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { font-size: 24px; margin-bottom: 5px; }
            p { margin: 5px 0; color: #666; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
            .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
            .card-title { font-size: 12px; text-transform: uppercase; color: #777; margin-bottom: 5px; }
            .card-val { font-size: 20px; font-weight: bold; }
            .section { margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
            .section-title { font-size: 16px; font-weight: bold; margin-bottom: 15px; }
            .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            .data-table th { background-color: #f5f5f5; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div>
            <h1>${config.name || 'Relatório de Atividades'}</h1>
            <p>${config.description || 'Relatório analítico gerado pelo MeMude Connect.'}</p>
            <p><strong>Período:</strong> ${getPeriodLabel(config.period)} | <strong>Gerado em:</strong> ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
          
          <div class="grid">
            ${config.metrics.includes('total_leads') ? `
              <div class="card">
                <div class="card-title">Total de Leads</div>
                <div class="card-val">${data.metrics.totalLeads}</div>
              </div>
            ` : ''}
            ${config.metrics.includes('conversion_rate') ? `
              <div class="card">
                <div class="card-title">Taxa de Conversão</div>
                <div class="card-val">${data.metrics.conversionRate.toFixed(1)}%</div>
              </div>
            ` : ''}
            ${config.metrics.includes('total_visits') ? `
              <div class="card">
                <div class="card-title">Total de Visitas</div>
                <div class="card-val">${data.metrics.totalVisits}</div>
              </div>
            ` : ''}
            ${config.metrics.includes('avg_rating') ? `
              <div class="card">
                <div class="card-title">Avaliação Corretores</div>
                <div class="card-val">${data.metrics.avgRating.toFixed(1)} / 5.0</div>
              </div>
            ` : ''}
            ${config.metrics.includes('total_revenue') ? `
              <div class="card">
                <div class="card-title">Vendas Fechadas</div>
                <div class="card-val">R$ ${data.metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
            ` : ''}
          </div>

          <div class="section">
            <div class="section-title">Resumo dos Gráficos Selecionados</div>
            <ul>
              ${config.charts.map(c => `<li>Gráfico incluído: ${c.replace(/_/g, ' ')}</li>`).join('')}
            </ul>
          </div>

          <div class="section">
            <div class="section-title">Últimos Leads Registrados no Período</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Status</th>
                  <th>Data Criação</th>
                </tr>
              </thead>
              <tbody>
                ${data.rawLeads.slice(0, 10).map(l => `
                  <tr>
                    <td>${l.nome || 'Sem Nome'}</td>
                    <td>${l.status?.replace(/_/g, ' ') || 'Novo'}</td>
                    <td>${new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setIsExporting(true);
      
      // Prepare payload to export
      const exportPayload = {
        summary: [
          { Metrica: 'Total de Leads', Valor: data.metrics.totalLeads },
          { Metrica: 'Taxa de Conversão (%)', Valor: data.metrics.conversionRate },
          { Metrica: 'Total de Visitas', Valor: data.metrics.totalVisits },
          { Metrica: 'Avaliação Média', Valor: data.metrics.avgRating },
          { Metrica: 'Receita Total (R$)', Valor: data.metrics.totalRevenue },
        ],
        detailed: data.rawLeads.map(l => ({
          ID: l.id,
          Nome: l.nome,
          Telefone: l.telefone,
          Status: l.status,
          CriadoEm: l.created_at,
          Origem: l.origem || 'Website'
        }))
      };

      const response = await supabase.functions.invoke('export-reports', {
        body: {
          format,
          data: format === 'json' ? exportPayload : exportPayload.detailed,
          title: config.name ? config.name.replace(/\s+/g, '_') : 'Relatorio',
          period: config.period
        }
      });

      if (response.error) throw new Error(response.error.message || 'Erro ao chamar função de exportação');

      let blob;
      let filename = `${config.name ? config.name.replace(/\s+/g, '_') : 'relatorio'}_${config.period}`;

      if (format === 'json') {
        blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        filename += '.json';
      } else {
        blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        filename += '.csv';
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Exportação concluída',
        description: `Relatório exportado em formato ${format.toUpperCase()}`,
      });
    } catch (err: any) {
      console.error('Error exporting:', err);
      toast({
        title: 'Erro ao exportar',
        description: err.message || 'Falha ao exportar relatório.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-2.5 shadow-lg text-xs">
          <p className="font-semibold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[850px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {config.name || 'Visualização do Relatório'}
              </DialogTitle>
              <DialogDescription>
                {config.description || 'Relatório analítico gerado com dados do sistema.'}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 gap-1">
                <Printer className="w-3.5 h-3.5" />
                Imprimir / PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('json')} disabled={isExporting} className="h-8 gap-1">
                <Download className="w-3.5 h-3.5" />
                JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={isExporting} className="h-8 gap-1">
                <Download className="w-3.5 h-3.5" />
                CSV
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6" id="report-printable-area">
          {/* Metadata info */}
          <div className="flex flex-wrap justify-between items-center gap-2 p-3 bg-slate-50 border rounded-lg text-xs text-muted-foreground">
            <div><strong>Frequência/Período:</strong> {getPeriodLabel(config.period)}</div>
            <div><strong>Filtro Leads:</strong> {config.filters.status ? config.filters.status.replace(/_/g, ' ') : 'Todos'}</div>
            <div><strong>Gerado em:</strong> {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</div>
          </div>

          {/* Metrics grids */}
          {config.metrics.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {config.metrics.includes('total_leads') && (
                <Card className="shadow-sm">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      Total Leads
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <span className="text-xl font-bold">{data.metrics.totalLeads}</span>
                  </CardContent>
                </Card>
              )}

              {config.metrics.includes('conversion_rate') && (
                <Card className="shadow-sm">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-secondary" />
                      Conversão
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <span className="text-xl font-bold">{data.metrics.conversionRate.toFixed(1)}%</span>
                  </CardContent>
                </Card>
              )}

              {config.metrics.includes('total_visits') && (
                <Card className="shadow-sm">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-accent" />
                      Visitas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <span className="text-xl font-bold">{data.metrics.totalVisits}</span>
                  </CardContent>
                </Card>
              )}

              {config.metrics.includes('avg_rating') && (
                <Card className="shadow-sm">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-yellow-500" />
                      Avaliação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <span className="text-xl font-bold">{data.metrics.avgRating.toFixed(1)}</span>
                  </CardContent>
                </Card>
              )}

              {config.metrics.includes('total_revenue') && (
                <Card className="shadow-sm">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                      Comissão Geral
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <span className="text-lg font-bold text-emerald-600 truncate block">
                      R$ {data.metrics.totalRevenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    </span>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Selected Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {config.charts.includes('leads_over_time') && (
              <Card className="p-4">
                <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Evolução de Leads
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data.leadsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {config.charts.includes('leads_by_status') && (
              <Card className="p-4">
                <CardHeader className="p-0 pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-secondary" />
                    Leads por Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.leadsByStatus}
                        cx="50%"
                        cy="50%"
                        outerRadius={65}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.leadsByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {config.charts.includes('conversion_funnel') && (
              <Card className="p-4">
                <CardHeader className="p-0 pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-accent" />
                    Funil de Conversão
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ResponsiveContainer width="100%" height={220}>
                    <RadialBarChart cx="50%" cy="50%" innerRadius="25%" outerRadius="80%" data={data.conversionFunnel}>
                      <RadialBar dataKey="value" cornerRadius={6} fill="hsl(var(--primary))" />
                      <Legend iconSize={8} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '10px' }} />
                      <Tooltip content={<CustomTooltip />} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {config.charts.includes('corretor_performance') && (
              <Card className="p-4">
                <CardHeader className="p-0 pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    Performance Corretores (Visitas)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.corretorPerformance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="visitas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {config.charts.includes('visits_by_month') && (
              <Card className="p-4">
                <CardHeader className="p-0 pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-accent" />
                    Visitas por Mês
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data.visitsByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="realizadas" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
                      <Line type="monotone" dataKey="agendadas" stroke="hsl(var(--secondary))" strokeWidth={1.5} strokeDasharray="3 3" dot={{ fill: "hsl(var(--secondary))", r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {config.charts.includes('lead_sources') && (
              <Card className="p-4">
                <CardHeader className="p-0 pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-yellow-500" />
                    Fontes de Leads
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.leadSources}
                        cx="50%"
                        cy="50%"
                        outerRadius={65}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.leadSources.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
