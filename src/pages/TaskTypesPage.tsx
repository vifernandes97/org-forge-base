/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas novas ainda fora de integrations/supabase/types.ts */
import { useState } from 'react';
import { ListTodo, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskTypeIcon } from '@/components/tasks/TaskTypeIcon';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useTaskTypes, useTaskSubtypes, useTaskSubtypeUsage, useUpdateTaskType, useAddTaskSubtype, useUpdateTaskSubtype, useDeleteTaskSubtype,
} from '@/hooks/useTaskTypes';
import type { TaskTypeAction } from '@/types';

const actionLabels: Record<TaskTypeAction, string | null> = {
  none: null,
  orbi_meeting: 'Dispara reunião no Orbi',
  orbi_ticket: 'Dispara ticket no Orbi',
};

type Editing = { kind: 'type'; id: string; label: string } | { kind: 'subtype'; id: string | null; typeId: string; label: string };

export default function TaskTypesPage() {
  const { isOwner, isAdmin } = useOrganization();
  const canManage = isOwner || isAdmin;
  const { data: types, isLoading } = useTaskTypes();
  const { data: subtypes } = useTaskSubtypes();
  const { data: usage } = useTaskSubtypeUsage();
  const updateType = useUpdateTaskType();
  const addSub = useAddTaskSubtype();
  const updateSub = useUpdateTaskSubtype();
  const delSub = useDeleteTaskSubtype();
  const [editing, setEditing] = useState<Editing | null>(null);

  const run = async (p: Promise<any>, ok?: string) => {
    try { await p; if (ok) toast.success(ok); return true; } catch (e: any) { toast.error(e?.message || 'Erro'); return false; }
  };

  const save = async () => {
    const label = editing?.label.trim();
    if (!editing || !label) return;
    let ok: boolean;
    if (editing.kind === 'type') {
      ok = await run(updateType.mutateAsync({ id: editing.id, updates: { label } }), 'Tipo renomeado');
    } else if (editing.id) {
      ok = await run(updateSub.mutateAsync({ id: editing.id, updates: { label } }), 'Subtipo renomeado');
    } else {
      const position = Math.max(0, ...(subtypes || []).filter(s => s.task_type_id === editing.typeId).map(s => s.position)) + 1;
      ok = await run(addSub.mutateAsync({ typeId: editing.typeId, label, position }), 'Subtipo criado');
    }
    if (ok) setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ListTodo className="h-6 w-6" /> Tipos de tarefa</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tipos e subtipos disponíveis nas tarefas deste workspace. Os tipos de Reunião e Ticket vão disparar integrações com o Orbi.
          {!canManage && ' Somente proprietários e administradores podem editar.'}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <div className="space-y-3">
          {(types || []).map(type => {
            const subs = (subtypes || []).filter(s => s.task_type_id === type.id);
            const action = actionLabels[type.action];
            return (
              <div key={type.id} className="rounded-lg border bg-card">
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Switch checked={type.is_active} disabled={!canManage}
                      onCheckedChange={v => run(updateType.mutateAsync({ id: type.id, updates: { is_active: v } }))} aria-label="Ativo" />
                    <TaskTypeIcon type={type.code} className="h-4 w-4 shrink-0" />
                    <span className={type.is_active ? 'truncate font-medium' : 'truncate font-medium text-muted-foreground line-through'}>{type.label}</span>
                    {action && <Badge variant="secondary" className="shrink-0 max-sm:hidden">{action}</Badge>}
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="icon" aria-label="Renomear tipo"
                      onClick={() => setEditing({ kind: 'type', id: type.id, label: type.label })}><Pencil className="h-4 w-4" /></Button>
                  )}
                </div>
                <div className="space-y-1 border-t px-3 py-2">
                  {subs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum subtipo.</p>}
                  {subs.map(sub => {
                    const count = usage?.[sub.id] || 0;
                    return (
                      <div key={sub.id} className="flex items-center justify-between gap-2 pl-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <Switch checked={sub.is_active} disabled={!canManage}
                            onCheckedChange={v => run(updateSub.mutateAsync({ id: sub.id, updates: { is_active: v } }))} aria-label="Ativo" />
                          <span className={sub.is_active ? 'truncate text-sm' : 'truncate text-sm text-muted-foreground line-through'}>{sub.label}</span>
                          <Badge variant="outline" className="shrink-0 text-[10px]">{count} tarefa{count === 1 ? '' : 's'}</Badge>
                        </div>
                        {canManage && (
                          <div className="flex shrink-0 items-center">
                            <Button variant="ghost" size="icon" aria-label="Renomear subtipo"
                              onClick={() => setEditing({ kind: 'subtype', id: sub.id, typeId: type.id, label: sub.label })}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Excluir subtipo"
                              disabled={count > 0} title={count > 0 ? 'Em uso: desative em vez de excluir' : 'Excluir'}
                              onClick={() => run(delSub.mutateAsync(sub.id), 'Subtipo excluído')}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {canManage && (
                    <Button variant="ghost" size="sm" className="ml-4 h-7 text-xs"
                      onClick={() => setEditing({ kind: 'subtype', id: null, typeId: type.id, label: '' })}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Novo subtipo
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editing?.kind === 'type' ? 'Renomear tipo' : editing?.id ? 'Renomear subtipo' : 'Novo subtipo'}
            </DialogTitle>
          </DialogHeader>
          <Input autoFocus value={editing?.label || ''} maxLength={60}
            onChange={e => setEditing(prev => prev && { ...prev, label: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && save()} placeholder="Nome" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={!editing?.label.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
