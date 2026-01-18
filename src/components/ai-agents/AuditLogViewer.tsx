import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    FileText,
    Search,
    Filter,
    Download,
    AlertCircle,
    MessageSquare,
    User,
    Settings,
    Shield,
    RefreshCw
} from "lucide-react";

interface AuditLogViewerProps {
    agentId?: string;
}

interface AuditLogEntry {
    id: string;
    user_id: string | null;
    agent_id: string | null;
    conversation_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    previous_value: Record<string, any> | null;
    new_value: Record<string, any> | null;
    metadata: Record<string, any>;
    created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    conversation_started: { label: "Conversa Iniciada", color: "bg-green-500" },
    conversation_ended: { label: "Conversa Encerrada", color: "bg-gray-500" },
    message_sent: { label: "Mensagem Enviada", color: "bg-blue-500" },
    message_received: { label: "Mensagem Recebida", color: "bg-blue-400" },
    lead_qualified: { label: "Lead Qualificado", color: "bg-purple-500" },
    lead_transferred: { label: "Lead Transferido", color: "bg-orange-500" },
    visit_scheduled: { label: "Visita Agendada", color: "bg-green-600" },
    property_searched: { label: "Busca de Imóveis", color: "bg-indigo-500" },
    agent_config_changed: { label: "Config Alterada", color: "bg-yellow-500" },
    prompt_modified: { label: "Prompt Modificado", color: "bg-yellow-600" },
    error_occurred: { label: "Erro Ocorrido", color: "bg-red-500" },
    rate_limited: { label: "Rate Limited", color: "bg-red-400" },
    api_called: { label: "API Chamada", color: "bg-gray-400" }
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
    conversation: <MessageSquare className="h-4 w-4" />,
    lead: <User className="h-4 w-4" />,
    agent: <Settings className="h-4 w-4" />,
    message: <MessageSquare className="h-4 w-4" />,
    system: <Shield className="h-4 w-4" />,
    config: <Settings className="h-4 w-4" />
};

export function AuditLogViewer({ agentId }: AuditLogViewerProps) {
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState<string>("all");
    const [entityFilter, setEntityFilter] = useState<string>("all");
    const [limit, setLimit] = useState(50);

    // Fetch audit logs
    const { data: logs, isLoading, refetch } = useQuery({
        queryKey: ["audit-logs", agentId, actionFilter, entityFilter, limit],
        queryFn: async () => {
            let query = supabase
                .from("audit_logs")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(limit);

            if (agentId) {
                query = query.eq("agent_id", agentId);
            }
            if (actionFilter && actionFilter !== "all") {
                query = query.eq("action", actionFilter);
            }
            if (entityFilter && entityFilter !== "all") {
                query = query.eq("entity_type", entityFilter);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as AuditLogEntry[];
        }
    });

    const filteredLogs = logs?.filter(log => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
            log.action?.toLowerCase().includes(searchLower) ||
            log.entity_type?.toLowerCase().includes(searchLower) ||
            log.entity_id?.toLowerCase().includes(searchLower) ||
            JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
        );
    });

    const getActionBadge = (action: string) => {
        const config = ACTION_LABELS[action] || { label: action, color: "bg-gray-400" };
        return (
            <Badge className={`${config.color} text-white text-xs`}>
                {config.label}
            </Badge>
        );
    };

    const exportLogs = () => {
        if (!filteredLogs) return;

        const csv = [
            ["Timestamp", "Action", "Entity Type", "Entity ID", "Metadata"].join(","),
            ...filteredLogs.map(log => [
                new Date(log.created_at).toISOString(),
                log.action,
                log.entity_type,
                log.entity_id || "",
                JSON.stringify(log.metadata).replace(/,/g, ";")
            ].join(","))
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="h-6 w-6" />
                        Audit Logs
                    </h2>
                    <p className="text-muted-foreground">
                        Histórico de ações para compliance e segurança
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Atualizar
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportLogs}>
                        <Download className="h-4 w-4 mr-1" />
                        Exportar
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex gap-4 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar nos logs..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Ação" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as Ações</SelectItem>
                                {Object.entries(ACTION_LABELS).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>
                                        {config.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={entityFilter} onValueChange={setEntityFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Entidade" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as Entidades</SelectItem>
                                <SelectItem value="conversation">Conversas</SelectItem>
                                <SelectItem value="lead">Leads</SelectItem>
                                <SelectItem value="message">Mensagens</SelectItem>
                                <SelectItem value="agent">Agente</SelectItem>
                                <SelectItem value="system">Sistema</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={String(limit)} onValueChange={(v) => setLimit(parseInt(v))}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="50">50 logs</SelectItem>
                                <SelectItem value="100">100 logs</SelectItem>
                                <SelectItem value="200">200 logs</SelectItem>
                                <SelectItem value="500">500 logs</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Logs List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {filteredLogs?.length || 0} registros encontrados
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[500px]">
                        <div className="space-y-2">
                            {filteredLogs?.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                                    Nenhum log encontrado
                                </div>
                            ) : (
                                filteredLogs?.map((log) => (
                                    <div
                                        key={log.id}
                                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                    >
                                        {/* Entity Icon */}
                                        <div className="mt-1 text-muted-foreground">
                                            {ENTITY_ICONS[log.entity_type] || <FileText className="h-4 w-4" />}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                {getActionBadge(log.action)}
                                                <span className="text-xs text-muted-foreground">
                                                    {log.entity_type}
                                                    {log.entity_id && ` • ${log.entity_id.substring(0, 8)}...`}
                                                </span>
                                            </div>

                                            {/* Metadata */}
                                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {Object.entries(log.metadata).slice(0, 3).map(([key, value]) => (
                                                        <span key={key} className="mr-2">
                                                            <span className="font-medium">{key}:</span>{" "}
                                                            {typeof value === "string"
                                                                ? value.substring(0, 30) + (value.length > 30 ? "..." : "")
                                                                : JSON.stringify(value).substring(0, 30)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Value changes */}
                                            {log.previous_value && log.new_value && (
                                                <div className="text-xs mt-1">
                                                    <span className="text-red-500">-</span>
                                                    <span className="text-green-500 ml-2">+</span>
                                                    <span className="text-muted-foreground ml-1">
                                                        Alteração detectada
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Timestamp */}
                                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString("pt-BR", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
