import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Building2, User, Clock, MoreHorizontal, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { crmCardValue } from '@/utils/crmSales';
import { formatCurrency } from '@/utils/formatters';
import type { CrmLead } from '@/hooks/useCrmPipeline';

interface KanbanCardProps {
    crmLead: CrmLead;
    onClick?: () => void;
    onRemove?: () => void;
    onSold?: () => void;
}

export default function KanbanCard({ crmLead, onClick, onRemove, onSold }: KanbanCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: crmLead.id,
        data: { type: 'card', crmLead },
        disabled: !!crmLead.archived_at || !!crmLead.venda_id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const lead = crmLead.leads;
    const timeInStage = formatDistanceToNow(new Date(crmLead.moved_at), {
        locale: ptBR,
        addSuffix: false,
    });

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <Card
                className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow bg-card border border-border group"
                onClick={onClick}
            >
                <div className="space-y-2">
                    <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-sm leading-tight truncate flex-1 mr-2">
                            {lead?.nome || "Lead Desconhecido"}
                        </h4>
                        {onRemove && <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label={`Mais opções para o lead ${lead?.nome || "Desconhecido"}`}
                                >
                                    <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemove?.();
                                    }}
                                    className="text-destructive"
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                                    Remover oportunidade
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>}
                    </div>

                    {crmLead.tag && (
                        <Badge
                            variant="secondary"
                            className="max-w-full gap-1 px-1.5 py-0 text-[10px] font-medium"
                            style={crmLead.tag_cor ? { backgroundColor: crmLead.tag_cor, color: '#fff' } : undefined}
                        >
                            <Tag className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
                            <span className="truncate">{crmLead.tag}</span>
                        </Badge>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{lead?.telefone || "—"}</span>
                    </div>

                    {lead?.email && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{lead.email}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                            {crmLead.empreendimentos?.nome || 'Sem empreendimento definido'}
                        </span>
                    </div>

                    {lead?.corretores?.profiles && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">
                                {lead.corretores.profiles.first_name} {lead.corretores.profiles.last_name}
                            </span>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-border">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {timeInStage}
                        </div>
                        {crmCardValue(crmLead) > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {formatCurrency(crmCardValue(crmLead))}
                            </Badge>
                        )}
                    </div>
                    {onSold && (
                        <Button size="sm" variant={crmLead.venda_id ? 'outline' : 'default'}
                            className="w-full" onPointerDown={e => e.stopPropagation()}
                            onKeyDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); onSold(); }}>
                            {crmLead.venda_id ? 'Ver venda' : 'VENDIDO'}
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
}
