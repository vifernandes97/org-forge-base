import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useStages } from '@/hooks/useStages';
import { useLeadsByFunnel, useMoveLeadToStage } from '@/hooks/useLeads';
import { KanbanColumn } from './KanbanColumn';
import { DragOverlayCard } from './DragOverlayCard';
import { Skeleton } from '@/components/ui/skeleton';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import type { LeadWithRelations } from '@/types';

interface KanbanViewProps {
  funnelId: string;
}

export function KanbanView({ funnelId }: KanbanViewProps) {
  const { data: stages, isLoading: stagesLoading } = useStages(funnelId);
  const { data: leads, isLoading: leadsLoading } = useLeadsByFunnel(funnelId);
  const moveLead = useMoveLeadToStage(funnelId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const sortedStages = useMemo(
    () => (stages || []).slice().sort((a, b) => a.position - b.position),
    [stages]
  );

  const leadsByStage = useMemo(() => {
    const map: Record<string, LeadWithRelations[]> = {};
    sortedStages.forEach(s => { map[s.id] = []; });
    (leads || []).forEach((l: any) => {
      if (map[l.stage_id]) map[l.stage_id].push(l);
    });
    return map;
  }, [leads, sortedStages]);

  const activeLead = useMemo(
    () => (leads || []).find((l: any) => l.id === activeId) as LeadWithRelations | undefined,
    [leads, activeId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const targetStageId = over.id as string;
    const lead = (leads || []).find((l: any) => l.id === leadId);
    if (!lead || (lead as any).stage_id === targetStageId) return;

    // Check target is a valid stage
    if (!sortedStages.find(s => s.id === targetStageId)) return;

    console.log('[Webhook placeholder] Lead moved:', { leadId, from: (lead as any).stage_id, to: targetStageId });
    moveLead.mutate({ leadId, stageId: targetStageId });
  };

  if (stagesLoading || leadsLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="w-[280px] min-w-[280px]">
            <Skeleton className="h-[400px] rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)]">
          {sortedStages.map(stage => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={leadsByStage[stage.id] || []}
              onCardClick={setSelectedLeadId}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead ? <DragOverlayCard lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>

      <LeadDetailSheet leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
    </>
  );
}
