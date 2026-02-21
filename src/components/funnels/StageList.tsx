import { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { Stage } from '@/types';
import { StageItem } from './StageItem';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useCreateStage, useReorderStages } from '@/hooks/useStages';

interface StageListProps {
  stages: Stage[];
  funnelId: string;
  organizationId: string;
  canEdit: boolean;
}

export function StageList({ stages, funnelId, organizationId, canEdit }: StageListProps) {
  const [items, setItems] = useState(stages);
  const createStage = useCreateStage();
  const reorderStages = useReorderStages();

  // Sync from parent when stages change
  if (stages.length !== items.length || stages.some((s, i) => s.id !== items[i]?.id)) {
    setItems(stages);
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(s => s.id === active.id);
    const newIndex = items.findIndex(s => s.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);

    const reordered = newItems.map((s, i) => ({ id: s.id, position: i }));
    reorderStages.mutate({ funnelId, stages: reordered });
  };

  const handleAddStage = () => {
    createStage.mutate({
      funnel_id: funnelId,
      organization_id: organizationId,
      name: 'Nova Etapa',
      color: '#3B82F6',
      position: items.length,
    });
  };

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {items.map((stage) => (
            <StageItem key={stage.id} stage={stage} canEdit={canEdit} isOnly={items.length <= 1} />
          ))}
        </SortableContext>
      </DndContext>

      {canEdit && (
        <Button variant="outline" className="w-full" onClick={handleAddStage} disabled={createStage.isPending}>
          <Plus className="h-4 w-4 mr-2" />Adicionar Etapa
        </Button>
      )}
    </div>
  );
}
