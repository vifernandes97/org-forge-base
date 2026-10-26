import { useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import SummaryCards from '@/components/dashboard/SummaryCards';
import FunnelChart from '@/components/dashboard/FunnelChart';
import LeadsByPeriodChart from '@/components/dashboard/LeadsByPeriodChart';
import LeadsBySourceChart from '@/components/dashboard/LeadsBySourceChart';
import TeamRankingTable from '@/components/dashboard/TeamRankingTable';
import TasksCard from '@/components/dashboard/TasksCard';
import {
  useDashboardPeriod,
  useDashboardSummary,
  useLeadsByPeriod,
  useFunnelMetrics,
  useLeadsBySource,
  useTeamRanking,
  useTaskCounts,
  useQualifiedRate,
} from '@/hooks/useDashboard';
import { useFunnels } from '@/hooks/useFunnels';

export default function DashboardPage() {
  const {
    period, periodKey, setPeriodKey, customFrom, customTo, setCustomFrom, setCustomTo,
    targetMonth, setTargetMonth, isCurrentMonth, goPrevMonth, goNextMonth, resetToCurrentMonth,
  } = useDashboardPeriod();
  const [funnelId, setFunnelId] = useState<string | null>(null);
  const { data: funnels } = useFunnels();

  // Use first funnel as default for funnel-specific charts when "all" is selected
  const defaultFunnelId = funnels?.[0]?.id ?? null;
  const funnelChartId = funnelId ?? defaultFunnelId;
  const funnelChartName = funnels?.find(f => f.id === funnelChartId)?.name;

  const summary = useDashboardSummary(period, funnelId);
  const leadsByPeriod = useLeadsByPeriod(period, funnelId);
  const funnelMetrics = useFunnelMetrics(funnelChartId, period);
  const leadsBySource = useLeadsBySource(period, funnelId);
  const teamRanking = useTeamRanking(period, funnelId);
  const { pending, overdue } = useTaskCounts();
  const qualifiedRate = useQualifiedRate(period, funnelId);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="hidden h-10 w-10 items-center justify-center rounded-lg bg-primary/10 sm:flex">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight sm:text-2xl">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{funnelId ? `Funil ${funnelChartName}` : 'Todos os funis'}</p>
          </div>
        </div>
        <DashboardFilters
          periodKey={periodKey}
          onPeriodChange={setPeriodKey}
          funnelId={funnelId}
          onFunnelChange={setFunnelId}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          targetMonth={targetMonth}
          onTargetMonthChange={setTargetMonth}
          isCurrentMonth={isCurrentMonth}
          onPrevMonth={goPrevMonth}
          onNextMonth={goNextMonth}
          onResetToCurrentMonth={resetToCurrentMonth}
        />
      </div>

      <SummaryCards
        summary={summary.data}
        qualifiedRate={qualifiedRate.data}
        isLoading={summary.isLoading || qualifiedRate.isLoading}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FunnelChart
          data={funnelMetrics.data}
          funnelName={funnelChartName}
          isLoading={funnelMetrics.isLoading}
        />
        <div className="flex flex-col gap-4">
          <TasksCard pending={pending.data} overdue={overdue.data} isLoading={pending.isLoading || overdue.isLoading} />
          <LeadsBySourceChart data={leadsBySource.data} isLoading={leadsBySource.isLoading} />
        </div>
      </div>

      <LeadsByPeriodChart data={leadsByPeriod.data} dateFrom={period.dateFrom} dateTo={period.dateTo} isLoading={leadsByPeriod.isLoading} />

      <TeamRankingTable data={teamRanking.data} isLoading={teamRanking.isLoading} />
    </div>
  );
}
