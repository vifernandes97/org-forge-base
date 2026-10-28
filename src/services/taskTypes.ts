import { supabase } from '@/integrations/supabase/client';
import type { TaskTypeDef, TaskSubtype } from '@/types';

const db = supabase as any;

export async function getTaskTypes(orgId: string): Promise<TaskTypeDef[]> {
  const { data, error } = await db.from('task_types').select('*').eq('organization_id', orgId).order('position').order('label');
  if (error) throw error;
  return (data || []) as TaskTypeDef[];
}

export async function getTaskSubtypes(orgId: string): Promise<TaskSubtype[]> {
  const { data, error } = await db.from('task_subtypes').select('*').eq('organization_id', orgId).order('position').order('label');
  if (error) throw error;
  return (data || []) as TaskSubtype[];
}

export async function updateTaskType(id: string, updates: Partial<Pick<TaskTypeDef, 'label' | 'is_active'>>) {
  const { error } = await db.from('task_types').update(updates).eq('id', id);
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um tipo com esse nome');
    throw error;
  }
}

export async function addTaskSubtype(orgId: string, typeId: string, label: string, position: number) {
  const { error } = await db.from('task_subtypes').insert({ organization_id: orgId, task_type_id: typeId, label, position });
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um subtipo com esse nome neste tipo');
    throw error;
  }
}

export async function updateTaskSubtype(id: string, updates: Partial<Pick<TaskSubtype, 'label' | 'is_active'>>) {
  const { error } = await db.from('task_subtypes').update(updates).eq('id', id);
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um subtipo com esse nome neste tipo');
    throw error;
  }
}

export async function deleteTaskSubtype(id: string) {
  const { error } = await db.from('task_subtypes').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') throw new Error('Há tarefas usando este subtipo; desative-o em vez de excluir');
    throw error;
  }
}

export async function getTaskSubtypeUsage(orgId: string): Promise<Record<string, number>> {
  const { data, error } = await db.from('tasks').select('task_subtype_id').eq('organization_id', orgId).not('task_subtype_id', 'is', null);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const r of (data || []) as any[]) out[r.task_subtype_id] = (out[r.task_subtype_id] || 0) + 1;
  return out;
}
