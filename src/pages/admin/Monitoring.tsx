import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Type definitions para melhor type safety
interface RateLimit {
  key: string;
  count: number;
  expires_at: string;
  created_at: string;
}

interface RateLimitWithStatus extends RateLimit {
  time_remaining: number;
  status: 'ok' | 'warning' | 'blocked';
}

interface ApplicationLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  function_name: string;
  event: string;
  message: string | null;
  metadata: Record<string, any> | null;
  user_id: string | null;
  corretor_id: string | null;
  lead_id: string | null;
}

export default function Monitoring() {
  // Rate limits ativos - Query com type safety
  const { data: rateLimits } = useQuery<RateLimitWithStatus[]>({
    queryKey: ['active-rate-limits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_limits')
        .select('key, count, expires_at, created_at')
        .gt('expires_at', new Date().toISOString())
        .order('count', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      // Calcular status e tempo restante
      const rawData = data as unknown as RateLimit[];
      return (rawData || []).map((limit): RateLimitWithStatus => ({
        ...limit,
        time_remaining: new Date(limit.expires_at).getTime() - Date.now(),
        status: limit.count >= 10 ? 'blocked' : limit.count >= 7 ? 'warning' : 'ok'
      }));
    },
    refetchInterval: 5000
  });

  // Logs de erro recentes - Query com type safety
  const { data: recentErrors } = useQuery<ApplicationLog[]>({
    queryKey: ['recent-errors'],
    queryFn: async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('application_logs')
        .select('timestamp, level, function_name, event, message, metadata, user_id, corretor_id, lead_id')
        .in('level', ['error', 'critical'])
        .gte('timestamp', yesterday)
        .order('timestamp', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return (data || []) as unknown as ApplicationLog[];
    },
    refetchInterval: 10000
  });

  // Estatísticas de comunicação (últimas 24h)
  const { data: commStats } = useQuery({
    queryKey: ['communication-stats-24h'],
    queryFn: async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('communication_log')
        .select('status')
        .gte('created_at', yesterday);
      
      if (error) throw error;
      
      const total = data.length;
      const success = data.filter(d => d.status === 'sent' || d.status === 'delivered').length;
      const pending = data.filter(d => d.status === 'pending').length;
      const failed = data.filter(d => d.status === 'failed' || d.status === 'error').length;
      
      return {
        total,
        success,
        pending,
        failed,
        successRate: total > 0 ? ((success / total) * 100).toFixed(1) : '0.0'
      };
    },
    refetchInterval: 30000 // Atualiza a cada 30s
  });

  // Estatísticas de distribuição (últimas 24h)
  const { data: distStats } = useQuery({
    queryKey: ['distribution-stats-24h'],
    queryFn: async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('distribution_attempts')
        .select('response_type')
        .gte('created_at', yesterday);
      
      if (error) throw error;
      
      const total = data.length;
      const accepted = data.filter(d => d.response_type === 'accept').length;
      const rejected = data.filter(d => d.response_type === 'reject').length;
      const timeout = data.filter(d => d.response_type === 'timeout').length;
      
      return {
        total,
        accepted,
        rejected,
        timeout,
        acceptanceRate: total > 0 ? ((accepted / total) * 100).toFixed(1) : '0.0'
      };
    },
    refetchInterval: 30000
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: any; icon: any }> = {
      ok: { variant: 'default', icon: CheckCircle },
      warning: { variant: 'secondary', icon: AlertTriangle },
      blocked: { variant: 'destructive', icon: XCircle }
    };
    
    const { variant, icon: Icon } = config[status] || config.ok;
    
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getLevelBadge = (level: string) => {
    const variants: Record<string, any> = {
      error: 'destructive',
      critical: 'destructive',
      warn: 'secondary',
      info: 'default'
    };
    
    return (
      <Badge variant={variants[level] || 'default'}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoramento do Sistema</h1>
          <p className="text-muted-foreground">
            Acompanhe métricas, rate limits e logs do sistema em tempo real
          </p>
        </div>

        {/* Métricas Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>WhatsApp - Últimas 24h</CardDescription>
            <CardTitle className="text-3xl">{commStats?.successRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {commStats?.success}/{commStats?.total} enviadas
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Taxa de Aceitação</CardDescription>
            <CardTitle className="text-3xl">{distStats?.acceptanceRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {distStats?.accepted}/{distStats?.total} tentativas
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Mensagens Pendentes</CardDescription>
            <CardTitle className="text-3xl">{commStats?.pending || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Aguardando envio
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Erros (24h)</CardDescription>
            <CardTitle className="text-3xl text-destructive">
              {(commStats?.failed || 0) + (recentErrors?.length || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Requerem atenção
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rate Limits Ativos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Rate Limits Ativos
            </CardTitle>
            <CardDescription>
              Controle de limite de requisições em tempo real
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!rateLimits || rateLimits.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                Nenhum rate limit ativo no momento
              </div>
            ) : (
              <div className="space-y-3">
                {rateLimits.map((limit: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{limit.key}</div>
                      <div className="text-xs text-muted-foreground">
                        Expira {formatDistanceToNow(new Date(limit.expires_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold">{limit.count}</div>
                        <div className="text-xs text-muted-foreground">requisições</div>
                      </div>
                      {getStatusBadge(limit.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Erros Recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Erros Recentes
            </CardTitle>
            <CardDescription>
              Últimos erros e alertas críticos do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!recentErrors || recentErrors.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                Nenhum erro nas últimas 24 horas
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {recentErrors.map((error: any, idx: number) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {error.function_name}:{error.event}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(error.timestamp), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </div>
                      </div>
                      {getLevelBadge(error.level)}
                    </div>
                    {error.message && (
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {error.message}
                      </div>
                    )}
                    {error.metadata && Object.keys(error.metadata).length > 0 && (
                      <div className="text-xs bg-muted p-2 rounded">
                        <code className="text-xs">
                          {JSON.stringify(error.metadata, null, 2)}
                        </code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </DashboardLayout>
  );
}
