import { Users, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/formatCurrency';
import { cn } from '@/lib/utils';
import type { DashboardSummary, QualifiedRate } from '@/services/dashboard';

interface SummaryCardsProps {
  summary?: DashboardSummary;
  qualifiedRate?: QualifiedRate;
  isLoading: boolean;
}

interface Kpi {
  title: string;
  value: string;
  icon: typeof Users;
  tone: string;
  delta?: { value: string; positive: boolean };
  hint?: string;
}

export default function SummaryCards({ summary, qualifiedRate, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[100px] rounded-lg sm:h-[112px]" />)}
      </div>
    );
  }

  const newLeads = summary?.new_leads ?? 0;
  const prevLeads = summary?.new_leads_previous ?? 0;
  const variation = prevLeads > 0 ? ((newLeads - prevLeads) / prevLeads) * 100 : newLeads > 0 ? 100 : 0;
  const conversions = summary?.conversion_count ?? 0;
  const conversionRate = newLeads > 0 ? (conversions / newLeads) * 100 : 0;

  const kpis: Kpi[] = [
    {
      title: 'Negócios no período', value: newLeads.toLocaleString('pt-BR'), icon: Users, tone: 'text-blue-500 bg-blue-500/10',
      delta: variation !== 0 ? { value: `${variation > 0 ? '+' : ''}${variation.toFixed(0)}%`, positive: variation > 0 } : undefined,
      hint: `${prevLeads.toLocaleString('pt-BR')} no período anterior`,
    },
    { title: 'Valor no pipeline', value: formatCurrency(summary?.pipeline_value ?? 0), icon: DollarSign, tone: 'text-emerald-500 bg-emerald-500/10' },
    {
      title: 'Taxa de conversão', value: `${conversionRate.toFixed(1)}%`, icon: TrendingUp, tone: 'text-violet-500 bg-violet-500/10',
      hint: `${conversions} ganho${conversions === 1 ? '' : 's'} de ${newLeads}`,
    },
    {
      title: 'Qualificados', value: `${(qualifiedRate?.rate ?? 0).toFixed(1)}%`, icon: Star, tone: 'text-amber-500 bg-amber-500/10',
      hint: qualifiedRate ? `${qualifiedRate.qualified} de ${qualifiedRate.total} negócios` : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {kpis.map((k) => (
        <Card key={k.title} className="min-w-0 p-3.5 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="line-clamp-2 min-w-0 text-xs leading-snug text-muted-foreground sm:line-clamp-1 sm:text-sm">{k.title}</p>
            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8', k.tone)}>
              <k.icon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{k.value}</p>
            {k.delta && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                  k.delta.positive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/10 text-destructive',
                )}
              >
                {k.delta.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {k.delta.value}
              </span>
            )}
          </div>
          <p className="mt-1 h-4 truncate text-xs text-muted-foreground">{k.hint}</p>
        </Card>
      ))}
    </div>
  );
}
