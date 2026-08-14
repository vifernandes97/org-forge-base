import { useDraggable } from '@dnd-kit/core';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatStageTime } from '@/lib/formatStageTime';
import { avatarColorFromId } from '@/lib/avatarColor';
import { useUpdateLead } from '@/hooks/useLeads';
import { useCustomFields } from '@/hooks/useCustomFields';
import { StarRating } from './StarRating';
import { Clock } from 'lucide-react';
import type { LeadWithRelations } from '@/types';

interface KanbanCardProps {
  lead: LeadWithRelations;
  onClick: () => void;
  slaExceeded?: boolean;
}

export function KanbanCard({ lead, onClick, slaExceeded }: KanbanCardProps) {
  const updateLead = useUpdateLead();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.phone) return;
    const digits = lead.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${digits}`, '_blank');
  };

  const qualification = lead.qualification ?? 0;
  const isHighPriority = lead.priority === 'high' || lead.priority === 'urgent';
  const priorityColor =
    lead.priority === 'urgent'
      ? 'hsl(0, 80%, 55%)'
      : lead.priority === 'high'
      ? 'hsl(25, 95%, 55%)'
      : undefined;

  const { data: customFields } = useCustomFields();
  const businessType = (() => {
    const norm = (s?: string | null) =>
      (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    const def = customFields?.find(f => norm(f.field_name) === 'tipodenegocio' || norm(f.field_label) === 'tipodenegocio');
    if (!def) return null;
    const v = lead.custom_field_values?.find(cv => cv.field_definition_id === def.id)?.value;
    if (!v) return null;
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.join(', ') || null;
    } catch { /* plain string */ }
    return v;
  })();

  const assigneeColors = avatarColorFromId(lead.assigned_to);
  const tags = lead.tags || [];
  const visibleTags = tags.slice(0, 2);
  const extraTags = tags.length - visibleTags.length;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        ...style,
        ...(isHighPriority && priorityColor ? { borderLeftColor: priorityColor, borderLeftWidth: 2 } : {}),
      }}
      className={`group rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing transition-all space-y-1.5 ${
        isDragging
          ? 'opacity-50 shadow-lg'
          : 'hover:shadow-md hover:border-primary/20 hover:-translate-y-px'
      }`}
      onClick={e => { e.stopPropagation(); onClick(); }}
    >
      {/* Row 1: identifier + avatar + WhatsApp */}
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm truncate flex-1">{lead.company_name || lead.name}</span>
        {lead.assigned_profile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarFallback
                  className="text-[9px] font-medium"
                  style={{ backgroundColor: assigneeColors.bg, color: assigneeColors.fg }}
                >
                  {lead.assigned_profile.full_name?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{lead.assigned_profile.full_name}</TooltipContent>
          </Tooltip>
        )}
        {lead.phone && (
          <button
            type="button"
            onClick={handleWhatsApp}
            className="shrink-0 text-muted-foreground hover:text-green-600 transition-colors"
            aria-label="Abrir WhatsApp"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Row 2: contact name (when distinct from title) */}
      {lead.name && lead.name !== (lead.company_name || lead.name) && (
        <p className="text-xs text-muted-foreground truncate">{lead.name}</p>
      )}

      {/* Row 3: business type (custom field) */}
      {businessType && (
        <p className="text-xs text-muted-foreground truncate">{businessType}</p>
      )}

      {/* Row 4: whatsapp / phone */}
      {lead.phone && (
        <button
          type="button"
          onClick={handleWhatsApp}
          className="block text-xs text-muted-foreground hover:text-green-600 transition-colors truncate text-left"
        >
          {lead.phone}
        </button>
      )}

      {/* Row 5: stars + relative time */}
      <div className="flex items-center justify-between gap-2">
        <div className={qualification > 0 ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'}>
          <StarRating
            value={qualification}
            onChange={(n) => updateLead.mutate({ id: lead.id, updates: { qualification: n || null } })}
          />
        </div>
        {slaExceeded ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-500 font-medium">
                <Clock className="h-2.5 w-2.5" />
                {formatStageTime(lead.created_at)}

              </span>
            </TooltipTrigger>
            <TooltipContent>Acima do SLA da etapa</TooltipContent>
          </Tooltip>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {formatStageTime(lead.created_at)}

          </span>
        )}
      </div>

      {/* Row 4: tags */}
      {visibleTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap pt-0.5">
          {visibleTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center text-[10px] bg-muted/70 text-foreground/70 rounded px-1.5 py-0.5 truncate max-w-[100px]"
            >
              {tag}
            </span>
          ))}
          {extraTags > 0 && (
            <span className="text-[10px] text-muted-foreground">+{extraTags}</span>
          )}
        </div>
      )}
    </div>
  );
}
