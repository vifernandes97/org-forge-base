import { useDroppable } from '@dnd-kit/core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KanbanCard } from './KanbanCard';
import type { Stage, LeadWithRelations } from '@/types';
import { differenceInHours } from 'date-fns';

interface KanbanColumnProps {
  stage: Stage;
  leads: LeadWithRelations[];
  onCardClick: (id: string) => void;
}

export function KanbanColumn({ stage, leads, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const totalValue = leads.reduce((sum, l) => sum + Number(l.value || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-[280px] min-w-[280px] rounded-lg border bg-muted/30 transition-colors ${isOver ? 'ring-2 ring-primary/50' : ''}`}
    >
      {/* Header */}
      <div className="p-3 border-b" style={{ borderTopWidth: 3, borderTopColor: stage.color }}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm truncate">{stage.name}</span>
          <span className="text-xs text-muted-foreground">{leads.length}</span>
        </div>
        {totalValue > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
        )}
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2 min-h-[60px]">
          {leads.map(lead => {
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
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
