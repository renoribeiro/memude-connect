import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Download, 
  FileText, 
  Calendar as CalendarIcon,
  Settings,
  Loader2
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { downloadXlsx, type WorkbookSheet } from '@/utils/xlsxExport';
import { strToU8, zipSync } from 'fflate';

interface ExportOptions {
  startDate: Date;
  endDate: Date;
  format: 'excel' | 'csv';
  includeAttempts: boolean;
  includeQueue: boolean;
  includeCommunications: boolean;
  includeCorretorStats: boolean;
}

export const DistributionExporter = () => {
  const [options, setOptions] = useState<ExportOptions>({
    startDate: subDays(new Date(), 7),
    endDate: new Date(),
    format: 'excel',
    includeAttempts: true,
    includeQueue: true,
    includeCommunications: false,
    includeCorretorStats: true
  });

  const [isExporting, setIsExporting] = useState(false);

  const fetchExportData = async () => {
    const start = startOfDay(options.startDate).toISOString();
    const end = endOfDay(options.endDate).toISOString();

    const data: any = {};

    // Distribution attempts
    if (options.includeAttempts) {
      const { data: attempts, error: attemptsError } = await supabase
        .from('distribution_attempts')
        .select(`
          id, lead_id, corretor_id, attempt_order, status, response_type, response_message,
          message_sent_at, response_received_at, timeout_at, created_at,
          leads!inner(nome, telefone, email),
          corretores!inner(
            profiles!inner(first_name, last_name),
            whatsapp,
            creci
          )
        `)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (attemptsError) throw attemptsError;
      data.attempts = attempts;
    }

    // Distribution queue
    if (options.includeQueue) {
      const { data: queue, error: queueError } = await supabase
        .from('distribution_queue')
        .select(`
          id, lead_id, assigned_corretor_id, status, current_attempt,
          failure_reason, started_at, completed_at, created_at,
          leads!inner(nome, telefone, email, empreendimento_id)
        `)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (queueError) throw queueError;
      data.queue = queue;
    }

    // Communications
    if (options.includeCommunications) {
      const { data: communications, error: commError } = await supabase
        .from('communication_log')
        .select('id, lead_id, corretor_id, direction, type, status, phone_number, content, message_id, created_at')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (commError) throw commError;
      data.communications = communications;
    }

    // Corretor stats
    if (options.includeCorretorStats) {
      const { data: corretorStats, error: statsError } = await supabase
        .from('distribution_attempts')
        .select(`
          corretor_id,
          status,
          response_received_at,
          message_sent_at,
          corretores!inner(
            profiles!inner(first_name, last_name),
            whatsapp,
            creci,
            total_visitas,
            nota_media
          )
        `)
        .gte('created_at', start)
        .lte('created_at', end);

      if (statsError) throw statsError;

      // Agrupar por corretor
      const statsMap = new Map();
      corretorStats?.forEach(attempt => {
        const id = attempt.corretor_id;
        if (!statsMap.has(id)) {
          statsMap.set(id, {
            corretor_id: id,
            nome: `${attempt.corretores.profiles.first_name} ${attempt.corretores.profiles.last_name}`,
            whatsapp: attempt.corretores.whatsapp,
            creci: attempt.corretores.creci,
            total_visitas: attempt.corretores.total_visitas,
            nota_media: attempt.corretores.nota_media,
            total_attempts: 0,
            accepted: 0,
            rejected: 0,
            timeout: 0,
            response_times: []
          });
        }
        
        const stats = statsMap.get(id);
        stats.total_attempts++;
        
        if (attempt.status === 'accepted') stats.accepted++;
        else if (attempt.status === 'rejected') stats.rejected++;
        else if (attempt.status === 'timeout') stats.timeout++;
        
        if (attempt.response_received_at && attempt.message_sent_at) {
          const responseTime = (new Date(attempt.response_received_at).getTime() - 
                              new Date(attempt.message_sent_at).getTime()) / (1000 * 60);
          stats.response_times.push(responseTime);
        }
      });

      data.corretorStats = Array.from(statsMap.values()).map(stats => ({
        ...stats,
        acceptance_rate: stats.total_attempts > 0 ? (stats.accepted / stats.total_attempts) * 100 : 0,
        response_time_avg: stats.response_times.length > 0 
          ? stats.response_times.reduce((a: number, b: number) => a + b, 0) / stats.response_times.length 
          : 0
      }));
    }

    return data;
  };

  const exportToExcel = (data: any) => {
    const sheets: WorkbookSheet[] = [];
    const appendSheet = (name: string, rows: Record<string, unknown>[]) => {
      sheets.push({ name, rows });
    };

    // Aba de tentativas de distribuição
    if (data.attempts) {
      const attemptsData = data.attempts.map((attempt: any) => ({
        'Data/Hora': format(new Date(attempt.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        'Lead': attempt.leads.nome,
        'Telefone': attempt.leads.telefone,
        'Corretor': `${attempt.corretores.profiles.first_name} ${attempt.corretores.profiles.last_name}`,
        'WhatsApp Corretor': attempt.corretores.whatsapp,
        'Ordem Tentativa': attempt.attempt_order,
        'Status': attempt.status,
        'Resposta': attempt.response_type || '',
        'Mensagem Resposta': attempt.response_message || '',
        'Enviado em': attempt.message_sent_at ? format(new Date(attempt.message_sent_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
        'Respondido em': attempt.response_received_at ? format(new Date(attempt.response_received_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
        'Timeout em': attempt.timeout_at ? format(new Date(attempt.timeout_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : ''
      }));

      appendSheet('Tentativas de Distribuição', attemptsData);
    }

    // Aba da fila de distribuição
    if (data.queue) {
      const queueData = data.queue.map((item: any) => ({
        'Data Criação': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        'Lead': item.leads.nome,
        'Telefone': item.leads.telefone,
        'Status': item.status,
        'Tentativa Atual': item.current_attempt,
        'Iniciado em': item.started_at ? format(new Date(item.started_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
        'Completado em': item.completed_at ? format(new Date(item.completed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
        'Motivo Falha': item.failure_reason || ''
      }));

      appendSheet('Fila de Distribuição', queueData);
    }

    // Aba de comunicações
    if (data.communications) {
      const commData = data.communications.map((comm: any) => ({
        'Data/Hora': format(new Date(comm.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        'Tipo': comm.type,
        'Direção': comm.direction,
        'Telefone': comm.phone_number,
        'Status': comm.status,
        'Mensagem': comm.content
          ? comm.content.substring(0, 100) + (comm.content.length > 100 ? '...' : '')
          : '',
        'Message ID': comm.message_id || ''
      }));

      appendSheet('Comunicações', commData);
    }

    // Aba de estatísticas dos corretores
    if (data.corretorStats) {
      const statsData = data.corretorStats.map((stats: any) => ({
        'Corretor': stats.nome,
        'WhatsApp': stats.whatsapp,
        'CRECI': stats.creci,
        'Total Tentativas': stats.total_attempts,
        'Aceitos': stats.accepted,
        'Rejeitados': stats.rejected,
        'Timeouts': stats.timeout,
        'Taxa Aceitação (%)': stats.acceptance_rate.toFixed(2),
        'Tempo Médio Resposta (min)': stats.response_time_avg.toFixed(2),
        'Total Visitas': stats.total_visitas,
        'Nota Média': stats.nota_media
      }));

      appendSheet('Estatísticas Corretores', statsData);
    }

    // Salvar arquivo
    const fileName = `relatorio_distribuicao_${format(options.startDate, 'yyyy-MM-dd')}_${format(options.endDate, 'yyyy-MM-dd')}.xlsx`;
    downloadXlsx(sheets, fileName);
  };

  const exportToCSV = (data: any) => {
    const files: Record<string, Uint8Array> = {};
    const escapeCsv = (value: unknown) => {
      const text = String(value ?? '');
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const addCsv = (name: string, rows: Record<string, unknown>[]) => {
      if (rows.length === 0) return;
      const headers = Object.keys(rows[0]);
      const output = [
        headers.map(escapeCsv).join(','),
        ...rows.map(row => headers.map(header => escapeCsv(row[header])).join(',')),
      ].join('\r\n');
      files[`${name}.csv`] = strToU8(`\uFEFF${output}`);
    };

    addCsv('tentativas_distribuicao', (data.attempts ?? []).map((attempt: any) => ({
      data_hora: format(new Date(attempt.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      lead: attempt.leads.nome,
      telefone: attempt.leads.telefone,
      corretor: `${attempt.corretores.profiles.first_name} ${attempt.corretores.profiles.last_name}`,
      status: attempt.status,
      ordem_tentativa: attempt.attempt_order,
      resposta: attempt.response_type || '',
      mensagem_resposta: attempt.response_message || ''
    })));
    addCsv('fila_distribuicao', (data.queue ?? []).map((item: any) => ({
      data_criacao: format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      lead: item.leads.nome,
      telefone: item.leads.telefone,
      status: item.status,
      tentativa_atual: item.current_attempt,
      iniciado_em: item.started_at ? format(new Date(item.started_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
      completado_em: item.completed_at ? format(new Date(item.completed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
      motivo_falha: item.failure_reason || ''
    })));
    addCsv('comunicacoes', (data.communications ?? []).map((comm: any) => ({
      data_hora: comm.created_at ? format(new Date(comm.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
      tipo: comm.type,
      direcao: comm.direction,
      telefone: comm.phone_number || '',
      status: comm.status || '',
      mensagem: comm.content || '',
      message_id: comm.message_id || ''
    })));
    addCsv('estatisticas_corretores', (data.corretorStats ?? []).map((stats: any) => ({
      corretor: stats.nome,
      whatsapp: stats.whatsapp,
      creci: stats.creci,
      total_tentativas: stats.total_attempts,
      aceitos: stats.accepted,
      rejeitados: stats.rejected,
      timeouts: stats.timeout,
      taxa_aceitacao_percentual: stats.acceptance_rate.toFixed(2),
      tempo_medio_resposta_minutos: stats.response_time_avg.toFixed(2),
      total_visitas: stats.total_visitas,
      nota_media: stats.nota_media
    })));

    if (Object.keys(files).length === 0) {
      throw new Error('Não há dados no período selecionado para exportar.');
    }

    const blob = new Blob([zipSync(files)], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_distribuicao_${format(options.startDate, 'yyyy-MM-dd')}_${format(options.endDate, 'yyyy-MM-dd')}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (!options.includeAttempts && !options.includeQueue && !options.includeCommunications && !options.includeCorretorStats) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma opção para exportar",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    
    try {
      const data = await fetchExportData();
      
      if (options.format === 'excel') {
        exportToExcel(data);
      } else if (options.format === 'csv') {
        exportToCSV(data);
      }
      
      toast({
        title: "Sucesso",
        description: "Relatório exportado com sucesso!"
      });
    } catch (error) {
      console.error('Erro na exportação:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao exportar relatório",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Exportar Relatórios
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Período */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Data Início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(options.startDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={options.startDate}
                  onSelect={(date) => date && setOptions(prev => ({ ...prev, startDate: date }))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <Label>Data Fim</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(options.endDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={options.endDate}
                  onSelect={(date) => date && setOptions(prev => ({ ...prev, endDate: date }))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Formato */}
        <div>
          <Label>Formato do Arquivo</Label>
          <Select 
            value={options.format} 
            onValueChange={(value: 'excel' | 'csv') =>
              setOptions(prev => ({ ...prev, format: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excel">Excel (.xlsx)</SelectItem>
              <SelectItem value="csv">CSV (arquivos em .zip)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Opções de Conteúdo */}
        <div>
          <Label className="text-base font-medium">Incluir nos Relatórios</Label>
          <div className="space-y-3 mt-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="attempts"
                checked={options.includeAttempts}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, includeAttempts: !!checked }))
                }
              />
              <Label htmlFor="attempts">Tentativas de Distribuição</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="queue"
                checked={options.includeQueue}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, includeQueue: !!checked }))
                }
              />
              <Label htmlFor="queue">Fila de Distribuição</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="communications"
                checked={options.includeCommunications}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, includeCommunications: !!checked }))
                }
              />
              <Label htmlFor="communications">Log de Comunicações</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="corretor-stats"
                checked={options.includeCorretorStats}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, includeCorretorStats: !!checked }))
                }
              />
              <Label htmlFor="corretor-stats">Estatísticas dos Corretores</Label>
            </div>
          </div>
        </div>

        {/* Botão de Exportação */}
        <Button 
          onClick={handleExport} 
          className="w-full" 
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Exportar Relatório
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
