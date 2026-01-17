import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Activity, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
  Zap
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WebhookLog {
  id: string;
  event_type: string;
  instance_name: string;
  payload: any;
  processed_successfully: boolean;
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
}

export function WebhookMonitor() {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Query para buscar logs de webhook
  const { data: logs = [], refetch, isLoading } = useQuery({
    queryKey: ['webhook-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as WebhookLog[];
    },
    refetchInterval: autoRefresh ? 10000 : false // Auto-refresh a cada 10 segundos
  });

  // Query para estatísticas
  const { data: stats } = useQuery({
    queryKey: ['webhook-stats'],
    queryFn: async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('processed_successfully, processing_time_ms')
        .gte('created_at', twentyFourHoursAgo);
      
      if (error) throw error;
      
      const total = data.length;
      const successful = data.filter(log => log.processed_successfully).length;
      const failed = total - successful;
      const successRate = total > 0 ? ((successful / total) * 100).toFixed(1) : '0';
      
      const processingTimes = data
        .filter(log => log.processing_time_ms !== null)
        .map(log => log.processing_time_ms!);
      
      const avgProcessingTime = processingTimes.length > 0
        ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
        : 0;
      
      return {
        total,
        successful,
        failed,
        successRate,
        avgProcessingTime
      };
    },
    refetchInterval: autoRefresh ? 10000 : false
  });

  // Verificar se webhook está ativo (recebeu evento nas últimas 24h)
  const isWebhookActive = logs.length > 0 && 
    (Date.now() - new Date(logs[0].created_at).getTime()) < 24 * 60 * 60 * 1000;

  const getEventBadge = (eventType: string) => {
    const eventMap: Record<string, { label: string; variant: "default" | "secondary" | "success" }> = {
      'messages.upsert': { label: 'Mensagem Recebida', variant: 'default' },
      'MESSAGES_UPSERT': { label: 'Mensagem Recebida', variant: 'default' },
      'messages.update': { label: 'Status Atualizado', variant: 'secondary' },
      'MESSAGES_UPDATE': { label: 'Status Atualizado', variant: 'secondary' },
      'connection.update': { label: 'Conexão', variant: 'secondary' },
      'CONNECTION_UPDATE': { label: 'Conexão', variant: 'secondary' },
      'TEST_CONNECTION': { label: 'Teste', variant: 'success' }
    };

    const config = eventMap[eventType] || { label: eventType, variant: 'secondary' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total (24h)</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-2xl font-bold text-green-600">{stats?.successRate || 0}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold">{stats?.avgProcessingTime || 0}ms</p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-sm font-medium">
                  {isWebhookActive ? (
                    <span className="text-green-600">Ativo</span>
                  ) : (
                    <span className="text-muted-foreground">Inativo</span>
                  )}
                </p>
              </div>
              {isWebhookActive ? (
                <Zap className="w-8 h-8 text-green-600" />
              ) : (
                <XCircle className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Webhooks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Últimos Webhooks Recebidos</CardTitle>
              <CardDescription>
                Monitoramento em tempo real dos webhooks da Evolution API
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? 'Pausar' : 'Ativar'} Auto-Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Nenhum webhook recebido ainda. Configure o webhook na Evolution API para começar a receber eventos.
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-2">
                {logs.map((log) => (
                  <Card key={log.id} className="border">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        {/* Header do log */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {log.processed_successfully ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            {getEventBadge(log.event_type)}
                            {log.instance_name && (
                              <Badge variant="outline">{log.instance_name}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {log.processing_time_ms && (
                              <span>{log.processing_time_ms}ms</span>
                            )}
                            <span>
                              {formatDistanceToNow(new Date(log.created_at), {
                                addSuffix: true,
                                locale: ptBR
                              })}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                            >
                              {expandedLog === log.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Erro (se houver) */}
                        {log.error_message && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertDescription className="text-sm">
                              {log.error_message}
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Payload expandido */}
                        {expandedLog === log.id && (
                          <div className="mt-2 p-3 bg-muted rounded-lg">
                            <p className="text-xs font-mono text-muted-foreground mb-2">
                              Payload completo:
                            </p>
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
