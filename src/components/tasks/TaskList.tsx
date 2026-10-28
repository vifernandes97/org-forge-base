import { useLeadTasks, useCompleteTask, useUncompleteTask } from '@/hooks/useTasks';
import { useOrganization } from '@/contexts/OrganizationContext';
import { TaskItem } from './TaskItem';
import { TaskTypeIcon } from './TaskTypeIcon';
import { useTaskTypes } from '@/hooks/useTaskTypes';
import { Skeleton } from '@/components/ui/skeleton';

interface TaskListProps {
  leadId: string;
}

export function TaskList({ leadId }: TaskListProps) {
  const { data: tasks, isLoading } = useLeadTasks(leadId);
  const complete = useCompleteTask();
  const uncomplete = useUncompleteTask();
  const { organization } = useOrganization();
  const { data: types } = useTaskTypes();

  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;

  if (!tasks?.length) return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa cadastrada</p>;

  // Agrupa na ordem do cadastro de tipos; tipo desconhecido cai no fim.
  const order = new Map((types || []).map((t, i) => [t.code, i]));
  const labels = new Map((types || []).map(t => [t.code, t.label]));
  const groups = new Map<string, typeof tasks>();
  for (const task of tasks) groups.set(task.task_type, [...(groups.get(task.task_type) || []), task]);
  const codes = [...groups.keys()].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));

  return (
    <div className="space-y-4">
      {codes.map(code => (
        <section key={code} className="space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <TaskTypeIcon type={code} className="h-3.5 w-3.5" />
            {labels.get(code) || code}
            <span className="font-normal">({groups.get(code)!.length})</span>
          </h3>
          {groups.get(code)!.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onComplete={(id) => complete.mutate({ taskId: id, leadId, orgId: organization!.id, title: task.title })}
              onUncomplete={(id) => uncomplete.mutate({ taskId: id, leadId })}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
