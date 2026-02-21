import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/formatCurrency';
import type { FunnelMetric } from '@/services/dashboard';

interface ValueByStageChartProps {
  data?: FunnelMetric[];
  isLoading: boolean;
}

export default function ValueByStageChart({ data, isLoading }: ValueByStageChartProps) {
  if (isLoading) {
    return <Card><CardHeader><CardTitle>Valor por Etapa</CardTitle></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>;
  }

  const sorted = [...(data ?? [])].sort((a, b) => a.stage_position - b.stage_position);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Valor por Etapa</CardTitle></CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado disponível</p>
        ) : (
          <ResponsiveContainer width="100%" height={sorted.length * 48 + 20}>
            <BarChart data={sorted} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="stage_name" width={110} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [formatCurrency(value), 'Valor']} />
              <Bar dataKey="total_value" radius={[0, 4, 4, 0]} barSize={28}>
                {sorted.map((entry) => (
                  <Cell key={entry.stage_id} fill={entry.stage_color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
