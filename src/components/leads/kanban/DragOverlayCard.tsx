import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatStageTime } from '@/lib/formatStageTime';
import type { LeadWithRelations, LeadPriority } from '@/types';

const priorityDotColor: Record<LeadPriority, string> = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

export function DragOverlayCard({ lead }: { lead: LeadWithRelations }) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-xl w-[260px] space-y-1.5 rotate-2">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDotColor[lead.priority] || priorityDotColor.medium}`} />
        <span className="font-medium text-sm truncate flex-1">{lead.company_name || lead.name}</span>
        {lead.assigned_profile && (
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarFallback className="text-[9px]">{lead.assigned_profile.full_name?.[0] || '?'}</AvatarFallback>
          </Avatar>
        )}
      </div>
      {lead.company && (
        <p className="text-xs text-muted-foreground truncate pl-4">{lead.company}</p>
      )}
      <p className="text-[10px] text-muted-foreground text-right">
        {formatStageTime(lead.created_at)}
      </p>
    </div>
  );
}
