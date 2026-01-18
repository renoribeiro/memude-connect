import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
    TrendingUp,
    TrendingDown,
    MessageSquare,
    Users,
    Target,
    Calendar,
    Flame,
    Thermometer,
    Snowflake,
    Activity,
    Zap,
    BarChart3
} from "lucide-react";

interface AgentAnalyticsDashboardProps {
    agentId?: string;
}

interface DashboardStat {
    metric_name: string;
    current_value: number;
    previous_value: number;
    change_percentage: number;
}

interface FunnelEvent {
    event_type: string;
    count: number;
    percentage: number;
    avg_time_to_event_hours: number;
}

interface TemperatureStat {
    temperature: string;
    count: number;
    percentage: number;
}

export function AgentAnalyticsDashboard({ agentId }: AgentAnalyticsDashboardProps) {
    const [dateRange, setDateRange] = useState("7");

    // Fetch dashboard stats
    const { data: dashboardStats, isLoading: statsLoading } = useQuery({
        queryKey: ["agent-dashboard-stats", agentId, dateRange],
        queryFn: async () => {
            const { data, error } = await supabase.rpc("get_agent_dashboard_stats", {
                p_agent_id: agentId || null,
                p_days: parseInt(dateRange)
            });
            if (error) throw error;
            return data as DashboardStat[];
        }
    });

    // Fetch conversion funnel
    const { data: funnelData, isLoading: funnelLoading } = useQuery({
        queryKey: ["conversion-funnel", agentId, dateRange],
        queryFn: async () => {
            const { data, error } = await supabase.rpc("get_conversion_funnel", {
                p_agent_id: agentId || null,
                p_days: parseInt(dateRange)
            });
            if (error) throw error;
            return data as FunnelEvent[];
        }
    });

    // Fetch temperature distribution
    const { data: temperatureStats, isLoading: tempLoading } = useQuery({
        queryKey: ["temperature-stats", agentId, dateRange],
        queryFn: async () => {
            const { data, error } = await supabase.rpc("get_lead_temperature_stats", {
                p_agent_id: agentId || null,
                p_days: parseInt(dateRange)
            });
            if (error) throw error;
            return data as TemperatureStat[];
        }
    });

    // Fetch recent activity
    const { data: recentActivity } = useQuery({
        queryKey: ["recent-activity", agentId],
        queryFn: async () => {
            let query = supabase
                .from("agent_activity_log")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(10);

            if (agentId) {
                query = query.eq("agent_id", agentId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        }
    });

    const getStatIcon = (name: string) => {
        const icons: Record<string, React.ReactNode> = {
            "Conversas": <MessageSquare className="h-4 w-4" />,
            "Leads Qualificados": <Users className="h-4 w-4" />,
            "Leads Hot/Warm": <Flame className="h-4 w-4" />,
            "Visitas Agendadas": <Calendar className="h-4 w-4" />,
            "BANT Score Médio": <Target className="h-4 w-4" />
        };
        return icons[name] || <BarChart3 className="h-4 w-4" />;
    };

    const getTemperatureConfig = (temp: string) => {
        const configs: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
            hot: { icon: <Flame className="h-4 w-4" />, color: "text-red-500", bg: "bg-red-500" },
            warm: { icon: <Thermometer className="h-4 w-4" />, color: "text-orange-500", bg: "bg-orange-500" },
            cool: { icon: <Snowflake className="h-4 w-4" />, color: "text-blue-400", bg: "bg-blue-400" },
            cold: { icon: <Snowflake className="h-4 w-4" />, color: "text-gray-400", bg: "bg-gray-400" }
        };
        return configs[temp] || configs.cold;
    };

    const getFunnelEventLabel = (eventType: string) => {
        const labels: Record<string, string> = {
            conversation_started: "Conversa Iniciada",
            first_response: "Primeira Resposta",
            qualification_started: "Qualificação Iniciada",
            property_searched: "Busca de Imóveis",
            property_presented: "Imóveis Apresentados",
            interest_shown: "Interesse Demonstrado",
            visit_requested: "Visita Solicitada",
            visit_scheduled: "Visita Agendada",
            converted: "Convertido",
            lost: "Perdido"
        };
        return labels[eventType] || eventType;
    };

    const getActivityIcon = (type: string) => {
        const icons: Record<string, React.ReactNode> = {
            message_received: <MessageSquare className="h-3 w-3 text-blue-500" />,
            message_sent: <MessageSquare className="h-3 w-3 text-green-500" />,
            intent_detected: <Target className="h-3 w-3 text-purple-500" />,
            objection_detected: <Zap className="h-3 w-3 text-orange-500" />,
            action_executed: <Activity className="h-3 w-3 text-blue-600" />,
            handoff_triggered: <Users className="h-3 w-3 text-red-500" />,
            error_occurred: <Zap className="h-3 w-3 text-red-600" />
        };
        return icons[type] || <Activity className="h-3 w-3" />;
    };

    if (statsLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with date range selector */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
                    <p className="text-muted-foreground">Métricas de performance do agente IA</p>
                </div>
                <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">Últimos 7 dias</SelectItem>
                        <SelectItem value="14">Últimos 14 dias</SelectItem>
                        <SelectItem value="30">Últimos 30 dias</SelectItem>
                        <SelectItem value="90">Últimos 90 dias</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {dashboardStats?.map((stat) => (
                    <Card key={stat.metric_name}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {stat.metric_name}
                            </CardTitle>
                            {getStatIcon(stat.metric_name)}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {stat.current_value?.toLocaleString("pt-BR") || "0"}
                            </div>
                            <div className="flex items-center text-xs text-muted-foreground">
                                {stat.change_percentage > 0 ? (
                                    <>
                                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                                        <span className="text-green-500">+{stat.change_percentage}%</span>
                                    </>
                                ) : stat.change_percentage < 0 ? (
                                    <>
                                        <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                                        <span className="text-red-500">{stat.change_percentage}%</span>
                                    </>
                                ) : (
                                    <span>Sem alteração</span>
                                )}
                                <span className="ml-1">vs período anterior</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Tabs defaultValue="funnel" className="w-full">
                <TabsList>
                    <TabsTrigger value="funnel">Funil de Conversão</TabsTrigger>
                    <TabsTrigger value="temperature">Temperatura de Leads</TabsTrigger>
                    <TabsTrigger value="activity">Atividade Recente</TabsTrigger>
                </TabsList>

                {/* Conversion Funnel */}
                <TabsContent value="funnel">
                    <Card>
                        <CardHeader>
                            <CardTitle>Funil de Conversão</CardTitle>
                            <CardDescription>
                                Progressão dos leads através do funil de vendas
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {funnelLoading ? (
                                <div className="animate-pulse space-y-2">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="h-10 bg-muted rounded" />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {funnelData?.map((event, index) => (
                                        <div key={event.event_type} className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium">
                                                    {getFunnelEventLabel(event.event_type)}
                                                </span>
                                                <div className="flex items-center gap-4">
                                                    <Badge variant="outline">
                                                        {event.count} leads
                                                    </Badge>
                                                    <span className="text-muted-foreground w-16 text-right">
                                                        {event.percentage}%
                                                    </span>
                                                </div>
                                            </div>
                                            <Progress
                                                value={event.percentage}
                                                className="h-2"
                                                style={{
                                                    opacity: 1 - (index * 0.1)
                                                }}
                                            />
                                            {event.avg_time_to_event_hours > 0 && (
                                                <p className="text-xs text-muted-foreground">
                                                    Tempo médio: {event.avg_time_to_event_hours.toFixed(1)}h
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Temperature Distribution */}
                <TabsContent value="temperature">
                    <Card>
                        <CardHeader>
                            <CardTitle>Distribuição por Temperatura</CardTitle>
                            <CardDescription>
                                Classificação dos leads por nível de engajamento
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {tempLoading ? (
                                <div className="animate-pulse space-y-2">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="h-16 bg-muted rounded" />
                                    ))}
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-4">
                                    {(["hot", "warm", "cool", "cold"] as const).map((temp) => {
                                        const stat = temperatureStats?.find(t => t.temperature === temp);
                                        const config = getTemperatureConfig(temp);
                                        return (
                                            <Card key={temp} className="border-l-4" style={{ borderLeftColor: `var(--${config.bg.replace('bg-', '')})` }}>
                                                <CardContent className="pt-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className={config.color}>
                                                            {config.icon}
                                                        </div>
                                                        <span className="font-medium capitalize">{temp}</span>
                                                    </div>
                                                    <div className="text-3xl font-bold mt-2">
                                                        {stat?.count || 0}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {stat?.percentage || 0}% do total
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Recent Activity */}
                <TabsContent value="activity">
                    <Card>
                        <CardHeader>
                            <CardTitle>Atividade Recente</CardTitle>
                            <CardDescription>
                                Últimas ações do agente em tempo real
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {recentActivity?.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-8">
                                        Nenhuma atividade recente
                                    </p>
                                ) : (
                                    recentActivity?.map((activity: any) => (
                                        <div
                                            key={activity.id}
                                            className="flex items-center justify-between py-2 border-b last:border-0"
                                        >
                                            <div className="flex items-center gap-3">
                                                {getActivityIcon(activity.activity_type)}
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        {activity.activity_type.replace(/_/g, " ")}
                                                    </p>
                                                    {activity.activity_data?.message && (
                                                        <p className="text-xs text-muted-foreground truncate max-w-md">
                                                            {activity.activity_data.message}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(activity.created_at).toLocaleTimeString("pt-BR", {
                                                    hour: "2-digit",
                                                    minute: "2-digit"
                                                })}
                                                {activity.duration_ms && (
                                                    <span className="ml-2">
                                                        ({activity.duration_ms}ms)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
