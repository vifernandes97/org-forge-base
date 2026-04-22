import { Star } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatStageTime } from '@/lib/formatStageTime';
import type { LeadWithRelations } from '@/types';

export function DragOverlayCard({ lead }: { lead: LeadWithRelations }) {
  const qualification = lead.qualification ?? 0;

  return (
    <div className="rounded-lg border bg-card p-3 shadow-xl w-[260px] space-y-1.5 rotate-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm truncate flex-1">{lead.company_name || lead.name}</span>
        {lead.assigned_profile && (
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarFallback className="text-[9px]">{lead.assigned_profile.full_name?.[0] || '?'}</AvatarFallback>
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
        <p className="text-[10px] text-muted-foreground">
          {formatStageTime(lead.created_at)}
        </p>
      </div>
    </div>
  );
}
