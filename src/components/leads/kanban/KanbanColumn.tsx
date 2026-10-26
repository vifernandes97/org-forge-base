import { useDroppable } from '@dnd-kit/core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { KanbanCard } from './KanbanCard';
import type { Stage, LeadWithRelations } from '@/types';
import { differenceInHours } from 'date-fns';
import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      className={cn(
        'flex w-[296px] min-w-[296px] flex-col rounded-xl bg-muted/40 transition-colors',
        isOver && 'bg-primary/10 ring-2 ring-inset ring-primary/40',
      )}
    >
      {/* Header */}
      <div className="space-y-1 px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden />
          <span className="flex-1 truncate text-sm font-semibold">{stage.name}</span>

          {stage.sla_hours && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />{stage.sla_hours}h
                </span>
              </TooltipTrigger>
              <TooltipContent>SLA da etapa: {stage.sla_hours}h</TooltipContent>
            </Tooltip>
          )}

          <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {leads.length}
          </span>
        </div>

        <div className="flex min-h-[16px] items-center gap-2 pl-[18px] text-[11px] text-muted-foreground tabular-nums">
          {totalValue > 0 && (
            <span>
              {formatCurrencyCompact(totalValue)}
              {leads.length > 1 && <span className="opacity-70"> · ticket {formatCurrencyCompact(avgTicket)}</span>}
            </span>
          )}
          {slaExceededCount > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-500">
              <AlertTriangle className="h-3 w-3" />
              {slaExceededCount} acima do SLA
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 px-2 pb-2 [&>[data-radix-scroll-area-viewport]>div]:!block">
        <div className="min-h-[80px] w-full min-w-0 space-y-2 pt-0.5">
          {leads.length === 0 ? (
            <div
              className={cn(
                'flex items-center justify-center rounded-lg border border-dashed py-6 text-[11px] transition-colors',
                isOver ? 'border-primary/50 text-primary' : 'border-border/70 text-muted-foreground/60',
              )}
            >
              {isOver ? 'Soltar aqui' : 'Nenhum negócio'}
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
