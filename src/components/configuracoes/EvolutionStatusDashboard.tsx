
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Activity, Server, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface EvolutionStatusDashboardProps {
    instanceId: string;
}

export function EvolutionStatusDashboard({ instanceId }: EvolutionStatusDashboardProps) {

    // 1. Fetch Instance Details (Status, Last Check)
    const { data: instance, isLoading: isLoadingInstance } = useQuery({
        queryKey: ['evolution-instance-details', instanceId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('evolution_instances')
                .select('*')
                .eq('id', instanceId)
                .single();
            if (error) throw error;
            return data;
        },
        refetchInterval: 10000 // Refresh every 10s
    });

    // 2. Fetch Recent Logs (Health Checks & Errors)
    const { data: logs, isLoading: isLoadingLogs } = useQuery({
        queryKey: ['evolution-instance-logs', instanceId],
        queryFn: async () => {
            // Fetch last 20 logs for this instance
            const { data, error } = await supabase
                .from('integration_logs')
                .select('*')
                .eq('metadata->>instance_name', instance?.instance_name) // Filter by instance name in metadata
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            return data;
        },
        enabled: !!instance?.instance_name,
        refetchInterval: 10000
    });

    if (isLoadingInstance) {
        return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    if (!instance) {
        return <div className="p-4 text-red-500">Instância não encontrada.</div>;
    }

    const statusColor = instance.connection_status === 'open' ? 'text-green-500' :
        instance.connection_status === 'close' ? 'text-red-500' :
            instance.connection_status === 'connecting' ? 'text-yellow-500' : 'text-gray-500';

    const StatusIcon = instance.connection_status === 'open' ? CheckCircle :
        instance.connection_status === 'close' ? XCircle :
            instance.connection_status === 'connecting' ? Loader2 : AlertTriangle;

    return (
        <div className="space-y-6">
            {/* Header / Summary */}
            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Status da Conexão</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <StatusIcon className={`w-6 h-6 ${statusColor} ${instance.connection_status === 'connecting' ? 'animate-spin' : ''}`} />
                            <span className="text-2xl font-bold capitalize">{instance.connection_status || 'Desconhecido'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {instance.instance_name}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Última Verificação</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Clock className="w-6 h-6 text-blue-500" />
                            <span className="text-xl font-bold">
                                {instance.last_health_check ? format(new Date(instance.last_health_check), 'HH:mm:ss', { locale: ptBR }) : '-'}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {instance.last_health_check ? format(new Date(instance.last_health_check), "d 'de' MMMM", { locale: ptBR }) : 'Nunca verificado'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Logs List */}
            <Card className="flex-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Activity className="w-5 h-5" />
                        Logs Recentes
                    </CardTitle>
                    <CardDescription>
                        Histórico de interações e verificações de saúde via Evolution API.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                        {isLoadingLogs ? (
                            <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
                        ) : logs?.length === 0 ? (
                            <div className="text-center text-sm text-muted-foreground p-4">Nenhum log registrado recentemente.</div>
                        ) : (
                            <div className="space-y-4">
                                {logs?.map((log) => (
                                    <div key={log.id} className="text-sm">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={log.status_code >= 200 && log.status_code < 300 ? 'outline' : 'destructive'} className="text-xs">
                                                    {log.status_code}
                                                </Badge>
                                                <span className="font-semibold">{log.method} {log.endpoint}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(log.created_at), 'HH:mm:ss', { locale: ptBR })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Duração: {log.duration_ms}ms</span>
                                            <span>{log.service}</span>
                                        </div>
                                        {log.response_body?.error && (
                                            <div className="mt-1 text-xs text-red-500 bg-red-50 p-1 rounded">
                                                Erro: {JSON.stringify(log.response_body.error)}
                                            </div>
                                        )}
                                        <Separator className="my-2" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
