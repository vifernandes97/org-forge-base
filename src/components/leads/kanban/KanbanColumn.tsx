import { useDroppable } from '@dnd-kit/core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { KanbanCard } from './KanbanCard';
import type { Stage, LeadWithRelations } from '@/types';
import { differenceInHours } from 'date-fns';
import { Clock, Inbox } from 'lucide-react';

interface KanbanColumnProps {
  stage: Stage;
  leads: LeadWithRelations[];
  onCardClick: (id: string) => void;
}

function formatCurrencyCompact(v: number): string {
  if (v >= 1000) {
    return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  }
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

export function KanbanColumn({ stage, leads, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const totalValue = leads.reduce((sum, l) => sum + Number(l.value || 0), 0);
  const avgTicket = leads.length > 0 ? totalValue / leads.length : 0;

  const slaExceededCount = stage.sla_hours
    ? leads.filter(l => differenceInHours(new Date(), new Date(l.stage_entered_at)) > stage.sla_hours!).length
    : 0;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-[300px] min-w-[300px] rounded-lg border bg-muted/30 transition-all ${
        isOver ? 'ring-2 ring-primary/60 bg-primary/5' : ''
      }`}
    >
      {/* Colored top accent */}
      <div
        className="h-1 rounded-t-lg"
        style={{ backgroundColor: stage.color }}
        aria-hidden
      />

      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 border-b space-y-1">
        {/* Row 1: name + count pill + sla badge */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate flex-1">{stage.name}</span>

          {stage.sla_hours && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center text-muted-foreground/70">
                  <Clock className="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent>SLA: {stage.sla_hours}h</TooltipContent>
            </Tooltip>
          )}

          <span className="inline-flex items-center gap-1 text-xs bg-muted text-foreground/80 rounded-full px-2 py-0.5 tabular-nums">
            {leads.length}
            {slaExceededCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-destructive"
                    aria-label="Leads acima do SLA"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {slaExceededCount} lead{slaExceededCount > 1 ? 's' : ''} acima do SLA
                </TooltipContent>
              </Tooltip>
            )}
          </span>
        </div>

        {/* Row 2: total + avg ticket */}
        {totalValue > 0 ? (
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {formatCurrencyCompact(totalValue)}
            {leads.length > 1 && (
              <>
                <span className="mx-1.5 opacity-50">·</span>
                ticket {formatCurrencyCompact(avgTicket)}
              </>
            )}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground/60">—</p>
        )}
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 p-2 [&>[data-radix-scroll-area-viewport]>div]:!block">
        <div className="space-y-2 min-h-[80px] min-w-0 w-full">
          {leads.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center gap-1.5 py-8 rounded-md border border-dashed transition-colors ${
                isOver
                  ? 'border-primary/50 bg-primary/5 text-primary'
                  : 'border-border/60 text-muted-foreground/50'
              }`}
            >
              <Inbox className="h-5 w-5 opacity-60" />
              <span className="text-[11px]">Solte leads aqui</span>
            </div>
          ) : (
            leads.map(lead => {
              const hoursInStage = differenceInHours(new Date(), new Date(lead.stage_entered_at));
              const slaExceeded = !!(stage.sla_hours && hoursInStage > stage.sla_hours);
              return (
                <KanbanCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => onCardClick(lead.id)}
                  slaExceeded={slaExceeded}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
