import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';
import type { LeadWithRelations } from '@/types';

interface LeadCardProps {
  lead: LeadWithRelations;
  onClick: () => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  return (
    <div
      className="flex items-center gap-4 rounded-lg border p-4 hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{lead.company_name || lead.name}</span>
          <PriorityBadge priority={lead.priority} />
          {lead.status && lead.status !== 'open' && <StatusBadge status={lead.status} />}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {lead.name && lead.company_name && lead.name !== lead.company_name && (
            <span className="truncate">{lead.name}</span>
          )}
          {lead.company && <span className="truncate">{lead.company}</span>}
          {lead.stage && (
            <Badge variant="outline" className="text-xs" style={{ borderColor: lead.stage.color, color: lead.stage.color }}>
              {lead.stage.name}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {lead.value > 0 && (
          <span className="text-sm font-medium">
            R$ {Number(lead.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        )}
        {lead.assigned_profile && (
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">{lead.assigned_profile.full_name?.[0] || '?'}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
