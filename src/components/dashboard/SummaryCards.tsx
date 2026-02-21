import { Users, UserPlus, DollarSign, TrendingUp, ClipboardList, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/formatCurrency';
import type { DashboardSummary } from '@/services/dashboard';

interface SummaryCardsProps {
  summary?: DashboardSummary;
  pendingTasks?: number;
  overdueTasks?: number;
  isLoading: boolean;
}

export default function SummaryCards({ summary, pendingTasks, overdueTasks, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const newLeads = summary?.new_leads ?? 0;
  const prevLeads = summary?.new_leads_previous ?? 0;
  const variation = prevLeads > 0 ? ((newLeads - prevLeads) / prevLeads) * 100 : newLeads > 0 ? 100 : 0;
  const conversionRate = newLeads > 0 ? ((summary?.conversion_count ?? 0) / newLeads) * 100 : 0;

  const cards = [
    { title: 'Total de Leads', value: String(summary?.total_leads ?? 0), icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    {
      title: 'Novos Leads', value: String(newLeads), icon: UserPlus, color: 'text-emerald-500', bg: 'bg-emerald-500/10',
      badge: variation !== 0 ? { value: `${variation > 0 ? '+' : ''}${variation.toFixed(0)}%`, positive: variation > 0 } : undefined,
    },
    { title: 'Valor no Pipeline', value: formatCurrency(summary?.pipeline_value ?? 0), icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'Taxa de Conversão', value: `${conversionRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { title: 'Tarefas Pendentes', value: String(pendingTasks ?? 0), icon: ClipboardList, color: (pendingTasks ?? 0) > 0 ? 'text-yellow-500' : 'text-muted-foreground', bg: (pendingTasks ?? 0) > 0 ? 'bg-yellow-500/10' : 'bg-muted' },
    { title: 'Tarefas Atrasadas', value: String(overdueTasks ?? 0), icon: AlertTriangle, color: (overdueTasks ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground', bg: (overdueTasks ?? 0) > 0 ? 'bg-destructive/10' : 'bg-muted' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardContent className="p-5 flex items-start gap-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.bg}`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground truncate">{c.title}</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold tracking-tight">{c.value}</p>
                {c.badge && (
                  <span className={`flex items-center text-xs font-medium ${c.badge.positive ? 'text-emerald-600' : 'text-destructive'}`}>
                    {c.badge.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {c.badge.value}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
