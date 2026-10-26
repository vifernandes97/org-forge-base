import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, ClipboardList } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TasksCardProps {
  pending?: number;
  overdue?: number;
  isLoading: boolean;
}

/** Open and overdue tasks, linking to the tasks page. */
export default function TasksCard({ pending = 0, overdue = 0, isLoading }: TasksCardProps) {
  const rows = [
    { label: 'Tarefas pendentes', value: pending, icon: ClipboardList, tone: pending ? 'text-blue-500 bg-blue-500/10' : 'text-muted-foreground bg-muted' },
    { label: 'Tarefas atrasadas', value: overdue, icon: AlertTriangle, tone: overdue ? 'text-destructive bg-destructive/10' : 'text-muted-foreground bg-muted' },
  ];

  return (
    <Card className="divide-y">
      {rows.map(r => (
        <Link key={r.label} to="/tasks" className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/40">
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', r.tone)}>
            <r.icon className="h-4 w-4" />
          </span>
          <span className="flex-1 text-sm text-muted-foreground">{r.label}</span>
          {isLoading ? <Skeleton className="h-6 w-8" /> : (
            <span className={cn('text-xl font-bold tabular-nums', r.label.includes('atrasadas') && overdue > 0 && 'text-destructive')}>{r.value}</span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      ))}
    </Card>
  );
}
