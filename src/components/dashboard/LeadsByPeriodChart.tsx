import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DashboardCard, { ChartTooltip, EmptyChart } from './DashboardCard';
import type { PeriodData } from '@/services/dashboard';

interface LeadsByPeriodChartProps {
  data?: PeriodData[];
  dateFrom: string;
  dateTo: string;
  isLoading: boolean;
}

export default function LeadsByPeriodChart({ data, dateFrom, dateTo, isLoading }: LeadsByPeriodChartProps) {
  const days = differenceInDays(new Date(dateTo), new Date(dateFrom));
  const fmt = days < 30 ? 'dd/MM' : days < 90 ? "'Sem' w" : 'MMM/yy';
  const unit = days < 30 ? 'por dia' : days < 90 ? 'por semana' : 'por mês';

  const chartData = (data ?? []).map(d => ({
    date: format(new Date(d.period_start), fmt, { locale: ptBR }),
    leads: d.lead_count,
  }));
  const total = chartData.reduce((s, d) => s + d.leads, 0);
  const avg = chartData.length ? total / chartData.length : 0;

  return (
    <DashboardCard
      title="Novos negócios"
      description={chartData.length ? `${total} no período · média de ${avg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unit}` : undefined}
      isLoading={isLoading}
    >
      {chartData.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} className="stroke-border" strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} minTickGap={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} content={<ChartTooltip />} />
            <Bar dataKey="leads" name="Negócios" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </DashboardCard>
  );
}
