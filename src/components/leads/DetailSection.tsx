import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DetailSectionProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Card used to group fields in the deal detail modal. */
export function DetailSection({ title, icon, action, children, className, bodyClassName }: DetailSectionProps) {
  return (
    <section className={cn('rounded-lg border bg-card', className)}>
      <header className="flex h-10 items-center justify-between gap-2 border-b px-4">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {icon}
          {title}
        </h3>
        {action}
      </header>
      <div className={cn('space-y-1.5 p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
