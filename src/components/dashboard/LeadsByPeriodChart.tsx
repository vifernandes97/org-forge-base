import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { PeriodData } from '@/services/dashboard';

interface LeadsByPeriodChartProps {
  data?: PeriodData[];
  dateFrom: string;
  dateTo: string;
  isLoading: boolean;
}

export default function LeadsByPeriodChart({ data, dateFrom, dateTo, isLoading }: LeadsByPeriodChartProps) {
  if (isLoading) {
    return <Card><CardHeader><CardTitle>Leads por Período</CardTitle></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>;
  }

  const days = differenceInDays(new Date(dateTo), new Date(dateFrom));
  const fmt = days < 30 ? 'dd/MM' : days < 90 ? "'Sem' w" : 'MMM/yy';

  const chartData = (data ?? []).map(d => ({
    date: format(new Date(d.period_start), fmt, { locale: ptBR }),
    leads: d.lead_count,
  }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Leads por Período</CardTitle></CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado no período</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradientBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="leads" stroke="hsl(217, 91%, 60%)" fill="url(#gradientBlue)" strokeWidth={2} name="Leads" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
