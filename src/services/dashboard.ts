import { supabase } from '@/integrations/supabase/client';

export interface DashboardSummary {
  total_leads: number;
  new_leads: number;
  new_leads_previous: number;
  pipeline_value: number;
  conversion_count: number;
}

export interface PeriodData {
  period_start: string;
  lead_count: number;
}

export interface FunnelMetric {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  stage_position: number;
  lead_count: number;
  total_value: number;
}

export interface TeamMember {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  leads_count: number;
  converted_count: number;
  total_value: number;
}

export async function getDashboardSummary(
  orgId: string, funnelId: string | null, dateFrom: string, dateTo: string
): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc('get_dashboard_summary', {
    p_org_id: orgId,
    p_funnel_id: funnelId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });
  if (error) throw error;
  return data as unknown as DashboardSummary;
}

export async function getLeadsByPeriod(
  orgId: string, funnelId: string | null, dateFrom: string, dateTo: string, interval: string
): Promise<PeriodData[]> {
  const { data, error } = await supabase.rpc('get_leads_by_period', {
    p_org_id: orgId,
    p_funnel_id: funnelId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_interval: interval,
  });
  if (error) throw error;
  return (data ?? []) as unknown as PeriodData[];
}

export async function getFunnelMetrics(orgId: string, funnelId: string): Promise<FunnelMetric[]> {
  const { data, error } = await supabase.rpc('get_funnel_metrics', {
    p_org_id: orgId,
    p_funnel_id: funnelId,
  });
  if (error) throw error;
  return (data ?? []) as unknown as FunnelMetric[];
}

export async function getTeamRanking(
  orgId: string, dateFrom: string, dateTo: string, funnelId: string | null
): Promise<TeamMember[]> {
  const { data, error } = await supabase.rpc('get_team_ranking', {
    p_org_id: orgId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_funnel_id: funnelId,
  });
  if (error) throw error;
  return (data ?? []) as unknown as TeamMember[];
}

export interface SourceCount {
  source: string;
  count: number;
}

export async function getLeadsBySource(
  orgId: string, funnelId: string | null, dateFrom: string, dateTo: string
): Promise<SourceCount[]> {
  let query = supabase.from('leads').select('source').eq('organization_id', orgId)
    .gte('created_at', dateFrom).lte('created_at', dateTo);
  if (funnelId) query = query.eq('funnel_id', funnelId);
  const { data, error } = await query;
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const src = row.source || 'Sem fonte';
    counts[src] = (counts[src] || 0) + 1;
  }
  return Object.entries(counts).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
}

export interface QualifiedRate {
  qualified: number;
  total: number;
  rate: number;
}

export async function getQualifiedLeadsRate(
  orgId: string, funnelId: string | null, dateFrom: string, dateTo: string
): Promise<QualifiedRate> {
  let baseQuery = supabase.from('leads').select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('archived_at', null)
    .gte('created_at', dateFrom).lte('created_at', dateTo);
  if (funnelId) baseQuery = baseQuery.eq('funnel_id', funnelId);
  const { count: total, error: e1 } = await baseQuery;
  if (e1) throw e1;

  let qualQuery = supabase.from('leads').select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('archived_at', null)
    .gte('created_at', dateFrom).lte('created_at', dateTo)
    .in('qualification', [4, 5]);
  if (funnelId) qualQuery = qualQuery.eq('funnel_id', funnelId);
  const { count: qualified, error: e2 } = await qualQuery;
  if (e2) throw e2;

  const t = total ?? 0;
  const q = qualified ?? 0;
  return { qualified: q, total: t, rate: t > 0 ? (q / t) * 100 : 0 };
}

export async function getPendingTasksCount(orgId: string): Promise<number> {
  const { count, error } = await supabase.from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('completed_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function getOverdueTasksCount(orgId: string): Promise<number> {
  const { count, error } = await supabase.from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('completed_at', null)
    .lt('due_date', new Date().toISOString());
  if (error) throw error;
  return count ?? 0;
}
