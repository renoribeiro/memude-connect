import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { 
  RefreshCw, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  TrendingUp,
  Database,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WordPressSettings } from "@/components/wordpress/WordPressSettings";
import { SyncStatusIndicator } from "@/components/wordpress/SyncStatusIndicator";

interface SyncLog {
  id: string;
  sync_date: string;
  total_posts_fetched: number;
  new_empreendimentos: number;
  updated_empreendimentos: number;
  errors_count: number;
  sync_duration_ms: number;
  last_wp_post_id: number;
  status: 'success' | 'partial' | 'error';
  error_details?: { errors: string[] };
  created_at: string;
}

interface PerformanceMetric {
  id: string;
  operation_type: string;
  duration_ms: number;
  success: boolean;
  error_message?: string;
  created_at: string;
}

export default function SincronizacaoWordpress() {
  const { isAdmin } = useAuth();
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const { toast } = useToast();

  // Redirect non-admin users
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Acesso negado. Apenas administradores podem acessar esta página.</p>
        </div>
      </DashboardLayout>
    );
  }

  useEffect(() => {
    loadSyncData();
  }, []);

  const loadSyncData = async () => {
    try {
      setIsLoading(true);
      
      // Load sync logs
      const { data: logs, error: logsError } = await supabase
        .from('wp_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (logsError) throw logsError;
      setSyncLogs((logs || []) as SyncLog[]);

      // Load recent performance metrics
      const { data: metrics, error: metricsError } = await supabase
        .from('wp_sync_performance')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (metricsError) throw metricsError;
      setPerformanceMetrics(metrics || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados de sincronização",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const executeSyncNow = async () => {
    try {
      setIsSyncing(true);
      
      toast({
        title: "Sincronização iniciada",
        description: "Buscando dados do WordPress...",
      });
      
      const { data, error } = await supabase.functions.invoke('sync-wordpress-properties', {
        body: { 
          manual: true,
          test_mode: false 
        }
      });

      if (error) throw error;

      toast({
        title: "Sincronização concluída",
        description: `Processados: ${data?.totalPostsFetched || 0} posts, Novos: ${data?.newEmpreendimentos || 0}, Atualizados: ${data?.updatedEmpreendimentos || 0}`,
      });

      // Reload data after sync with proper delay
      setTimeout(() => {
        loadSyncData();
      }, 1500);

    } catch (error) {
      console.error('Erro na sincronização:', error);
      toast({
        title: "Erro na sincronização",
        description: error.message || "Erro desconhecido ao executar sincronização",
        variant: "destructive"
      });
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
      }, 3000);
    }
  };

  const executeTestSync = async () => {
    try {
      setIsSyncing(true);
      
      toast({
        title: "Teste de sincronização iniciado",
        description: "Verificando conexão com WordPress...",
      });
      
      const { data, error } = await supabase.functions.invoke('sync-wordpress-properties', {
        body: { 
          manual: true,
          test_mode: true,
          limit: 5 
        }
      });

      if (error) throw error;

      toast({
        title: "Teste concluído",
        description: `Conexão OK. Encontrados ${data?.totalPostsFetched || 0} posts de teste.`,
      });

    } catch (error) {
      console.error('Erro no teste:', error);
      toast({
        title: "Erro no teste",
        description: error.message || "Falha na conexão com WordPress",
        variant: "destructive"
      });
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
      }, 2000);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: { variant: "default" as const, icon: CheckCircle, text: "Sucesso" },
      partial: { variant: "secondary" as const, icon: AlertCircle, text: "Parcial" },
      error: { variant: "destructive" as const, icon: AlertCircle, text: "Erro" }
    };

    const config = variants[status as keyof typeof variants];
    if (!config) return null;

    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const getPerformanceStats = () => {
    if (performanceMetrics.length === 0) return null;

    const avgDuration = performanceMetrics
      .filter(m => m.duration_ms)
      .reduce((acc, m) => acc + m.duration_ms, 0) / performanceMetrics.length;

    const successRate = (performanceMetrics.filter(m => m.success).length / performanceMetrics.length) * 100;

    const operationTypes = performanceMetrics.reduce((acc, m) => {
      acc[m.operation_type] = (acc[m.operation_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      avgDuration,
      successRate,
      operationTypes
    };
  };

  const stats = getPerformanceStats();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sincronização WordPress</h1>
          <p className="text-muted-foreground">
            Monitore e gerencie a sincronização com memude.com.br
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={loadSyncData}
            disabled={isLoading || isSyncing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Button 
            variant="secondary"
            onClick={executeTestSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Testar Conexão
              </>
            )}
          </Button>
          
          <Button 
            onClick={executeSyncNow}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Sincronização Completa
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Real-time Status Indicator */}
      <SyncStatusIndicator />

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status do Sistema</CardTitle>
            <CheckCircle className={`h-4 w-4 ${syncLogs.length > 0 ? 'text-green-500' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncLogs.length > 0 ? 'Ativo' : 'Aguardando'}
            </div>
            <p className="text-xs text-muted-foreground">
              {syncLogs.length > 0 ? 'Sistema funcionando' : 'Primeira sincronização pendente'}
            </p>
          </CardContent>
        </Card>

        {stats && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</div>
                <p className="text-xs text-muted-foreground">
                  Por operação
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  {performanceMetrics.filter(m => m.success).length} de {performanceMetrics.length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sincronizações</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{syncLogs.length}</div>
                <p className="text-xs text-muted-foreground">
                  Total executadas
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {!stats && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Próxima Sincronização</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">00:00</div>
                <p className="text-xs text-muted-foreground">
                  Diariamente (automática)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Site WordPress</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-bold">memude.com.br</div>
                <p className="text-xs text-muted-foreground">
                  Fonte dos dados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ação</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-bold">Execute o primeiro teste</div>
                <p className="text-xs text-muted-foreground">
                  Para verificar a conexão
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

        {/* Tabs */}
        <Tabs defaultValue="logs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="logs">Logs de Sincronização</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

        {/* Sync Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Sincronizações</CardTitle>
              <CardDescription>
                Últimas 20 sincronizações executadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {syncLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma sincronização encontrada
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Posts</TableHead>
                      <TableHead>Novos</TableHead>
                      <TableHead>Atualizados</TableHead>
                      <TableHead>Erros</TableHead>
                      <TableHead>Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogs.map((log) => (
                      <TableRow 
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedLogId(selectedLogId === log.id ? null : log.id)}
                      >
                        <TableCell>
                          {format(new Date(log.sync_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>{log.total_posts_fetched}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-green-600">
                            +{log.new_empreendimentos}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-blue-600">
                            ~{log.updated_empreendimentos}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.errors_count > 0 && (
                            <Badge variant="destructive">
                              {log.errors_count}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDuration(log.sync_duration_ms)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Error Details */}
          {selectedLogId && (
            <Card>
              <CardHeader>
                <CardTitle>Detalhes da Sincronização</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const selectedLog = syncLogs.find(log => log.id === selectedLogId);
                  if (!selectedLog) return null;

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">ID:</span> {selectedLog.id}
                        </div>
                        <div>
                          <span className="font-medium">Último Post ID:</span> {selectedLog.last_wp_post_id}
                        </div>
                      </div>

                      {selectedLog.error_details?.errors && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="space-y-2">
                              <p className="font-medium">Erros encontrados:</p>
                              <ul className="list-disc pl-4 space-y-1">
                                {selectedLog.error_details.errors.map((error, index) => (
                                  <li key={index} className="text-sm">{error}</li>
                                ))}
                              </ul>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Métricas de Performance</CardTitle>
              <CardDescription>
                Análise detalhada das operações de sincronização
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats && (
                <div className="space-y-6">
                  {/* Operation Types Chart */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Tipos de Operação</h4>
                    <div className="space-y-2">
                      {Object.entries(stats.operationTypes).map(([type, count]) => {
                        const percentage = (count / performanceMetrics.length) * 100;
                        return (
                          <div key={type} className="flex items-center gap-2">
                            <div className="w-24 text-sm capitalize">
                              {type.replace('_', ' ')}
                            </div>
                            <Progress value={percentage} className="flex-1" />
                            <div className="w-12 text-sm text-right">{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent Operations */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Operações Recentes</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Duração</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {performanceMetrics.slice(0, 10).map((metric) => (
                          <TableRow key={metric.id}>
                            <TableCell className="capitalize">
                              {metric.operation_type.replace('_', ' ')}
                            </TableCell>
                            <TableCell>{formatDuration(metric.duration_ms)}</TableCell>
                            <TableCell>
                              {metric.success ? (
                                <Badge variant="default">Sucesso</Badge>
                              ) : (
                                <Badge variant="destructive">Erro</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {format(new Date(metric.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <WordPressSettings />
        </TabsContent>
      </Tabs>
      </div>
    </DashboardLayout>
  );
}