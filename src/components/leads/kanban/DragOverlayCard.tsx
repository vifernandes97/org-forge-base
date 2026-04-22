import { Star, Clock } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatStageTime } from '@/lib/formatStageTime';
import { avatarColorFromId } from '@/lib/avatarColor';
import type { LeadWithRelations } from '@/types';

export function DragOverlayCard({ lead }: { lead: LeadWithRelations }) {
  const qualification = lead.qualification ?? 0;
  const assigneeColors = avatarColorFromId(lead.assigned_to);
  const isHighPriority = lead.priority === 'high' || lead.priority === 'urgent';
  const priorityColor =
    lead.priority === 'urgent'
      ? 'hsl(0, 80%, 55%)'
      : lead.priority === 'high'
      ? 'hsl(25, 95%, 55%)'
      : undefined;

  return (
    <div
      className="rounded-lg border bg-card p-3 shadow-2xl w-[280px] space-y-1.5 rotate-2 ring-1 ring-primary/20"
      style={
        isHighPriority && priorityColor
          ? { borderLeftColor: priorityColor, borderLeftWidth: 2 }
          : undefined
      }
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm truncate flex-1">{lead.company_name || lead.name}</span>
        {lead.assigned_profile && (
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarFallback
              className="text-[9px] font-medium"
              style={{ backgroundColor: assigneeColors.bg, color: assigneeColors.fg }}
            >
              {lead.assigned_profile.full_name?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      {lead.company && (
        <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        {qualification > 0 ? (
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${i < qualification ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
              />
            ))}
          </div>
        ) : <span />}
        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {formatStageTime(lead.created_at)}
        </span>
      </div>
    </div>
  );
}
