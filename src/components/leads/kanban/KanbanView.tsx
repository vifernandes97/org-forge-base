import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { differenceInHours } from 'date-fns';
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
import type { LeadWithRelations, LeadFilters, StageTimeFilter } from '@/types';

interface KanbanViewProps {
  funnelId: string;
  filters?: LeadFilters;
}

function matchesStageTime(lead: any, stageTime: StageTimeFilter, stages: any[]): boolean {
  const hours = differenceInHours(new Date(), new Date(lead.stage_entered_at));
  switch (stageTime) {
    case 'less_24h': return hours < 24;
    case '1_3_days': return hours >= 24 && hours < 72;
    case '3_7_days': return hours >= 72 && hours < 168;
    case 'more_7_days': return hours >= 168;
    case 'above_sla': {
      const stage = stages.find(s => s.id === lead.stage_id);
      return stage?.sla_hours ? hours > stage.sla_hours : false;
    }
    default: return true;
  }
}

export function KanbanView({ funnelId, filters }: KanbanViewProps) {
  const { data: stages, isLoading: stagesLoading } = useStages(funnelId);
  const { data: leads, isLoading: leadsLoading } = useLeadsByFunnel(funnelId, filters);
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

  // Apply client-side filters (stage_time, custom_fields)
  const filteredLeads = useMemo(() => {
    let result = leads || [];
    if (filters?.stage_time) {
      result = result.filter((l: any) => matchesStageTime(l, filters.stage_time!, sortedStages));
    }
    // Custom field filtering would go here if custom_field_values were loaded
    return result;
  }, [leads, filters, sortedStages]);

  const leadsByStage = useMemo(() => {
    const map: Record<string, LeadWithRelations[]> = {};
    sortedStages.forEach(s => { map[s.id] = []; });
    (filteredLeads || []).forEach((l: any) => {
      if (map[l.stage_id]) map[l.stage_id].push(l);
    });
    return map;
  }, [filteredLeads, sortedStages]);

  const activeLead = useMemo(
    () => (filteredLeads || []).find((l: any) => l.id === activeId) as LeadWithRelations | undefined,
    [filteredLeads, activeId]
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

    if (!sortedStages.find(s => s.id === targetStageId)) return;

    const fromStage = sortedStages.find(s => s.id === (lead as any).stage_id);
    const toStage = sortedStages.find(s => s.id === targetStageId);

    moveLead.mutate({ leadId, stageId: targetStageId });

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
        fireWebhook({
          webhook_url: toStage.webhook_url,
          payload,
          organization_id: organization.id,
          stage_id: toStage.id,
          lead_id: leadId,
        }).catch(() => {});
      }
    }
  };

  if (stagesLoading || leadsLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4 w-full min-w-0">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="flex flex-col w-[300px] min-w-[300px] rounded-lg border bg-muted/30"
          >
            <Skeleton className="h-1 rounded-t-lg rounded-b-none" />
            <div className="px-3 pt-2.5 pb-2 border-b space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-8 rounded-full" />
              </div>
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="p-2 space-y-2">
              {[1, 2, 3].map(j => (
                <Skeleton key={j} className="h-[88px] rounded-lg" />
              ))}
            </div>
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
        <div
          className="flex gap-3 overflow-x-auto pb-4 h-[calc(100vh-220px)] w-full min-w-0"
          style={{
            maskImage:
              'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
          }}
        >
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
