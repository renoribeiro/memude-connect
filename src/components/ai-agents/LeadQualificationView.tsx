import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
    User,
    DollarSign,
    Home,
    MapPin,
    Calendar,
    CreditCard,
    Search,
    Star,
    CheckCircle,
    XCircle,
    Flame,
    Thermometer,
    Snowflake,
    Target
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface LeadQualificationData {
    id: string;
    conversation_id: string;
    lead_id: string | null;
    property_type: string | null;
    min_price: number | null;
    max_price: number | null;
    min_bedrooms: number | null;
    max_bedrooms: number | null;
    preferred_neighborhoods: string[] | null;
    preferred_features: string[] | null;
    urgency: string | null;
    financing_needed: boolean | null;
    has_property_to_sell: boolean | null;
    decision_maker: boolean | null;
    qualification_score: number;
    is_qualified: boolean;
    disqualification_reason: string | null;
    // BANT fields
    bant_budget_score: number | null;
    bant_authority_score: number | null;
    bant_need_score: number | null;
    bant_timeline_score: number | null;
    bant_total_score: number | null;
    lead_temperature: string | null;
    created_at: string;
    updated_at: string;
    conversation?: {
        phone_number: string;
        total_messages: number;
        lead_score: number;
        qualification_data: Record<string, any>;
        agent?: {
            name: string;
        };
    };
}

interface LeadQualificationViewProps {
    agentId?: string;
}

