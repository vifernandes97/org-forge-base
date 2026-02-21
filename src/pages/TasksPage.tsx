import { useState, useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useMyTasks } from '@/hooks/useTasks';
import { useCompleteTask, useUncompleteTask } from '@/hooks/useTasks';
import { useOrganization } from '@/contexts/OrganizationContext';
import { TaskItem } from '@/components/tasks/TaskItem';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { isToday, isTomorrow, isThisWeek, isAfter, isBefore, startOfDay, endOfDay, addWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import type { TaskWithRelations } from '@/types';

type TaskGroup = { label: string; tasks: TaskWithRelations[]; color?: string };

function groupTasks(tasks: TaskWithRelations[]): TaskGroup[] {
  const now = new Date();
  const groups: TaskGroup[] = [
    { label: 'Atrasadas', tasks: [], color: 'text-destructive' },
    { label: 'Hoje', tasks: [] },
    { label: 'Amanhã', tasks: [] },
    { label: 'Esta semana', tasks: [] },
    { label: 'Próxima semana', tasks: [] },
    { label: 'Futuro', tasks: [] },
    { label: 'Concluídas', tasks: [] },
  ];

  const nextWeekStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });

  for (const task of tasks) {
    if (task.completed_at) {
      groups[6].tasks.push(task);
      continue;
    }
    const due = new Date(task.due_date);
    if (isBefore(due, now)) groups[0].tasks.push(task);
    else if (isToday(due)) groups[1].tasks.push(task);
    else if (isTomorrow(due)) groups[2].tasks.push(task);
    else if (isThisWeek(due, { weekStartsOn: 1 })) groups[3].tasks.push(task);
    else if (isAfter(due, nextWeekStart) && isBefore(due, nextWeekEnd)) groups[4].tasks.push(task);
    else groups[5].tasks.push(task);
  }

  return groups.filter(g => g.tasks.length > 0);
}

export default function TasksPage() {
  const { data: tasks, isLoading } = useMyTasks();
  const complete = useCompleteTask();
  const uncomplete = useUncompleteTask();
  const { organization } = useOrganization();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const groups = useMemo(() => groupTasks(tasks || []), [tasks]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tarefas</h1>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500/50" />
          <p className="font-medium">Tudo em dia!</p>
          <p className="text-sm text-muted-foreground">Nenhuma tarefa pendente.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <Collapsible key={group.label} defaultOpen={group.label !== 'Concluídas'}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:-rotate-90" />
                <span className={cn('font-semibold text-sm', group.color)}>{group.label}</span>
                <span className="text-xs text-muted-foreground">({group.tasks.length})</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {group.tasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    showLead
                    onLeadClick={setSelectedLeadId}
                    onComplete={(id) => complete.mutate({ taskId: id, leadId: task.lead_id, orgId: task.organization_id, title: task.title })}
                    onUncomplete={(id) => uncomplete.mutate({ taskId: id, leadId: task.lead_id })}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      <LeadDetailSheet leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
    </div>
  );
}
