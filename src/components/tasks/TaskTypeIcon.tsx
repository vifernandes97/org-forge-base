import { RefreshCw, Phone, Mail, Calendar, Circle } from 'lucide-react';
import type { TaskType } from '@/types';

const config: Record<TaskType, { icon: typeof RefreshCw; color: string }> = {
  follow_up: { icon: RefreshCw, color: 'text-blue-500' },
  call: { icon: Phone, color: 'text-green-500' },
  email: { icon: Mail, color: 'text-blue-400' },
  meeting: { icon: Calendar, color: 'text-purple-500' },
  other: { icon: Circle, color: 'text-muted-foreground' },
};

export function TaskTypeIcon({ type, className = 'h-4 w-4' }: { type: TaskType; className?: string }) {
  const { icon: Icon, color } = config[type] || config.other;
  return <Icon className={`${className} ${color}`} />;
}
