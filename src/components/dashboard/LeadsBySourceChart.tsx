import DashboardCard, { EmptyChart } from './DashboardCard';
import type { SourceCount } from '@/services/dashboard';

interface LeadsBySourceChartProps {
  data?: SourceCount[];
  isLoading: boolean;
}

/** Sources ranked by deal count; a list reads better than a donut when one source dominates. */
export default function LeadsBySourceChart({ data, isLoading }: LeadsBySourceChartProps) {
  const rows = [...(data ?? [])].sort((a, b) => b.count - a.count);
  const total = rows.reduce((s, d) => s + d.count, 0);
  const visible = rows.slice(0, 6);
  const rest = rows.slice(6).reduce((s, d) => s + d.count, 0);

  return (
    <DashboardCard title="Origem dos negócios" description={total ? `${total} negócios no período` : undefined} isLoading={isLoading}>
      {!rows.length ? (
        <EmptyChart />
      ) : (
        <div className="space-y-3">
          {[...visible, ...(rest ? [{ source: 'Outras', count: rest }] : [])].map(r => {
            const pct = total ? (r.count / total) * 100 : 0;
            return (
              <div key={r.source} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate capitalize">{r.source || 'Sem fonte'}</span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold">{r.count}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
