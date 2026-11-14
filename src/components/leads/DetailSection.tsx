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
    <section className={cn('min-w-0 rounded-xl border bg-card', className)}>
      <header className="flex min-h-11 items-center justify-between gap-2 border-b px-4 py-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
          {title}
        </h3>
        {action}
      </header>
      <div className={cn('space-y-1.5 p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
