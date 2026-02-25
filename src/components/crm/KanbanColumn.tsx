import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ScrollArea } from '@/components/ui/scroll-area';
import KanbanCard from './KanbanCard';
import type { CrmStage, CrmLead } from '@/hooks/useCrmPipeline';

interface KanbanColumnProps {
    stage: CrmStage;
    leads: CrmLead[];
    onCardClick?: (crmLead: CrmLead) => void;
    onRemoveLead?: (crmLeadId: string) => void;
}

export default function KanbanColumn({ stage, leads, onCardClick, onRemoveLead }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: stage.id,
        data: { type: 'column', stage },
    });

    const sortableIds = leads.map((l) => l.id);

    return (
        <div
            className={`flex flex-col bg-gray-50/80 rounded-xl min-w-[300px] w-[300px] border transition-colors ${isOver ? 'border-primary/40 bg-primary/5' : 'border-gray-200/60'
                }`}
        >
            {/* Column Header */}
            <div className="p-3 border-b border-gray-200/60">
                <div className="flex items-center gap-2">
                    <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stage.cor }}
                    />
                    <h3 className="font-semibold text-sm truncate flex-1">{stage.nome}</h3>
                    <span className="text-xs bg-white px-2 py-0.5 rounded-full text-muted-foreground font-medium border">
                        {leads.length}
                    </span>
                </div>
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
                                    onRemove={() => onRemoveLead?.(crmLead.id)}
                                />
                            ))}
                            {leads.length === 0 && (
                                <div className="text-center py-8 text-xs text-muted-foreground select-none">
                                    Arraste leads para cá
                                </div>
                            )}
                        </div>
                    </SortableContext>
                </ScrollArea>
            </div>
        </div>
    );
}
