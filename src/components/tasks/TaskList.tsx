import { useLeadTasks, useCompleteTask, useUncompleteTask } from '@/hooks/useTasks';
import { useOrganization } from '@/contexts/OrganizationContext';
import { TaskItem } from './TaskItem';
import { Skeleton } from '@/components/ui/skeleton';

interface TaskListProps {
  leadId: string;
}

export function TaskList({ leadId }: TaskListProps) {
  const { data: tasks, isLoading } = useLeadTasks(leadId);
  const complete = useCompleteTask();
  const uncomplete = useUncompleteTask();
  const { organization } = useOrganization();

  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;

  if (!tasks?.length) return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa cadastrada</p>;

  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          onComplete={(id) => complete.mutate({ taskId: id, leadId, orgId: organization!.id, title: task.title })}
          onUncomplete={(id) => uncomplete.mutate({ taskId: id, leadId })}
        />
      ))}
    </div>
  );
}
