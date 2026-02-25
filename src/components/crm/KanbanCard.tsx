import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Building2, User, Clock, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CrmLead } from '@/hooks/useCrmPipeline';

interface KanbanCardProps {
    crmLead: CrmLead;
    onClick?: () => void;
    onRemove?: () => void;
}

export default function KanbanCard({ crmLead, onClick, onRemove }: KanbanCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: crmLead.id,
        data: { type: 'card', crmLead },
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
                className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow bg-white border border-gray-100 group"
                onClick={onClick}
            >
                <div className="space-y-2">
                    <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-sm leading-tight truncate flex-1 mr-2">
                            {lead.nome}
                        </h4>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
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
                                    Remover do funil
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{lead.telefone}</span>
                    </div>

                    {lead.email && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{lead.email}</span>
                        </div>
                    )}

                    {lead.empreendimentos && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{lead.empreendimentos.nome}</span>
                        </div>
                    )}

                    {lead.corretores && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">
                                {lead.corretores.profiles.first_name} {lead.corretores.profiles.last_name}
                            </span>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {timeInStage}
                        </div>
                        {crmLead.valor_estimado && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                R$ {crmLead.valor_estimado.toLocaleString('pt-BR')}
                            </Badge>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