export function LeadQualificationView({ agentId }: LeadQualificationViewProps) {
    const [searchTerm, setSearchTerm] = useState("");

    const { data: qualifications, isLoading } = useQuery({
        queryKey: ["lead-qualifications", agentId],
        queryFn: async () => {
            let query = supabase
                .from("ai_lead_qualification")
                .select(`
                    *,
                    conversation:agent_conversations(
                        phone_number,
                        total_messages,
                        lead_score,
                        qualification_data,
                        agent:ai_agents(name)
                    )
                `)
                .order("updated_at", { ascending: false })
                .limit(100);

            if (agentId) {
                query = query.eq("conversation.agent_id", agentId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as LeadQualificationData[];
        }
    });

    const filteredQualifications = qualifications?.filter(q => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            q.conversation?.phone_number?.includes(search) ||
            q.property_type?.toLowerCase().includes(search) ||
            q.preferred_neighborhoods?.some(n => n.toLowerCase().includes(search))
        );
    });

    const formatPrice = (value: number | null) => {
        if (!value) return "N/A";
        if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
        return `R$ ${value}`;
    };

    const getUrgencyLabel = (urgency: string | null) => {
        const labels: Record<string, { text: string; color: string }> = {
            immediate: { text: "Imediato", color: "bg-red-500" },
            "3_months": { text: "3 meses", color: "bg-orange-500" },
            "6_months": { text: "6 meses", color: "bg-yellow-500" },
            "1_year": { text: "1 ano", color: "bg-blue-500" },
            just_researching: { text: "Pesquisando", color: "bg-gray-500" }
        };
        return labels[urgency || ""] || { text: urgency || "N/A", color: "bg-gray-400" };
    };

    const getTemperatureBadge = (temperature: string | null, totalScore: number | null) => {
        const configs: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
            hot: {
                icon: <Flame className="h-3 w-3" />,
                label: 'Hot Lead',
                className: 'bg-red-500 text-white'
            },
            warm: {
                icon: <Thermometer className="h-3 w-3" />,
                label: 'Warm Lead',
                className: 'bg-orange-500 text-white'
            },
            cool: {
                icon: <Snowflake className="h-3 w-3" />,
                label: 'Cool Lead',
                className: 'bg-blue-400 text-white'
            },
            cold: {
                icon: <Snowflake className="h-3 w-3" />,
                label: 'Cold Lead',
                className: 'bg-gray-400 text-white'
            }
        };
        const config = configs[temperature || 'cold'] || configs.cold;
        return (
            <Badge className={`${config.className} flex items-center gap-1`}>
                {config.icon}
                {totalScore !== null ? `${totalScore}` : config.label}
            </Badge>
        );
    };

    const BANTScoreBar = ({ label, score, max, color }: { label: string; score: number; max: number; color: string }) => (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{score}/{max}</span>
            </div>
            <Progress value={(score / max) * 100} className={`h-1.5 ${color}`} />
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por telefone, tipo ou bairro..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Badge variant="outline">
                    {filteredQualifications?.length || 0} qualificações
                </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredQualifications?.map((qual) => (
                    <Card key={qual.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    {qual.conversation?.phone_number || "N/A"}
                                </CardTitle>
                                <div className="flex items-center gap-1">
                                    {qual.lead_temperature ? (
                                        getTemperatureBadge(qual.lead_temperature, qual.bant_total_score)
                                    ) : qual.is_qualified ? (
                                        <Badge className="bg-green-500">
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Qualificado
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary">
                                            <Star className="h-3 w-3 mr-1" />
                                            Score: {qual.qualification_score}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {/* Property Type */}
                            {qual.property_type && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Home className="h-4 w-4 text-muted-foreground" />
                                    <span className="capitalize">{qual.property_type}</span>
                                    {qual.min_bedrooms && (
                                        <span className="text-muted-foreground">
                                            ({qual.min_bedrooms}+ quartos)
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Price Range */}
                            {(qual.min_price || qual.max_price) && (
                                <div className="flex items-center gap-2 text-sm">
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    <span>
                                        {formatPrice(qual.min_price)} - {formatPrice(qual.max_price)}
                                    </span>
                                </div>
                            )}

                            {/* Neighborhoods */}
                            {qual.preferred_neighborhoods && qual.preferred_neighborhoods.length > 0 && (
                                <div className="flex items-center gap-2 text-sm">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <span>{qual.preferred_neighborhoods.slice(0, 2).join(", ")}</span>
                                </div>
                            )}

                            {/* Urgency */}
                            {qual.urgency && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <Badge className={`${getUrgencyLabel(qual.urgency).color} text-white text-xs`}>
                                        {getUrgencyLabel(qual.urgency).text}
                                    </Badge>
                                </div>
                            )}

                            {/* Financing */}
                            <div className="flex items-center gap-4 text-sm">
                                {qual.financing_needed !== null && (
                                    <div className="flex items-center gap-1">
                                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                                        {qual.financing_needed ? (
                                            <span className="text-green-600">Precisa financiar</span>
                                        ) : (
                                            <span className="text-muted-foreground">À vista</span>
                                        )}
                                    </div>
                                )}
                                {qual.decision_maker !== null && (
                                    qual.decision_maker ? (
                                        <Badge variant="outline" className="text-xs">Decisor</Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-xs text-muted-foreground">Não-decisor</Badge>
                                    )
                                )}
                            </div>

                            {/* Disqualification reason */}
                            {qual.disqualification_reason && (
                                <div className="flex items-center gap-2 text-sm text-red-500">
                                    <XCircle className="h-4 w-4" />
                                    <span>{qual.disqualification_reason}</span>
                                </div>
                            )}

                            {/* BANT Score Breakdown */}
                            {qual.bant_total_score !== null && qual.bant_total_score > 0 && (
                                <div className="space-y-2 pt-2 border-t">
                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                        <Target className="h-3 w-3" />
                                        BANT Score
                                    </div>
                                    <div className="grid gap-1.5">
                                        <BANTScoreBar
                                            label="Budget (Orçamento)"
                                            score={qual.bant_budget_score || 0}
                                            max={25}
                                            color="[&>div]:bg-green-500"
                                        />
                                        <BANTScoreBar
                                            label="Authority (Decisor)"
                                            score={qual.bant_authority_score || 0}
                                            max={20}
                                            color="[&>div]:bg-blue-500"
                                        />
                                        <BANTScoreBar
                                            label="Need (Necessidade)"
                                            score={qual.bant_need_score || 0}
                                            max={30}
                                            color="[&>div]:bg-purple-500"
                                        />
                                        <BANTScoreBar
                                            label="Timeline (Prazo)"
                                            score={qual.bant_timeline_score || 0}
                                            max={25}
                                            color="[&>div]:bg-orange-500"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Meta info */}
                            <div className="pt-2 border-t text-xs text-muted-foreground flex justify-between">
                                <span>{qual.conversation?.total_messages || 0} msgs</span>
                                <span>
                                    {new Date(qual.updated_at).toLocaleDateString("pt-BR")}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {(!filteredQualifications || filteredQualifications.length === 0) && (
                <Card className="p-8 text-center text-muted-foreground">
                    <p>Nenhuma qualificação encontrada</p>
                    <p className="text-sm mt-1">
                        As qualificações aparecerão aqui conforme os leads conversam com os agentes
                    </p>
                </Card>
            )}
        </div>
    );
}
