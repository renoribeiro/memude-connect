import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ScrollArea } from '@/components/ui/scroll-area';
import KanbanCard from './KanbanCard';
import { crmColumnVgv } from '@/utils/crmSales';
import type { CrmStage, CrmLead } from '@/hooks/useCrmPipeline';
import { formatCurrency } from '@/utils/formatters';

interface KanbanColumnProps {
    stage: CrmStage;
    leads: CrmLead[];
    onCardClick?: (crmLead: CrmLead) => void;
    onRemoveLead?: (crmLeadId: string) => void;
    isCompleted?: boolean;
}

export default function KanbanColumn({ stage, leads, onCardClick, onRemoveLead, isCompleted }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: stage.id,
        data: { type: 'column', stage },
    });

    const sortableIds = leads.map((l) => l.id);

    return (
        <div
            className={`flex flex-col bg-muted/80 rounded-xl min-w-[300px] w-[300px] border transition-colors ${isOver ? 'border-primary/40 bg-primary/5' : 'border-border'
                }`}
        >
            {/* Column Header */}
            <div className="p-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stage.cor }}
                    />
                    <h3 className="font-semibold text-sm truncate flex-1">{stage.nome}</h3>
                    <span className="text-xs bg-card px-2 py-0.5 rounded-full text-muted-foreground font-medium border">
                        {leads.length}
                    </span>
                </div>
                <p className="mt-2 text-sm font-semibold tabular-nums" title="Valor real das vendas vinculadas; valor estimado das demais oportunidades.">
                    VGV {formatCurrency(crmColumnVgv(leads))}
                </p>
                {isCompleted && <p className="mt-1 text-xs text-emerald-700">Vendas concluídas · arquivo mensal</p>}
            </div>

            {/* Column Body */}
            <div ref={setNodeRef} className="flex-1 min-h-[120px]">
                <ScrollArea className="h-[calc(100vh-280px)]">
                    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                        <div className="p-2 space-y-2">
                            {leads.map((crmLead) => (
                                <KanbanCard
                                    key={crmLead.id}
                                    crmLead={crmLead}
                                    onClick={() => onCardClick?.(crmLead)}
                                    onRemove={onRemoveLead ? () => onRemoveLead(crmLead.id) : undefined}
                                />
                            ))}
                            {leads.length === 0 && (
                                <div className="text-center py-8 text-xs text-muted-foreground select-none">
                                    Arraste oportunidades para cá
                                </div>
                            )}
                        </div>
                    </SortableContext>
                </ScrollArea>
            </div>
        </div>
    );
}
