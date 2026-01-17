import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { DistributionTester } from "./DistributionTester";
import { AdvancedDistributionMetrics } from "./AdvancedDistributionMetrics";
import { DistributionExporter } from "./DistributionExporter";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { withSupabaseRetry } from "@/lib/retryLogic";
import { useValidations } from "@/hooks/useValidations";

interface DistributionAttempt {
  id: string;
  lead_id: string;
  corretor_id: string;
  attempt_order: number;
  status: 'pending' | 'accepted' | 'rejected' | 'timeout';
  response_type: 'accepted' | 'rejected' | null;
  response_message: string | null;
  message_sent_at: string;
  response_received_at: string | null;
  timeout_at: string;
  whatsapp_message_id: string | null;
  created_at: string;
  leads: {
    nome: string;
    telefone: string;
    email: string;
  };
  corretores: {
    profiles: {
      first_name: string;
      last_name: string;
    };
  };
}

interface DistributionQueue {
  id: string;
  lead_id: string;
  current_attempt: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  failure_reason: string | null;
  assigned_corretor_id: string | null;
  created_at: string;
  leads: {
    nome: string;
    telefone: string;
    email: string;
    empreendimento_id: string;
  };
}

export const DistributionMonitor = () => {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const { validateWhatsappMessage } = useValidations();
  
  const getFilteredDateRange = () => {
    const start = startOfDay(startDate).toISOString();
    const end = endOfDay(endDate).toISOString();
    return { start, end };
  };

  const { data: attempts, isLoading: attemptsLoading, refetch: refetchAttempts } = useQuery({
    queryKey: ['distribution-attempts', startDate, endDate],
    queryFn: async () => {
      const { start, end } = getFilteredDateRange();
      
      const result = await withSupabaseRetry(async () => {
        return await supabase
          .from('distribution_attempts')
          .select(`
            *,
            leads!inner(nome, telefone, email),
            corretores!inner(
              profiles!inner(first_name, last_name)
            )
          `)
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false })
          .limit(50);
      });
      
      if (!result.success) {
        throw result.error;
      }
      
      return result.data || [];
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  const { data: queue, isLoading: queueLoading, refetch: refetchQueue } = useQuery({
    queryKey: ['distribution-queue', startDate, endDate],
    queryFn: async () => {
      const { start, end } = getFilteredDateRange();
      
      const result = await withSupabaseRetry(async () => {
        return await supabase
          .from('distribution_queue')
          .select(`
            *,
            leads!inner(nome, telefone, email, empreendimento_id)
          `)
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false })
          .limit(30);
      });
      
      if (!result.success) {
        throw result.error;
      }
      
      return result.data || [];
    },
    refetchInterval: 15000, // Atualiza a cada 15 segundos
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  const getStatusBadge = (status: string, responseType?: string | null) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'accepted':
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            Aceito
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Rejeitado
          </Badge>
        );
      case 'timeout':
        return (
          <Badge variant="secondary" className="text-orange-600">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Timeout
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getQueueStatusBadge = (status: string) => {
    const config = {
      pending: {
        variant: 'outline' as const,
        className: 'text-yellow-600 border-yellow-200',
        icon: Clock,
        label: 'Aguardando'
      },
      in_progress: {
        variant: 'default' as const,
        className: 'bg-blue-600 hover:bg-blue-700',
        icon: RefreshCw,
        label: 'Em Andamento'
      },
      completed: {
        variant: 'default' as const,
        className: 'bg-green-600 hover:bg-green-700',
        icon: CheckCircle,
        label: 'Concluído'
      },
      failed: {
        variant: 'destructive' as const,
        className: '',
        icon: XCircle,
        label: 'Falhou'
      }
    };

    const { variant, className, icon: Icon, label } = config[status as keyof typeof config] || config.pending;

    return (
      <Badge variant={variant} className={className}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const handleRefreshAll = () => {
    refetchAttempts();
    refetchQueue();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h2 className="text-2xl font-bold">Monitor de Distribuição de Leads</h2>
        
        {/* Filtros de Data */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div>
            <Label className="text-sm text-muted-foreground">De:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <Label className="text-sm text-muted-foreground">Até:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(endDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && setEndDate(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <Button 
            onClick={handleRefreshAll}
            variant="outline"
            className="self-end"
            disabled={attemptsLoading || queueLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", (attemptsLoading || queueLoading) && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Estatísticas Resumidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {attempts?.filter(a => a.status === 'pending').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Aguardando resposta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aceitos</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {attempts?.filter(a => a.status === 'accepted').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Leads confirmados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitados</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {attempts?.filter(a => a.status === 'rejected').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Leads recusados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Timeouts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {attempts?.filter(a => a.status === 'timeout').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Sem resposta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Abas Principais */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="queue">Fila</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="export">Relatórios</TabsTrigger>
          <TabsTrigger value="test">Testes</TabsTrigger>
        </TabsList>

        {/* Visão Geral - Métricas Avançadas */}
        <TabsContent value="overview" className="space-y-4">
          <AdvancedDistributionMetrics startDate={startDate} endDate={endDate} />
        </TabsContent>

        {/* Fila de Distribuição */}
        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fila de Distribuição</CardTitle>
              <p className="text-sm text-muted-foreground">
                Leads atualmente em processo de distribuição para corretores
              </p>
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <div className="text-center p-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Carregando fila...</p>
                </div>
              ) : queue && queue.length > 0 ? (
                <div className="space-y-4">
                  {queue.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium">{item.leads.nome}</p>
                        <p className="text-sm text-muted-foreground">{item.leads.telefone}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <p className="text-xs text-muted-foreground">
                            Tentativa {item.current_attempt}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Iniciado: {format(new Date(item.started_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </p>
                          {item.completed_at && (
                            <p className="text-xs text-muted-foreground">
                              Concluído: {format(new Date(item.completed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </p>
                          )}
                        </div>
                        {item.failure_reason && (
                          <p className="text-xs text-red-600 mt-1 font-medium">
                            Motivo da falha: {item.failure_reason}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {getQueueStatusBadge(item.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhum lead na fila</p>
                  <p className="text-sm">No período selecionado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Histórico de Tentativas */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Distribuição</CardTitle>
              <p className="text-sm text-muted-foreground">
                Histórico detalhado de todas as tentativas de distribuição no período
              </p>
            </CardHeader>
            <CardContent>
              {attemptsLoading ? (
                <div className="text-center p-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Carregando histórico...</p>
                </div>
              ) : attempts && attempts.length > 0 ? (
                <div className="space-y-4">
                  {attempts.map((attempt: any) => (
                    <div key={attempt.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{attempt.leads.nome}</p>
                            <p className="text-sm text-muted-foreground">{attempt.leads.telefone}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {attempt.corretores.profiles.first_name} {attempt.corretores.profiles.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Tentativa #{attempt.attempt_order}
                            </p>
                          </div>
                        </div>
                        
                        {attempt.response_message && (
                          <div className="mt-2 p-2 bg-muted rounded text-sm">
                            <strong>Resposta:</strong> {attempt.response_message}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Enviado: {format(new Date(attempt.message_sent_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                          {attempt.response_received_at && (
                            <span>Respondido: {format(new Date(attempt.response_received_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                          )}
                          <span>Expira: {format(new Date(attempt.timeout_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        {getStatusBadge(attempt.status, attempt.response_type)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhuma tentativa encontrada</p>
                  <p className="text-sm">No período selecionado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exportação de Relatórios */}
        <TabsContent value="export" className="space-y-4">
          <DistributionExporter />
        </TabsContent>

        {/* Testador de Distribuição */}
        <TabsContent value="test" className="space-y-4">
          <DistributionTester />
        </TabsContent>
      </Tabs>
    </div>
  );
};