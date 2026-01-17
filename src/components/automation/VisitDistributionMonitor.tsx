import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, CheckCircle2, XCircle, AlertCircle, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VisitDistributionAttempt {
  id: string;
  visita_id: string;
  corretor_id: string;
  attempt_order: number;
  message_sent_at: string;
  timeout_at: string;
  response_received_at: string | null;
  status: string;
  response_message: string | null;
  response_type: string | null;
  corretores: {
    profiles: {
      first_name: string;
      last_name: string;
    };
  };
  visitas: {
    data_visita: string;
    horario_visita: string;
    leads: {
      nome: string;
    };
  };
}

export function VisitDistributionMonitor() {
  const { data: activeDistributions, isLoading } = useQuery({
    queryKey: ['active-visit-distributions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_distribution_queue')
        .select(`
          id,
          visita_id,
          status,
          current_attempt,
          started_at,
          assigned_corretor_id,
          visitas (
            data_visita,
            horario_visita,
            leads (nome)
          )
        `)
        .in('status', ['pending', 'in_progress'])
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });

  const { data: recentAttempts } = useQuery({
    queryKey: ['recent-visit-attempts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_distribution_attempts')
        .select(`
          id,
          visita_id,
          corretor_id,
          attempt_order,
          message_sent_at,
          timeout_at,
          response_received_at,
          status,
          response_message,
          response_type,
          corretores (
            profiles (
              first_name,
              last_name
            )
          ),
          visitas (
            data_visita,
            horario_visita,
            leads (nome)
          )
        `)
        .order('message_sent_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as unknown as VisitDistributionAttempt[];
    },
    refetchInterval: 5000,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      accepted: { variant: "default", icon: CheckCircle2 },
      rejected: { variant: "secondary", icon: XCircle },
      timeout: { variant: "destructive", icon: AlertCircle },
      error: { variant: "destructive", icon: XCircle },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status === 'pending' ? 'Aguardando' : 
         status === 'accepted' ? 'Aceito' :
         status === 'rejected' ? 'Recusado' :
         status === 'timeout' ? 'Expirado' : 'Erro'}
      </Badge>
    );
  };

  const getQueueStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      in_progress: "default",
      completed: "secondary",
      failed: "destructive",
      cancelled: "secondary",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status === 'pending' ? 'Pendente' :
         status === 'in_progress' ? 'Em Andamento' :
         status === 'completed' ? 'Concluída' :
         status === 'failed' ? 'Falhou' : 'Cancelada'}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monitor de Distribuição de Visitas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Distribuições Ativas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Distribuições Ativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!activeDistributions || activeDistributions.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma distribuição ativa no momento</p>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {activeDistributions.map((dist: any) => (
                  <div key={dist.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium">{dist.visitas?.leads?.nome || 'Lead sem nome'}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(dist.visitas?.data_visita || new Date()), 'dd/MM/yyyy', { locale: ptBR })}
                        {' às '}
                        {dist.visitas?.horario_visita}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Tentativa {dist.current_attempt}
                      </p>
                    </div>
                    <div className="text-right">
                      {getQueueStatusBadge(dist.status)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Tentativas Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Tentativas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!recentAttempts || recentAttempts.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma tentativa registrada</p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {recentAttempts.map((attempt) => (
                  <div key={attempt.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">
                          {attempt.corretores?.profiles?.first_name} {attempt.corretores?.profiles?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Lead: {attempt.visitas?.leads?.nome || 'Sem nome'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(attempt.visitas?.data_visita || new Date()), 'dd/MM/yyyy', { locale: ptBR })}
                          {' às '}
                          {attempt.visitas?.horario_visita}
                        </div>
                      </div>
                      {getStatusBadge(attempt.status)}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Tentativa #{attempt.attempt_order}</span>
                      <span>
                        Enviado: {format(new Date(attempt.message_sent_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </span>
                      {attempt.response_received_at && (
                        <span>
                          Resposta: {format(new Date(attempt.response_received_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                      )}
                    </div>

                    {attempt.response_message && (
                      <p className="text-sm p-2 bg-muted rounded">
                        "{attempt.response_message}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
