import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays, startOfMonth, endOfMonth, subMonths, startOfYear, differenceInDays } from 'date-fns';
import { useOrganization } from '@/contexts/OrganizationContext';
import * as dashboardService from '@/services/dashboard';

export type PeriodKey = '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'month' | 'this_year' | 'custom';

export interface DashboardPeriod {
  key: PeriodKey;
  dateFrom: string;
  dateTo: string;
}

function parseMonth(targetMonth?: string): Date {
  if (targetMonth) {
    const [y, m] = targetMonth.split('-').map(Number);
    if (y && m) return new Date(y, m - 1, 1);
  }
  return startOfMonth(new Date());
}

function computePeriod(
  key: PeriodKey,
  customFrom?: Date,
  customTo?: Date,
  targetMonth?: string
): { dateFrom: string; dateTo: string } {
  const now = new Date();
  switch (key) {
    case '7d': return { dateFrom: subDays(now, 7).toISOString(), dateTo: now.toISOString() };
    case '30d': return { dateFrom: subDays(now, 30).toISOString(), dateTo: now.toISOString() };
    case '90d': return { dateFrom: subDays(now, 90).toISOString(), dateTo: now.toISOString() };
    case 'this_month': return { dateFrom: startOfMonth(now).toISOString(), dateTo: now.toISOString() };
    case 'last_month': {
      const prev = subMonths(now, 1);
      return { dateFrom: startOfMonth(prev).toISOString(), dateTo: endOfMonth(prev).toISOString() };
    }
    case 'month': {
      const target = parseMonth(targetMonth);
      return { dateFrom: startOfMonth(target).toISOString(), dateTo: endOfMonth(target).toISOString() };
    }
    case 'this_year': return { dateFrom: startOfYear(now).toISOString(), dateTo: now.toISOString() };
    case 'custom': return {
      dateFrom: (customFrom ?? subDays(now, 30)).toISOString(),
      dateTo: (customTo ?? now).toISOString(),
    };
  }
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function useDashboardPeriod() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('30d');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [targetMonth, setTargetMonth] = useState<string>(currentMonthKey());

  const period = useMemo<DashboardPeriod>(() => {
    const { dateFrom, dateTo } = computePeriod(periodKey, customFrom, customTo, targetMonth);
    return { key: periodKey, dateFrom, dateTo };
  }, [periodKey, customFrom, customTo, targetMonth]);

  return {
    period, periodKey, setPeriodKey,
    customFrom, customTo, setCustomFrom, setCustomTo,
    targetMonth, setTargetMonth,
  };
}


function getInterval(dateFrom: string, dateTo: string): string {
  const days = differenceInDays(new Date(dateTo), new Date(dateFrom));
  if (days < 30) return 'day';
  if (days < 90) return 'week';
  return 'month';
}

export function useDashboardSummary(period: DashboardPeriod, funnelId: string | null) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['dashboard-summary', orgId, funnelId, period.dateFrom, period.dateTo],
    queryFn: () => dashboardService.getDashboardSummary(orgId!, funnelId, period.dateFrom, period.dateTo),
    enabled: !!orgId,
  });
}

export function useLeadsByPeriod(period: DashboardPeriod, funnelId: string | null) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const interval = period.key === 'month' ? 'day' : getInterval(period.dateFrom, period.dateTo);
  return useQuery({
    queryKey: ['dashboard-leads-period', orgId, funnelId, period.dateFrom, period.dateTo, interval],
    queryFn: () => dashboardService.getLeadsByPeriod(orgId!, funnelId, period.dateFrom, period.dateTo, interval),
    enabled: !!orgId,
  });
}

export function useFunnelMetrics(funnelId: string | null) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['dashboard-funnel-metrics', orgId, funnelId],
    queryFn: () => dashboardService.getFunnelMetrics(orgId!, funnelId!),
    enabled: !!orgId && !!funnelId,
  });
}

export function useLeadsBySource(period: DashboardPeriod, funnelId: string | null) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['dashboard-leads-source', orgId, funnelId, period.dateFrom, period.dateTo],
    queryFn: () => dashboardService.getLeadsBySource(orgId!, funnelId, period.dateFrom, period.dateTo),
    enabled: !!orgId,
  });
}

export function useTeamRanking(period: DashboardPeriod, funnelId: string | null) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['dashboard-team-ranking', orgId, funnelId, period.dateFrom, period.dateTo],
    queryFn: () => dashboardService.getTeamRanking(orgId!, period.dateFrom, period.dateTo, funnelId),
    enabled: !!orgId,
  });
}

export function useQualifiedRate(period: DashboardPeriod, funnelId: string | null) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['dashboard-qualified-rate', orgId, funnelId, period.dateFrom, period.dateTo],
    queryFn: () => dashboardService.getQualifiedLeadsRate(orgId!, funnelId, period.dateFrom, period.dateTo),
    enabled: !!orgId,
  });
}

export function useTaskCounts() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const pending = useQuery({
    queryKey: ['dashboard-tasks-pending', orgId],
    queryFn: () => dashboardService.getPendingTasksCount(orgId!),
    enabled: !!orgId,
  });
  const overdue = useQuery({
    queryKey: ['dashboard-tasks-overdue', orgId],
    queryFn: () => dashboardService.getOverdueTasksCount(orgId!),
    enabled: !!orgId,
  });
  return { pending, overdue };
}
