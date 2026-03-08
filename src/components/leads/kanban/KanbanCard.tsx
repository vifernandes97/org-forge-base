import { useDraggable } from '@dnd-kit/core';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/leads/StatusBadge';
import { formatStageTime } from '@/lib/formatStageTime';
import type { LeadWithRelations, LeadPriority } from '@/types';

const priorityDotColor: Record<LeadPriority, string> = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

interface KanbanCardProps {
  lead: LeadWithRelations;
  onClick: () => void;
  slaExceeded?: boolean;
}

export function KanbanCard({ lead, onClick, slaExceeded }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const tags = lead.tags || [];
  const visibleTags = tags.slice(0, 2);
  const extraTags = tags.length - 2;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing transition-shadow space-y-2 ${isDragging ? 'opacity-50 shadow-lg' : 'hover:shadow-md'}`}
      onClick={e => { e.stopPropagation(); onClick(); }}
    >
      {/* Row 1: name + priority dot */}
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDotColor[lead.priority] || priorityDotColor.medium}`} />
        <span className="font-medium text-sm truncate flex-1">{lead.name}</span>
        {lead.assigned_profile && (
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarFallback className="text-[9px]">{lead.assigned_profile.full_name?.[0] || '?'}</AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Row 2: company + value */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {lead.company ? <span className="truncate">{lead.company}</span> : <span />}
        {lead.value > 0 && (
          <span className="font-medium text-foreground whitespace-nowrap">
            R$ {Number(lead.value).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </span>
        )}
      </div>

      {/* Row 3: status + tags + stage time */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-1 overflow-hidden items-center">
          {lead.status && lead.status !== 'open' && (
            <StatusBadge status={lead.status} size="sm" />
          )}
          {visibleTags.map(t => (
            <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
          ))}
          {extraTags > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{extraTags}</Badge>
          )}
        </div>
        <span className={`text-[10px] whitespace-nowrap ${slaExceeded ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
          {formatStageTime(lead.stage_entered_at)}
        </span>
      </div>
    </div>
  );
}
