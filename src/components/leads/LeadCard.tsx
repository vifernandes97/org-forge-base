import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';
import type { LeadWithRelations } from '@/types';
import { getLeadDisplay } from '@/lib/leadDisplay';

interface LeadCardProps {
  lead: LeadWithRelations;
  onClick: () => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const { title, segment, primaryContact } = getLeadDisplay(lead);
  return (
    <div
      className="flex items-center gap-4 rounded-lg border p-4 hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{title}</span>
          <PriorityBadge priority={lead.priority} />
          {lead.status && lead.status !== 'open' && <StatusBadge status={lead.status} />}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground min-w-0">
          {primaryContact?.name && primaryContact.name !== title && (
            <span className="truncate min-w-0" title={primaryContact.name}>{primaryContact.name}</span>
          )}
          {segment && <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground shrink-0 max-w-[160px] truncate" title={segment}>{segment}</Badge>}
          {lead.stage && (
            <Badge variant="outline" className="text-xs shrink-0 max-w-[160px] truncate" style={{ borderColor: lead.stage.color, color: lead.stage.color }}>
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
