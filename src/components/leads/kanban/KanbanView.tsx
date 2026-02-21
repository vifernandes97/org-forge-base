import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useStages } from '@/hooks/useStages';
import { useLeadsByFunnel, useMoveLeadToStage } from '@/hooks/useLeads';
import { useCreateActivity } from '@/hooks/useActivities';
import { useCreateTask } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useFunnels } from '@/hooks/useFunnels';
import { buildWebhookPayload, fireWebhook } from '@/services/webhooks';
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
  const createActivity = useCreateActivity();
  const createTask = useCreateTask();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { data: funnels } = useFunnels();

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

    const fromStage = sortedStages.find(s => s.id === (lead as any).stage_id);
    const toStage = sortedStages.find(s => s.id === targetStageId);

    moveLead.mutate({ leadId, stageId: targetStageId });

    // Auto-register stage_change activity
    if (user && organization && fromStage && toStage) {
      createActivity.mutate({
        organization_id: organization.id,
        lead_id: leadId,
        user_id: user.id,
        activity_type: 'stage_change',
        title: `Moveu de ${fromStage.name} para ${toStage.name}`,
        metadata: {
          from_stage_id: fromStage.id,
          from_stage_name: fromStage.name,
          to_stage_id: toStage.id,
          to_stage_name: toStage.name,
        },
      });

      // Auto-create follow-up task if new stage has SLA
      if (toStage.sla_hours) {
        const dueDate = new Date();
        dueDate.setHours(dueDate.getHours() + toStage.sla_hours);
        createTask.mutate({
          organization_id: organization.id,
          lead_id: leadId,
          assigned_to: (lead as any).assigned_to || user.id,
          title: `Follow-up: ${(lead as any).name}`,
          task_type: 'follow_up',
          due_date: dueDate.toISOString(),
          priority: (lead as any).priority || 'medium',
        });
      }

      // Fire webhook if new stage has webhook_url configured
      if (toStage.webhook_url) {
        const funnel = funnels?.find(f => f.id === (lead as any).funnel_id);
        const payload = buildWebhookPayload({
          lead,
          fromStage: { id: fromStage.id, name: fromStage.name },
          toStage: { id: toStage.id, name: toStage.name },
          funnel: { id: funnel?.id || '', name: funnel?.name || '' },
          user: { id: user.id, full_name: (user as any).user_metadata?.full_name },
          organization: { id: organization.id, name: organization.name },
        });
        // Fire-and-forget
        fireWebhook({
          webhook_url: toStage.webhook_url,
          payload,
          organization_id: organization.id,
          stage_id: toStage.id,
          lead_id: leadId,
        }).catch(() => {}); // Silently ignore client-side errors
      }
    }
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
