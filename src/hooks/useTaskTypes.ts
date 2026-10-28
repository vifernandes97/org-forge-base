import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  getTaskTypes, getTaskSubtypes, updateTaskType, addTaskSubtype, updateTaskSubtype, deleteTaskSubtype, getTaskSubtypeUsage,
} from '@/services/taskTypes';
import type { TaskTypeDef } from '@/types';

export function useTaskTypes() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({ queryKey: ['task-types', orgId], queryFn: () => getTaskTypes(orgId!), enabled: !!orgId, staleTime: 5 * 60_000 });
}

export function useTaskSubtypes() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({ queryKey: ['task-subtypes', orgId], queryFn: () => getTaskSubtypes(orgId!), enabled: !!orgId, staleTime: 5 * 60_000 });
}

export function useTaskSubtypeUsage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({ queryKey: ['task-subtypes', 'usage', orgId], queryFn: () => getTaskSubtypeUsage(orgId!), enabled: !!orgId });
}

/** Tipos por code, para rotular tarefas e modelos (inclui os inativos). */
export function useTaskTypeMap() {
  const { data } = useTaskTypes();
  return useMemo(() => {
    const map: Record<string, TaskTypeDef> = {};
    for (const t of data || []) map[t.code] = t;
    return map;
  }, [data]);
}

function useConfigMutation<T>(fn: (v: T, orgId: string) => Promise<any>) {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: (v: T) => fn(v, organization!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-types'] });
      qc.invalidateQueries({ queryKey: ['task-subtypes'] });
      qc.invalidateQueries({ queryKey: ['lead-tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });
}

export const useUpdateTaskType = () =>
  useConfigMutation<{ id: string; updates: { label?: string; is_active?: boolean } }>(({ id, updates }) => updateTaskType(id, updates));
export const useAddTaskSubtype = () =>
  useConfigMutation<{ typeId: string; label: string; position: number }>(({ typeId, label, position }, org) => addTaskSubtype(org, typeId, label, position));
export const useUpdateTaskSubtype = () =>
  useConfigMutation<{ id: string; updates: { label?: string; is_active?: boolean } }>(({ id, updates }) => updateTaskSubtype(id, updates));
export const useDeleteTaskSubtype = () => useConfigMutation<string>(id => deleteTaskSubtype(id));
