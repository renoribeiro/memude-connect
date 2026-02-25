import { useState, useMemo, useCallback } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
    type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import type { CrmStage, CrmLead } from '@/hooks/useCrmPipeline';

interface KanbanBoardProps {
    stages: CrmStage[];
    leads: CrmLead[];
    onMoveLead: (crmLeadId: string, newStageId: string, newPosition: number) => void;
    onCardClick?: (crmLead: CrmLead) => void;
    onRemoveLead?: (crmLeadId: string) => void;
}

export default function KanbanBoard({
    stages,
    leads,
    onMoveLead,
    onCardClick,
    onRemoveLead,
}: KanbanBoardProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const leadsByStage = useMemo(() => {
        const map: Record<string, CrmLead[]> = {};
        for (const stage of stages) {
            map[stage.id] = [];
        }
        for (const lead of leads) {
            const stageId = lead.stage_id;
            if (stageId && map[stageId]) {
                map[stageId].push(lead);
            }
        }
        // Sort by posicao within each stage
        for (const stageId of Object.keys(map)) {
            map[stageId].sort((a, b) => a.posicao - b.posicao);
        }
        return map;
    }, [stages, leads]);

    const activeLead = useMemo(
        () => leads.find((l) => l.id === activeId) ?? null,
        [leads, activeId]
    );

    const findStageForLead = useCallback(
        (leadId: string): string | null => {
            const lead = leads.find((l) => l.id === leadId);
            return lead?.stage_id ?? null;
        },
        [leads]
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (_event: DragOverEvent) => {
        // Visual feedback handled by useDroppable isOver
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeCrmLeadId = active.id as string;
        const overData = over.data.current;

        let targetStageId: string;
        let targetPosition = 0;

        if (overData?.type === 'column') {
            // Dropped on an empty column
            targetStageId = over.id as string;
            targetPosition = 0;
        } else if (overData?.type === 'card') {
            // Dropped on another card — find its stage
            const overCrmLead = overData.crmLead as CrmLead;
            targetStageId = overCrmLead.stage_id!;

            // Calculate position
            const stageLeads = leadsByStage[targetStageId] ?? [];
            const overIndex = stageLeads.findIndex((l) => l.id === over.id);
            targetPosition = overIndex >= 0 ? overIndex : stageLeads.length;
        } else {
            // Dropped on a column (via id match)
            targetStageId = over.id as string;
            targetPosition = (leadsByStage[targetStageId] ?? []).length;
        }

        // Only update if stage changed or position changed
        const currentStageId = findStageForLead(activeCrmLeadId);
        if (currentStageId !== targetStageId || true) {
            onMoveLead(activeCrmLeadId, targetStageId, targetPosition);
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
                {stages.map((stage) => (
                    <KanbanColumn
                        key={stage.id}
                        stage={stage}
                        leads={leadsByStage[stage.id] ?? []}
                        onCardClick={onCardClick}
                        onRemoveLead={onRemoveLead}
                    />
                ))}
            </div>

            <DragOverlay>
                {activeLead ? (
                    <div className="rotate-3 opacity-90">
                        <KanbanCard crmLead={activeLead} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
