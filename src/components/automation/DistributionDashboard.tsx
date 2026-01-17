import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock, CheckCircle, XCircle, Users, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function DistributionDashboard() {
  const [now, setNow] = useState(new Date());

  // Atualizar relógio a cada segundo
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Buscar tentativas ativas em tempo real
  const { data: activeAttempts, isLoading: loadingAttempts } = useQuery({
    queryKey: ['active-distribution-attempts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_distribution_attempts')
        .select(`
          *,
          corretor:corretor_id (
            id,
            profiles:profile_id (
              first_name,
              last_name
            )
          ),
          visita:visita_id (
            id,
            lead:lead_id (nome, telefone),
            empreendimento:empreendimento_id (nome)
          )
        `)
        .eq('status', 'pending')
        .gte('timeout_at', new Date().toISOString())
        .order('timeout_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000 // Atualizar a cada 5 segundos
  });

  // Buscar estatísticas das últimas 24h
  const { data: stats } = useQuery({
    queryKey: ['distribution-stats-24h'],
    queryFn: async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: attempts, error } = await supabase
        .from('visit_distribution_attempts')
        .select('*')
        .gte('created_at', yesterday);

      if (error) throw error;

      const total = attempts.length;
      const accepted = attempts.filter(a => a.response_type === 'accept').length;
      const rejected = attempts.filter(a => a.response_type === 'reject').length;
      const expired = attempts.filter(a => a.status === 'expired').length;

      // Calcular tempo médio de resposta
      const acceptedWithTime = attempts.filter(a => 
        a.response_type === 'accept' && a.response_received_at
      );

      let avgResponseTime = 0;
      if (acceptedWithTime.length > 0) {
        const totalMinutes = acceptedWithTime.reduce((sum, attempt) => {
          const sentAt = new Date(attempt.message_sent_at).getTime();
          const receivedAt = new Date(attempt.response_received_at).getTime();
          return sum + ((receivedAt - sentAt) / (1000 * 60));
        }, 0);
        avgResponseTime = totalMinutes / acceptedWithTime.length;
      }

      const successRate = total > 0 ? (accepted / total) * 100 : 0;

      return {
        total,
        accepted,
        rejected,
        expired,
        successRate,
        avgResponseTime
      };
    },
    refetchInterval: 30000 // Atualizar a cada 30 segundos
  });

  // Calcular tempo restante para cada tentativa
  const getTimeRemaining = (timeoutAt: string) => {
    const remaining = new Date(timeoutAt).getTime() - now.getTime();
    if (remaining <= 0) return 'Expirado';
    
    const minutes = Math.floor(remaining / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (timeoutAt: string, sentAt: string) => {
    const total = new Date(timeoutAt).getTime() - new Date(sentAt).getTime();
    const elapsed = now.getTime() - new Date(sentAt).getTime();
    return Math.min(100, (elapsed / total) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? `${stats.successRate.toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">Últimas 24 horas</p>
            <Progress 
              value={stats?.successRate || 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? `${stats.avgResponseTime.toFixed(1)} min` : '0 min'}
            </div>
            <p className="text-xs text-muted-foreground">Resposta dos corretores</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aceitas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.accepted || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats ? `${((stats.accepted / stats.total) * 100).toFixed(0)}% do total` : '0% do total'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recusadas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.rejected || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats ? `${((stats.rejected / stats.total) * 100).toFixed(0)}% do total` : '0% do total'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tentativas Ativas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Distribuições Ativas
          </CardTitle>
          <CardDescription>
            Visitas aguardando resposta dos corretores
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAttempts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activeAttempts && activeAttempts.length > 0 ? (
            <div className="space-y-4">
              {activeAttempts.map((attempt) => {
                const timeRemaining = getTimeRemaining(attempt.timeout_at);
                const progress = getProgressPercentage(attempt.timeout_at, attempt.message_sent_at);
                const isExpiringSoon = progress > 80;

                return (
                  <div key={attempt.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">
                            {attempt.corretor?.profiles?.first_name} {attempt.corretor?.profiles?.last_name}
                          </h4>
                          <Badge variant="secondary">
                            Tentativa {attempt.attempt_order}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Lead: {attempt.visita?.lead?.nome}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {attempt.visita?.empreendimento?.nome}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-mono font-bold ${isExpiringSoon ? 'text-red-600' : 'text-green-600'}`}>
                          {timeRemaining}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(attempt.message_sent_at), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </p>
                      </div>
                    </div>
                    <Progress 
                      value={progress} 
                      className="h-2"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma distribuição ativa no momento</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico Recente */}
      <RecentHistory />
    </div>
  );
}

function RecentHistory() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['distribution-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_distribution_attempts')
        .select(`
          *,
          corretor:corretor_id (
            id,
            profiles:profile_id (first_name, last_name)
          ),
          visita:visita_id (
            id,
            lead:lead_id (nome),
            empreendimento:empreendimento_id (nome)
          )
        `)
        .neq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Histórico Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhum histórico disponível</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {item.corretor?.profiles?.first_name} {item.corretor?.profiles?.last_name}
                    </span>
                    <Badge variant={
                      item.response_type === 'accepted' ? 'default' : 
                      item.response_type === 'rejected' ? 'destructive' : 'secondary'
                    }>
                      {item.response_type === 'accepted' ? 'Aceitou' :
                       item.response_type === 'rejected' ? 'Recusou' : 
                       item.status === 'timeout' ? 'Expirou' : item.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Lead: {item.visita?.lead?.nome} • {item.visita?.empreendimento?.nome}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
