import { useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import SummaryCards from '@/components/dashboard/SummaryCards';
import FunnelChart from '@/components/dashboard/FunnelChart';
import LeadsByPeriodChart from '@/components/dashboard/LeadsByPeriodChart';
import ValueByStageChart from '@/components/dashboard/ValueByStageChart';
import LeadsBySourceChart from '@/components/dashboard/LeadsBySourceChart';
import TeamRankingTable from '@/components/dashboard/TeamRankingTable';
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
  const { period, periodKey, setPeriodKey, customFrom, customTo, setCustomFrom, setCustomTo, targetMonth, setTargetMonth } = useDashboardPeriod();
  const [funnelId, setFunnelId] = useState<string | null>(null);
  const { data: funnels } = useFunnels();

  // Use first funnel as default for funnel-specific charts when "all" is selected
  const defaultFunnelId = funnels?.[0]?.id ?? null;
  const funnelChartId = funnelId ?? defaultFunnelId;

  const summary = useDashboardSummary(period, funnelId);
  const leadsByPeriod = useLeadsByPeriod(period, funnelId);
  const funnelMetrics = useFunnelMetrics(funnelChartId, period);
  const leadsBySource = useLeadsBySource(period, funnelId);
  const teamRanking = useTeamRanking(period, funnelId);
  const { pending, overdue } = useTaskCounts();
  const qualifiedRate = useQualifiedRate(period, funnelId);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
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
        />
      </div>

      {/* Summary Cards */}
      <SummaryCards
        summary={summary.data}
        pendingTasks={pending.data}
        overdueTasks={overdue.data}
        qualifiedRate={qualifiedRate.data}
        isLoading={summary.isLoading || pending.isLoading || overdue.isLoading || qualifiedRate.isLoading}
      />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FunnelChart data={funnelMetrics.data} isLoading={funnelMetrics.isLoading} />
        <LeadsByPeriodChart data={leadsByPeriod.data} dateFrom={period.dateFrom} dateTo={period.dateTo} isLoading={leadsByPeriod.isLoading} />
        <ValueByStageChart data={funnelMetrics.data} isLoading={funnelMetrics.isLoading} />
        <LeadsBySourceChart data={leadsBySource.data} isLoading={leadsBySource.isLoading} />
      </div>

      {/* Team Ranking */}
      <TeamRankingTable data={teamRanking.data} isLoading={teamRanking.isLoading} />
    </div>
  );
}
