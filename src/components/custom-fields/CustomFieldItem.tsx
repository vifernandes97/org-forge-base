import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CustomFieldDefinition } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { FieldTypeIcon, getFieldTypeLabel } from './FieldTypeIcon';
import { CustomFieldDialog } from './CustomFieldDialog';
import { useUpdateCustomField, useDeleteCustomField } from '@/hooks/useCustomFields';
import { toast } from 'sonner';

interface CustomFieldItemProps {
  field: CustomFieldDefinition;
  canEdit: boolean;
}

export function CustomFieldItem({ field, canEdit }: CustomFieldItemProps) {
  const updateField = useUpdateCustomField();
  const deleteField = useDeleteCustomField();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = (data: any) => {
    updateField.mutate({ id: field.id, ...data }, {
      onSuccess: () => toast.success('Campo atualizado'),
      onError: (err: any) => toast.error(err.message || 'Erro ao atualizar'),
    });
  };

  const handleDelete = () => {
    deleteField.mutate(field.id, {
      onSuccess: () => toast.success('Campo removido'),
      onError: (err: any) => toast.error(err.message || 'Erro ao remover'),
    });
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-lg border bg-card p-3">
      {canEdit && (
        <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
        <FieldTypeIcon type={field.field_type} className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{field.field_label}</span>
          <span className="text-xs text-muted-foreground font-mono">{field.field_name}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge variant="outline" className="text-xs">{getFieldTypeLabel(field.field_type)}</Badge>
          {field.is_required && <Badge variant="default" className="text-xs">Obrigatório</Badge>}
          {!field.is_active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
        </div>
      </div>

      {canEdit && (
        <div className="flex gap-1">
          <CustomFieldDialog
            field={field}
            trigger={
              <Button variant="ghost" size="icon">
                <Pencil className="h-4 w-4" />
              </Button>
            }
            onSave={handleSave}
            isPending={updateField.isPending}
          />
          <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
