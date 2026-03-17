import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { LeadWithRelations, LeadPriority } from '@/types';

const priorityDotColor: Record<LeadPriority, string> = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

export function DragOverlayCard({ lead }: { lead: LeadWithRelations }) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-xl w-[260px] space-y-2 rotate-2">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDotColor[lead.priority] || priorityDotColor.medium}`} />
        <span className="font-medium text-sm truncate flex-1">{lead.name}</span>
        {lead.assigned_profile && (
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarFallback className="text-[9px]">{lead.assigned_profile.full_name?.[0] || '?'}</AvatarFallback>
          </Avatar>
        )}
      </div>
      {((lead as any).company_name || lead.company) && <p className="text-xs text-muted-foreground truncate">{(lead as any).company_name || lead.company}</p>}
      {lead.value > 0 && (
        <p className="text-xs font-medium">R$ {Number(lead.value).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
      )}
    </div>
  );
}
