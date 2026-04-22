import { useDraggable } from '@dnd-kit/core';
import { MessageCircle, Star } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatStageTime } from '@/lib/formatStageTime';
import type { LeadWithRelations } from '@/types';

interface KanbanCardProps {
  lead: LeadWithRelations;
  onClick: () => void;
  slaExceeded?: boolean;
}

export function KanbanCard({ lead, onClick }: KanbanCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing transition-shadow space-y-1.5 ${isDragging ? 'opacity-50 shadow-lg' : 'hover:shadow-md'}`}
      onClick={e => { e.stopPropagation(); onClick(); }}
    >
      {/* Row 1: identifier + avatar + WhatsApp */}
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm truncate flex-1">{lead.company_name || lead.name}</span>
        {lead.assigned_profile && (
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarFallback className="text-[9px]">{lead.assigned_profile.full_name?.[0] || '?'}</AvatarFallback>
          </Avatar>
        )}
        {lead.phone && (
          <button
            type="button"
            onClick={handleWhatsApp}
            className="shrink-0 text-muted-foreground hover:text-green-600 transition-colors"
            aria-label="Abrir WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Row 2: company */}
      {lead.company && (
        <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
      )}

      {/* Row 3: stars + relative time */}
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
