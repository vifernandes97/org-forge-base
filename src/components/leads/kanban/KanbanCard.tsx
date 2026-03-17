import { useDraggable } from '@dnd-kit/core';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing transition-shadow space-y-1.5 ${isDragging ? 'opacity-50 shadow-lg' : 'hover:shadow-md'}`}
      onClick={e => { e.stopPropagation(); onClick(); }}
    >
      {/* Row 1: company_name + priority dot + avatar */}
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDotColor[lead.priority] || priorityDotColor.medium}`} />
        <span className="font-medium text-sm truncate flex-1">{lead.company_name || lead.name}</span>
        {lead.assigned_profile && (
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarFallback className="text-[9px]">{lead.assigned_profile.full_name?.[0] || '?'}</AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Row 2: company */}
      {lead.company && (
        <p className="text-xs text-muted-foreground truncate pl-4">{lead.company}</p>
      )}

      {/* Row 3: created_at relative */}
      <p className="text-[10px] text-muted-foreground text-right">
        {formatStageTime(lead.created_at)}
      </p>
    </div>
  );
}
