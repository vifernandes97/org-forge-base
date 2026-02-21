import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getLeadTasks, getMyTasks, getTaskBadgeCounts, createTask, updateTask, completeTask, uncompleteTask } from '@/services/tasks';
import { createActivity } from '@/services/activities';

export function useLeadTasks(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-tasks', leadId],
    queryFn: () => getLeadTasks(leadId!),
    enabled: !!leadId,
  });
}

export function useMyTasks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-tasks', user?.id],
    queryFn: () => getMyTasks(user!.id),
    enabled: !!user?.id,
  });
}

export function useTaskBadgeCounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['task-badge-counts', user?.id],
    queryFn: () => getTaskBadgeCounts(user!.id),
    enabled: !!user?.id,
    refetchInterval: 60000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: createTask,
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: ['lead-tasks', task.lead_id] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['task-badge-counts'] });
      if (user && organization) {
        createActivity({
          organization_id: task.organization_id,
          lead_id: task.lead_id,
          user_id: user.id,
          activity_type: 'task_created',
          title: `Criou tarefa: ${task.title}`,
        }).then(() => {
          qc.invalidateQueries({ queryKey: ['lead-activities', task.lead_id] });
        });
      }
    },
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; leadId: string; orgId: string; title: string }) =>
      completeTask(taskId),
    onSuccess: (task, vars) => {
      qc.invalidateQueries({ queryKey: ['lead-tasks', vars.leadId] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['task-badge-counts'] });
      if (user) {
        createActivity({
          organization_id: vars.orgId,
          lead_id: vars.leadId,
          user_id: user.id,
          activity_type: 'task_completed',
          title: `Concluiu tarefa: ${vars.title}`,
        }).then(() => {
          qc.invalidateQueries({ queryKey: ['lead-activities', vars.leadId] });
        });
      }
    },
  });
}

export function useUncompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; leadId: string }) =>
      uncompleteTask(taskId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead-tasks', vars.leadId] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['task-badge-counts'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any; leadId: string }) =>
      updateTask(id, updates),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead-tasks', vars.leadId] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['task-badge-counts'] });
    },
  });
}
