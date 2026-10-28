import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PriorityBadge } from '@/components/leads/PriorityBadge';
import { TaskTypeIcon } from './TaskTypeIcon';
import { OrbiStatusBadge } from './OrbiStatusBadge';
import { formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TaskWithRelations } from '@/types';
import { cn } from '@/lib/utils';
import { getLeadDisplay } from '@/lib/leadDisplay';

interface TaskItemProps {
  task: TaskWithRelations;
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
  showLead?: boolean;
  onLeadClick?: (leadId: string) => void;
}

export function TaskItem({ task, onComplete, onUncomplete, showLead, onLeadClick }: TaskItemProps) {
  const isCompleted = !!task.completed_at;
  const isOverdue = !isCompleted && isPast(new Date(task.due_date));

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border transition-colors',
      isOverdue && 'border-destructive/50 bg-destructive/5',
      isCompleted && 'opacity-60',
    )}>
      <Checkbox
        checked={isCompleted}
        onCheckedChange={(checked) => {
          if (checked) onComplete(task.id);
          else onUncomplete(task.id);
        }}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start gap-2">
          <TaskTypeIcon type={task.task_type} className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className={cn('text-sm font-medium break-words', isCompleted && 'line-through text-muted-foreground')}>
            {task.title}
          </span>
        </div>
        {showLead && task.lead && (
          <button
            onClick={() => onLeadClick?.(task.lead!.id)}
            className="text-xs text-primary hover:underline truncate block"
          >
            {getLeadDisplay(task.lead).title}
          </button>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs', isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
            {isOverdue ? 'Atrasada • ' : ''}
            {formatDistanceToNow(new Date(task.due_date), { addSuffix: true, locale: ptBR })}
          </span>
          {task.subtype && <Badge variant="secondary" className="text-[10px]">{task.subtype.label}</Badge>}
          <PriorityBadge priority={task.priority} />
          <OrbiStatusBadge task={task} />
          {task.assigned_profile && (
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px]">
                {task.assigned_profile.full_name?.[0]}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}
