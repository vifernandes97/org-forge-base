import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Stage } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2 } from 'lucide-react';
import { useUpdateStage, useDeleteStage } from '@/hooks/useStages';
import { toast } from 'sonner';

interface StageItemProps {
  stage: Stage;
  canEdit: boolean;
  isOnly: boolean;
}

export function StageItem({ stage, canEdit, isOnly }: StageItemProps) {
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color);
  const [slaHours, setSlaHours] = useState(stage.sla_hours?.toString() || '');
  const [webhookUrl, setWebhookUrl] = useState(stage.webhook_url || '');
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const save = (updates: Partial<Pick<Stage, 'name' | 'color' | 'sla_hours' | 'webhook_url'>>) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateStage.mutate({ id: stage.id, funnelId: stage.funnel_id, ...updates });
    }, 500);
  };

  const handleDelete = () => {
    if (isOnly) {
      toast.error('Não é possível deletar a última etapa');
      return;
    }
    deleteStage.mutate({ id: stage.id, funnelId: stage.funnel_id });
  };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 lg:flex-nowrap">
      {canEdit && (
        <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <input
        type="color"
        value={color}
        disabled={!canEdit}
        className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 p-0"
        onChange={(e) => { setColor(e.target.value); save({ color: e.target.value }); }}
      />

      <Input
        value={name}
        disabled={!canEdit}
        className="flex-1 min-w-0"
        placeholder="Nome da etapa"
        onChange={(e) => { setName(e.target.value); save({ name: e.target.value }); }}
      />

      <Input
        value={slaHours}
        disabled={!canEdit}
        className="w-20"
        type="number"
        min={0}
        placeholder="SLA (h)"
        onChange={(e) => {
          setSlaHours(e.target.value);
          const val = e.target.value ? parseInt(e.target.value) : null;
          save({ sla_hours: val });
        }}
      />

      <Input
        value={webhookUrl}
        disabled={!canEdit}
        className="max-lg:order-last max-lg:basis-full lg:w-48"
        placeholder="Webhook URL"
        onChange={(e) => { setWebhookUrl(e.target.value); save({ webhook_url: e.target.value || null }); }}
      />

      {canEdit && (
        <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isOnly} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
