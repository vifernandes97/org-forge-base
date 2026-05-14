import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { FunnelMetric } from '@/services/dashboard';

interface FunnelChartProps {
  data?: FunnelMetric[];
  isLoading: boolean;
}

export default function FunnelChart({ data, isLoading }: FunnelChartProps) {
  if (isLoading) {
    return <Card><CardHeader><CardTitle>Funil de Conversão</CardTitle></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>;
  }

  const sorted = [...(data ?? [])].sort((a, b) => a.stage_position - b.stage_position);
  const maxCount = Math.max(...sorted.map(d => d.lead_count), 1);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Funil de Conversão</CardTitle></CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado disponível</p>
        ) : (
          <ResponsiveContainer width="100%" height={sorted.length * 48 + 20}>
            <BarChart data={sorted} layout="vertical" margin={{ left: 0, right: 40 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="stage_name" width={110} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`${value} negócios (${((value / maxCount) * 100).toFixed(0)}%)`, 'Negócios']} />
              <Bar dataKey="lead_count" radius={[0, 4, 4, 0]} barSize={28}>
                {sorted.map((entry) => (
                  <Cell key={entry.stage_id} fill={entry.stage_color} />
                ))}
                <LabelList dataKey="lead_count" position="right" className="fill-foreground text-xs" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
