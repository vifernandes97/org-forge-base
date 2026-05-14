import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { SourceCount } from '@/services/dashboard';

const COLORS = ['#3B82F6', '#22C55E', '#EAB308', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#64748B'];

interface LeadsBySourceChartProps {
  data?: SourceCount[];
  isLoading: boolean;
}

export default function LeadsBySourceChart({ data, isLoading }: LeadsBySourceChartProps) {
  if (isLoading) {
    return <Card><CardHeader><CardTitle>Negócios por Fonte</CardTitle></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>;
  }

  const total = (data ?? []).reduce((s, d) => s + d.count, 0);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Negócios por Fonte</CardTitle></CardHeader>
      <CardContent>
        {!data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado no período</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`${value} (${((value / total) * 100).toFixed(0)}%)`, 'Negócios']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
