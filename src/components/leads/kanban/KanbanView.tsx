import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, closestCorners, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
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
import type { LeadWithRelations, LeadFilters } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { getCustomFieldValuesForLeads } from '@/services/leads';
import { applyClientFilters, buildCustomFieldValueMap } from '@/lib/leadClientFilters';
import { cn } from '@/lib/utils';

interface KanbanViewProps {
  funnelId: string;
  filters?: LeadFilters;
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

  // Touch: long-press to drag, so a plain swipe still scrolls the board.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const boardRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const [boardHeight, setBoardHeight] = useState<number>();
  const [activeStageIndex, setActiveStageIndex] = useState(0);

  const sortedStages = useMemo(
    () => (stages || []).slice().sort((a, b) => a.position - b.position),
    [stages]
  );

  const hasCustomFieldFilter = !!filters?.custom_fields && Object.keys(filters.custom_fields).length > 0;
  const leadIds = useMemo(() => (leads || []).map((l: any) => l.id), [leads]);

  const { data: cfRows } = useQuery({
    queryKey: ['custom-field-values', funnelId, leadIds],
    queryFn: () => getCustomFieldValuesForLeads(leadIds),
    enabled: hasCustomFieldFilter && leadIds.length > 0,
  });

  const cfMap = useMemo(() => buildCustomFieldValueMap((cfRows || []) as any), [cfRows]);

  // Apply client-side filters (stage_time, custom_fields)
  const filteredLeads = useMemo(
    () => applyClientFilters((leads || []) as any[], filters, sortedStages, cfMap),
    [leads, filters, sortedStages, cfMap]
  );

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

  const loading = stagesLoading || leadsLoading;

  // The board fills the viewport down to the main padding (above the tab bar on phones); columns scroll inside.
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => {
      const main = el.closest('main');
      const reserve = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 24;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setBoardHeight(Math.max(320, window.innerHeight - top - reserve));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [loading]);

  // Phones show one column per screen: keep the stage chips in sync with the swipe position.
  const columnStep = () => {
    const first = boardRef.current?.firstElementChild as HTMLElement | null;
    return first ? first.offsetWidth + 12 : 1;
  };
  const handleBoardScroll = useCallback(() => {
    const el = boardRef.current;
    if (el) setActiveStageIndex(Math.round(el.scrollLeft / columnStep()));
  }, []);
  const scrollToStage = (index: number) => {
    boardRef.current?.scrollTo({ left: index * columnStep(), behavior: 'smooth' });
  };
  useEffect(() => {
    const row = chipsRef.current;
    const chip = row?.children[activeStageIndex] as HTMLElement | undefined;
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - 16, behavior: 'smooth' });
  }, [activeStageIndex]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    if (typeof TouchEvent !== 'undefined' && event.activatorEvent instanceof TouchEvent) navigator.vibrate?.(12);
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

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4 w-full min-w-0">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="flex flex-col w-[calc(100vw-3.5rem)] min-w-[calc(100vw-3.5rem)] sm:w-[296px] sm:min-w-[296px] rounded-xl bg-muted/40"
          >
            <div className="px-3 pt-3 pb-2 space-y-2">
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
        {/* Stage navigator (phones) */}
        <div ref={chipsRef} className="-mx-4 -mb-2 flex overflow-x-auto border-b px-4 scrollbar-none sm:hidden" role="tablist" aria-label="Etapas">
          {sortedStages.map((stage, i) => (
            <button
              key={stage.id}
              type="button"
              role="tab"
              aria-selected={i === activeStageIndex}
              onClick={() => scrollToStage(i)}
              className={cn(
                '-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors',
                i === activeStageIndex ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground',
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden />
              {stage.name}
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{leadsByStage[stage.id]?.length || 0}</span>
            </button>
          ))}
        </div>

        <div
          ref={boardRef}
          onScroll={handleBoardScroll}
          style={{ height: boardHeight }}
          className={cn(
            'flex h-[calc(100vh-220px)] w-full min-w-0 gap-3 overflow-x-auto pb-3',
            // Phones: edge-to-edge, one column per swipe (snap is off while dragging so auto-scroll can work)
            'max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:scroll-px-4 max-sm:px-4 max-sm:scrollbar-none',
            !activeId && 'max-sm:snap-x max-sm:snap-mandatory',
          )}
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
