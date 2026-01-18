import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Bot,
    MessageSquare,
    Users,
    TrendingUp,
    Clock,
    Zap,
    Calendar,
    CheckCircle
} from "lucide-react";

interface AIMetricsData {
    totalConversations: number;
    activeConversations: number;
    completedConversations: number;
    transferredConversations: number;
    totalMessages: number;
    totalTokensUsed: number;
    avgMessagesPerConversation: number;
    avgLeadScore: number;
    qualifiedLeads: number;
    scheduledVisits: number;
    conversionRate: number;
}

export function AIMetricsCard() {
    const { data: metrics, isLoading } = useQuery({
        queryKey: ["ai-metrics"],
        queryFn: async () => {
            // Get conversation stats
            const { data: conversations } = await supabase
                .from("agent_conversations")
                .select("id, status, total_messages, total_tokens_used, lead_score");

            // Get qualification stats
            const { data: qualifications } = await supabase
                .from("ai_lead_qualification")
                .select("id, is_qualified");

            // Get scheduled visits from AI
            const { data: aiVisits } = await supabase
                .from("visitas")
                .select("id")
                .eq("origem", "whatsapp_ai");

            const convs = conversations || [];
            const quals = qualifications || [];
            const visits = aiVisits || [];

            const totalConversations = convs.length;
            const activeConversations = convs.filter(c => c.status === "active").length;
            const completedConversations = convs.filter(c => c.status === "completed").length;
            const transferredConversations = convs.filter(c => c.status === "transferred").length;

            const totalMessages = convs.reduce((sum, c) => sum + (c.total_messages || 0), 0);
            const totalTokensUsed = convs.reduce((sum, c) => sum + (c.total_tokens_used || 0), 0);

            const avgMessagesPerConversation = totalConversations > 0
                ? Math.round(totalMessages / totalConversations)
                : 0;

            const avgLeadScore = totalConversations > 0
                ? Math.round(convs.reduce((sum, c) => sum + (c.lead_score || 0), 0) / totalConversations)
                : 0;

            const qualifiedLeads = quals.filter(q => q.is_qualified).length;
            const scheduledVisits = visits.length;

            const conversionRate = totalConversations > 0
                ? Math.round((scheduledVisits / totalConversations) * 100)
                : 0;

            return {
                totalConversations,
                activeConversations,
                completedConversations,
                transferredConversations,
                totalMessages,
                totalTokensUsed,
                avgMessagesPerConversation,
                avgLeadScore,
                qualifiedLeads,
                scheduledVisits,
                conversionRate
            } as AIMetricsData;
        },
        refetchInterval: 60000 // Refresh every minute
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        Métricas de IA
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    const formatTokens = (tokens: number) => {
        if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
        if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
        return tokens.toString();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        Agentes de IA
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                        Última hora
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Primary metrics row */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MessageSquare className="h-4 w-4" />
                            Conversas
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold">{metrics?.totalConversations || 0}</span>
                            <span className="text-xs text-green-500">
                                {metrics?.activeConversations || 0} ativas
                            </span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            Qualificados
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold">{metrics?.qualifiedLeads || 0}</span>
                            <span className="text-xs text-muted-foreground">leads</span>
                        </div>
                    </div>
                </div>

                {/* Secondary metrics */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                    <div className="text-center">
                        <div className="text-lg font-semibold text-green-500">
                            {metrics?.scheduledVisits || 0}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Visitas
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-semibold">
                            {metrics?.conversionRate || 0}%
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Conversão
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-semibold">
                            {metrics?.avgMessagesPerConversation || 0}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <Clock className="h-3 w-3" />
                            Msgs/Conv
                        </div>
                    </div>
                </div>

                {/* Token usage */}
                <div className="flex items-center justify-between pt-2 border-t text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Zap className="h-4 w-4" />
                        Tokens usados
                    </div>
                    <span className="font-medium">
                        {formatTokens(metrics?.totalTokensUsed || 0)}
                    </span>
                </div>

                {/* Status breakdown */}
                <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {metrics?.completedConversations || 0} completadas
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                        {metrics?.transferredConversations || 0} transferidas
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}
