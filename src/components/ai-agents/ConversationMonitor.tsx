import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { MessageSquare, User, Bot, Calendar, Search, Phone, ChevronRight } from "lucide-react";

interface Conversation {
    id: string;
    agent_id: string;
    phone_number: string;
    status: string;
    current_stage: string;
    lead_score: number;
    total_messages: number;
    started_at: string;
    last_message_at: string;
    qualification_data: Record<string, any>;
    lead?: { nome: string } | null;
}

interface Message {
    id: string;
    role: string;
    content: string;
    created_at: string;
    intent_detected: string | null;
    action_taken: string | null;
}

interface ConversationMonitorProps {
    agentId?: string;
}

export function ConversationMonitor({ agentId }: ConversationMonitorProps) {
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch conversations
    const { data: conversations, isLoading } = useQuery({
        queryKey: ['agent-conversations', agentId],
        queryFn: async () => {
            let query = supabase
                .from('agent_conversations')
                .select(`
          *,
          lead:leads(nome)
        `)
                .order('last_message_at', { ascending: false })
                .limit(50);

            if (agentId) {
                query = query.eq('agent_id', agentId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as Conversation[];
        }
    });

    // Fetch messages for selected conversation
    const { data: messages, isLoading: messagesLoading } = useQuery({
        queryKey: ['agent-messages', selectedConversation?.id],
        queryFn: async () => {
            if (!selectedConversation) return [];

            const { data, error } = await supabase
                .from('agent_messages')
                .select('*')
                .eq('conversation_id', selectedConversation.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data as Message[];
        },
        enabled: !!selectedConversation
    });

    const filteredConversations = conversations?.filter(conv =>
        conv.phone_number.includes(searchTerm) ||
        conv.lead?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
            active: { variant: 'default', label: 'Ativa' },
            completed: { variant: 'secondary', label: 'Concluída' },
            transferred: { variant: 'outline', label: 'Transferida' },
            expired: { variant: 'destructive', label: 'Expirada' }
        };
        const config = variants[status] || { variant: 'outline', label: status };
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-3 gap-4 h-[500px]">
                <div className="col-span-1 space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} className="h-20" />
                    ))}
                </div>
                <Skeleton className="col-span-2" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-4 h-[600px]">
            {/* Conversations List */}
            <div className="col-span-1 border rounded-lg overflow-hidden">
                <div className="p-3 border-b bg-muted/50">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 h-9"
                        />
                    </div>
                </div>

                <ScrollArea className="h-[540px]">
                    {filteredConversations?.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>Nenhuma conversa encontrada</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filteredConversations?.map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedConversation(conv)}
                                    className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${selectedConversation?.id === conv.id ? 'bg-muted' : ''
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium truncate">
                                            {conv.lead?.nome || conv.phone_number}
                                        </span>
                                        {getStatusBadge(conv.status)}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Phone className="h-3 w-3" />
                                        <span>{conv.phone_number}</span>
                                        <span>•</span>
                                        <span>{conv.total_messages} msgs</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                        <Calendar className="h-3 w-3" />
                                        <span>{formatDate(conv.last_message_at)}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Messages Panel */}
            <div className="col-span-2 border rounded-lg overflow-hidden flex flex-col">
                {!selectedConversation ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <ChevronRight className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>Selecione uma conversa para ver as mensagens</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-3 border-b bg-muted/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold">
                                        {selectedConversation.lead?.nome || selectedConversation.phone_number}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Score: {selectedConversation.lead_score} •
                                        Estágio: {selectedConversation.current_stage}
                                    </p>
                                </div>
                                {getStatusBadge(selectedConversation.status)}
                            </div>
                        </div>

                        {/* Messages */}
                        <ScrollArea className="flex-1 p-4">
                            {messagesLoading ? (
                                <div className="space-y-2">
                                    {[1, 2, 3].map(i => (
                                        <Skeleton key={i} className="h-16" />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {messages?.map(msg => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                                        >
                                            <div className={`max-w-[80%] ${msg.role === 'assistant'
                                                    ? 'bg-muted rounded-lg rounded-tl-none'
                                                    : 'bg-primary text-primary-foreground rounded-lg rounded-tr-none'
                                                } p-3`}>
                                                <div className="flex items-center gap-2 mb-1 text-xs opacity-70">
                                                    {msg.role === 'assistant' ? (
                                                        <Bot className="h-3 w-3" />
                                                    ) : (
                                                        <User className="h-3 w-3" />
                                                    )}
                                                    <span>{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    {msg.intent_detected && (
                                                        <Badge variant="outline" className="text-[10px] h-4">
                                                            {msg.intent_detected}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                {msg.action_taken && msg.action_taken !== 'none' && (
                                                    <Badge variant="secondary" className="mt-2 text-xs">
                                                        Ação: {msg.action_taken}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Qualification Data */}
                        {Object.keys(selectedConversation.qualification_data || {}).length > 0 && (
                            <div className="p-3 border-t bg-muted/30">
                                <h4 className="text-xs font-semibold mb-2 text-muted-foreground">
                                    Dados de Qualificação
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(selectedConversation.qualification_data).map(([key, value]) => (
                                        <Badge key={key} variant="outline" className="text-xs">
                                            {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
