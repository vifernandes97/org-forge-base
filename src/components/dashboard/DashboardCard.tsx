import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DashboardCardProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  isLoading?: boolean;
  className?: string;
  children: ReactNode;
}

/** Shared frame for dashboard panels: title, optional subtitle/action, loading skeleton. */
export default function DashboardCard({ title, description, action, isLoading, className, children }: DashboardCardProps) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1 px-5 pb-5">
        {isLoading ? <Skeleton className="h-[220px] w-full" /> : children}
      </div>
    </Card>
  );
}

export function EmptyChart({ children = 'Nenhum dado no período' }: { children?: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Recharts tooltip in the app's popover style (the default one is white in dark mode). */
export function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: { value: number; name?: string }[];
  label?: string;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {label && <p className="mb-0.5 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          {p.name && <span>{p.name}: </span>}
          <span className="font-semibold text-foreground tabular-nums">{formatter ? formatter(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}
