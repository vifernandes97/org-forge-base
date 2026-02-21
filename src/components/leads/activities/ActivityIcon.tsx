import { MessageSquare, Phone, Mail, Calendar, ArrowRight, Edit, CheckSquare, CheckCircle } from 'lucide-react';
import type { ActivityType } from '@/types';

const config: Record<ActivityType, { icon: React.ElementType; color: string; bg: string }> = {
  note: { icon: MessageSquare, color: 'text-muted-foreground', bg: 'bg-muted' },
  call: { icon: Phone, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  email: { icon: Mail, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  meeting: { icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  stage_change: { icon: ArrowRight, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  field_update: { icon: Edit, color: 'text-muted-foreground', bg: 'bg-muted' },
  task_created: { icon: CheckSquare, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  task_completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
};

export function ActivityIcon({ type }: { type: ActivityType }) {
  const { icon: Icon, color, bg } = config[type] || config.note;
  return (
    <div className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${bg}`}>
      <Icon className={`h-4 w-4 ${color}`} />
    </div>
  );
}
