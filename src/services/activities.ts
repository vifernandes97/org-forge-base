import { supabase } from '@/integrations/supabase/client';
import type { LeadActivityWithUser } from '@/types';

export async function getLeadActivities(leadId: string, page: number, pageSize: number) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from('lead_activities')
    .select('*, user:profiles!lead_activities_user_id_fkey(*)', { count: 'exact' })
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data as unknown as LeadActivityWithUser[], count: count || 0 };
}

/** Fetch every activity (timeline) of the given leads, in chunks. */
export async function getActivitiesForLeads(leadIds: string[]) {
  if (!leadIds.length) return [] as any[];
  const chunkSize = 150;
  const all: any[] = [];
  for (let i = 0; i < leadIds.length; i += chunkSize) {
    const chunk = leadIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('lead_activities')
      .select('*, user:profiles!lead_activities_user_id_fkey(full_name, email)')
      .in('lead_id', chunk)
      .order('created_at', { ascending: true });
    if (error) throw error;
    all.push(...((data as any[]) || []));
  }
  return all;
}

export async function createActivity(data: {
  organization_id: string;
  lead_id: string;
  user_id: string;
  activity_type: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
}) {
  const { error } = await supabase.from('lead_activities').insert(data as any);
  if (error) throw error;
  // Also update lead's last_activity_at
  await supabase.from('leads').update({ last_activity_at: new Date().toISOString() } as any).eq('id', data.lead_id);
}

export async function updateActivity(params: {
  id: string;
  lead_id: string;
  title?: string;
  description?: string | null;
}) {
  const updates: Record<string, any> = {};
  if (params.title !== undefined) updates.title = params.title;
  if (params.description !== undefined) updates.description = params.description;
  const { error } = await supabase
    .from('lead_activities')
    .update(updates as any)
    .eq('id', params.id);
  if (error) throw error;
}
