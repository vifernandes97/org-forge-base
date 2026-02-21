import { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { CustomFieldDefinition } from '@/types';
import { CustomFieldItem } from './CustomFieldItem';
import { useReorderCustomFields } from '@/hooks/useCustomFields';

interface CustomFieldListProps {
  fields: CustomFieldDefinition[];
  canEdit: boolean;
}

export function CustomFieldList({ fields, canEdit }: CustomFieldListProps) {
  const [items, setItems] = useState(fields);
  const reorder = useReorderCustomFields();

  if (fields.length !== items.length || fields.some((f, i) => f.id !== items[i]?.id)) {
    setItems(fields);
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(f => f.id === active.id);
    const newIndex = items.findIndex(f => f.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);

    reorder.mutate(newItems.map((f, i) => ({ id: f.id, position: i })));
  };

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(f => f.id)} strategy={verticalListSortingStrategy}>
          {items.map(field => (
            <CustomFieldItem key={field.id} field={field} canEdit={canEdit} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
