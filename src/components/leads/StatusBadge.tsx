import { Badge } from '@/components/ui/badge';
import { Trophy, Play, XCircle } from 'lucide-react';
import type { LeadStatus } from '@/types';

const statusConfig: Record<LeadStatus, { label: string; icon: React.ElementType; className: string }> = {
  open: {
    label: 'Em andamento',
    icon: Play,
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  won: {
    label: 'Ganho',
    icon: Trophy,
    className: 'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400',
  },
  inactive: {
    label: 'Inativo',
    icon: XCircle,
    className: 'bg-muted text-muted-foreground border-muted',
  },
};

interface StatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'default';
}

export function StatusBadge({ status, size = 'default' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.open;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`gap-1 ${config.className} ${size === 'sm' ? 'text-[10px] px-1.5 py-0' : ''}`}>
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {config.label}
    </Badge>
  );
}
