import { Badge } from '@/components/ui/badge';
import type { LeadPriority } from '@/types';

const config: Record<LeadPriority, { label: string; className: string }> = {
  low: { label: 'Baixa', className: 'bg-muted text-muted-foreground border-muted' },
  medium: { label: 'Média', className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' },
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' },
};

export function PriorityBadge({ priority }: { priority: LeadPriority }) {
  const c = config[priority] || config.medium;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}
