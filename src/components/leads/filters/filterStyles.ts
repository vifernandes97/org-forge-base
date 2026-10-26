import { cn } from '@/lib/utils';

/** Toolbar filter trigger (deals, companies, contacts): rounded pill, tinted when active. */
export const filterPillClass = (active: boolean) =>
  cn(
    'h-9 gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
    active && 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
  );

/** Full-width trigger used inside the filters panel. */
export const filterFieldClass = (active: boolean) =>
  cn('h-9 w-full justify-between gap-2 px-3 text-sm font-normal', !active && 'text-muted-foreground');

/** Toolbar search input. */
export const filterSearchClass =
  'h-9 pl-9 text-sm bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-input';
