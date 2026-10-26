import DashboardCard, { EmptyChart } from './DashboardCard';
import { formatCurrency } from '@/lib/formatCurrency';
import type { FunnelMetric } from '@/services/dashboard';

interface FunnelChartProps {
  data?: FunnelMetric[];
  funnelName?: string;
  isLoading: boolean;
}

/** Deals and value per stage of one funnel, as proportional bars. */
export default function FunnelChart({ data, funnelName, isLoading }: FunnelChartProps) {
  const sorted = [...(data ?? [])].sort((a, b) => a.stage_position - b.stage_position);
  const maxCount = Math.max(...sorted.map(d => d.lead_count), 1);
  const total = sorted.reduce((s, d) => s + d.lead_count, 0);
  const totalValue = sorted.reduce((s, d) => s + Number(d.total_value || 0), 0);

  return (
    <DashboardCard
      title="Negócios por etapa"
      description={funnelName ? `Funil ${funnelName} · ${total} negócios · ${formatCurrency(totalValue)}` : undefined}
      isLoading={isLoading}
      className="lg:col-span-2"
    >
      {sorted.length === 0 ? (
        <EmptyChart>Nenhum dado disponível</EmptyChart>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[minmax(90px,140px)_1fr_64px_72px] gap-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Etapa</span>
            <span />
            <span className="text-right">Qtd.</span>
            <span className="text-right">Valor</span>
          </div>
          {sorted.map(s => {
            const pct = total > 0 ? (s.lead_count / total) * 100 : 0;
            return (
              <div key={s.stage_id} className="grid grid-cols-[minmax(90px,140px)_1fr_64px_72px] items-center gap-3 rounded-md py-1.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.stage_color }} />
                  <span className="truncate">{s.stage_name}</span>
                </span>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${Math.max((s.lead_count / maxCount) * 100, s.lead_count ? 2 : 0)}%`, backgroundColor: s.stage_color }}
                  />
                </div>
                <span className="text-right tabular-nums">
                  <span className="font-semibold">{s.lead_count}</span>
                  <span className="ml-1 text-[11px] text-muted-foreground">{pct.toFixed(0)}%</span>
                </span>
                <span className="text-right text-xs tabular-nums text-muted-foreground">
                  {Number(s.total_value) > 0 ? formatCurrency(Number(s.total_value)) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
