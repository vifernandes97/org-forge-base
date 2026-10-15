import { useEffect, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Merge, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useSegments, useSegmentUsage, useAddSegment, useUpdateSegment, useDeleteSegment, useReorderSegments, useMergeSegments,
} from '@/hooks/useCompanies';
import type { CompanySegment } from '@/types';

function Row({ seg, count, canManage, onRename, onToggle, onDelete, onMerge }: {
  seg: CompanySegment; count: number; canManage: boolean;
  onRename: () => void; onToggle: (v: boolean) => void; onDelete: () => void; onMerge: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: seg.id, disabled: !canManage });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center justify-between gap-2 p-3 border rounded-lg bg-card">
      <div className="flex items-center gap-3 min-w-0">
        {canManage && (
          <button type="button" className="cursor-grab text-muted-foreground" aria-label="Arrastar" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <Switch checked={seg.is_active} disabled={!canManage} onCheckedChange={onToggle} aria-label="Ativo" />
        <span className={seg.is_active ? 'truncate' : 'truncate text-muted-foreground line-through'}>{seg.label}</span>
        <Badge variant="secondary" className="shrink-0">{count} empresa{count === 1 ? '' : 's'}</Badge>
      </div>
      {canManage && (
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={onRename} aria-label="Renomear"><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={onMerge} aria-label="Mesclar segmento"><Merge className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={onDelete}
            disabled={count > 0} title={count > 0 ? 'Em uso: desative em vez de excluir' : 'Excluir'} aria-label="Excluir">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SegmentsPage() {
  const { isOwner, isAdmin } = useOrganization();
  const canManage = isOwner || isAdmin;
  const { data: segments, isLoading } = useSegments();
  const { data: usage } = useSegmentUsage();
  const add = useAddSegment();
  const update = useUpdateSegment();
  const del = useDeleteSegment();
  const reorder = useReorderSegments();
  const merge = useMergeSegments();
  const [items, setItems] = useState<CompanySegment[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; label: string } | null>(null);
  const [merging, setMerging] = useState<CompanySegment | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => { setItems(segments || []); }, [segments]);

  const run = async (p: Promise<any>, ok?: string) => {
    try { await p; if (ok) toast.success(ok); return true; } catch (e: any) { toast.error(e?.message || 'Erro'); return false; }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldI = items.findIndex(i => i.id === e.active.id);
    const newI = items.findIndex(i => i.id === e.over!.id);
    const next = arrayMove(items, oldI, newI);
    setItems(next);
    run(reorder.mutateAsync(next.map(i => i.id)));
  };

  const saveEdit = async () => {
    if (!editing?.label.trim()) return;
    const ok = editing.id
      ? await run(update.mutateAsync({ id: editing.id, updates: { label: editing.label.trim() } }), 'Segmento renomeado')
      : await run(add.mutateAsync(editing.label.trim()), 'Segmento criado');
    if (ok) setEditing(null);
  };

  const doMerge = async () => {
    if (!merging || !mergeTarget) return;
    if (await run(merge.mutateAsync({ sourceId: merging.id, targetId: mergeTarget }), 'Segmentos mesclados')) {
      setMerging(null); setMergeTarget('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Tag className="h-6 w-6" /> Segmentos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Segmentos disponíveis para as empresas deste workspace.{!canManage && ' Somente proprietários e administradores podem editar.'}
          </p>
        </div>
        {canManage && <Button onClick={() => setEditing({ id: null, label: '' })}><Plus className="h-4 w-4 mr-1" /> Novo segmento</Button>}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-lg p-6 text-center">Nenhum segmento cadastrado.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map(seg => (
                <Row key={seg.id} seg={seg} count={usage?.[seg.id] || 0} canManage={canManage}
                  onRename={() => setEditing({ id: seg.id, label: seg.label })}
                  onToggle={v => run(update.mutateAsync({ id: seg.id, updates: { is_active: v } }))}
                  onDelete={() => run(del.mutateAsync(seg.id), 'Segmento excluído')}
                  onMerge={() => { setMerging(seg); setMergeTarget(''); }} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing?.id ? 'Renomear segmento' : 'Novo segmento'}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input autoFocus value={editing?.label || ''} onChange={e => setEditing(s => s && { ...s, label: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && saveEdit()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={!editing?.label.trim() || add.isPending || update.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!merging} onOpenChange={o => !o && setMerging(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mesclar "{merging?.label}"</DialogTitle>
            <DialogDescription>
              As {usage?.[merging?.id || ''] || 0} empresa(s) deste segmento passam para o segmento escolhido, e "{merging?.label}" fica inativo.
            </DialogDescription>
          </DialogHeader>
          <Select value={mergeTarget} onValueChange={setMergeTarget}>
            <SelectTrigger><SelectValue placeholder="Segmento que recebe as empresas" /></SelectTrigger>
            <SelectContent>
              {items.filter(s => s.id !== merging?.id && s.is_active).map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMerging(null)}>Cancelar</Button>
            <Button onClick={doMerge} disabled={!mergeTarget || merge.isPending}>Mesclar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
