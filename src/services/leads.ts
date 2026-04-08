import { supabase } from '@/integrations/supabase/client';
import type { Lead, LeadFilters } from '@/types';

function applyFilters(query: any, filters?: LeadFilters) {
  if (!filters) {
    query = query.is('archived_at', null).eq('status', 'open');
    return query;
  }
  const statusFilter = filters.status_filter || 'open';
  if (statusFilter === 'archived') {
    query = query.not('archived_at', 'is', null);
  } else if (statusFilter === 'won') {
    query = query.eq('status', 'won').is('archived_at', null);
  } else {
    query = query.eq('status', 'open').is('archived_at', null);
  }
  if (filters.search) {
    const s = `%${filters.search}%`;
    query = query.or(`name.ilike.${s},email.ilike.${s},company.ilike.${s},phone.ilike.${s}`);
  }
  if (filters.stage_ids?.length) {
    query = query.in('stage_id', filters.stage_ids);
  }
  if (filters.assigned_to?.length) {
    const hasNone = filters.assigned_to.includes('__none__');
    const ids = filters.assigned_to.filter(id => id !== '__none__');
    if (hasNone && ids.length) {
      query = query.or(`assigned_to.is.null,assigned_to.in.(${ids.join(',')})`);
    } else if (hasNone) {
      query = query.is('assigned_to', null);
    } else {
      query = query.in('assigned_to', ids);
    }
  }
  if (filters.priorities?.length) {
    query = query.in('priority', filters.priorities);
  }
  if (filters.sources?.length) {
    query = query.in('source', filters.sources);
  }
  if (filters.tags?.length) {
    for (const tag of filters.tags) {
      query = query.contains('tags', [tag]);
    }
  }
  if (filters.value_min !== undefined) {
    query = query.gte('value', filters.value_min);
  }
  if (filters.value_max !== undefined) {
    query = query.lte('value', filters.value_max);
  }
  if (filters.created_at_from) {
    query = query.gte('created_at', filters.created_at_from);
  }
  if (filters.created_at_to) {
    query = query.lte('created_at', filters.created_at_to);
  }
  if (filters.last_activity_from) {
    query = query.gte('last_activity_at', filters.last_activity_from);
  }
  if (filters.last_activity_to) {
    query = query.lte('last_activity_at', filters.last_activity_to);
  }
  if (filters.qualifications?.length) {
    query = query.in('qualification', filters.qualifications);
  }
  if (filters.archive_reason_ids?.length) {
    query = query.in('archive_reason_id', filters.archive_reason_ids);
  }
  return query;
}

export async function getLeads(orgId: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*, stage:stages(*), funnel:funnels(*), assigned_profile:profiles!leads_assigned_to_fkey(*)')
    .eq('organization_id', orgId)
    .is('archived_at', null)
    .order('last_activity_at', { ascending: false });
  if (error) throw error;
  return data as any;
}

export async function getLead(id: string) {
  const { data, error } = await supabase
    .from('leads')
    .select('*, stage:stages(*), funnel:funnels(*), assigned_profile:profiles!leads_assigned_to_fkey(*), custom_field_values(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as any;
}

export async function createLead(lead: {
  organization_id: string;
  funnel_id: string;
  stage_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  company_name?: string | null;
  company_instagram?: string | null;
  media_de_festas?: string | null;
  qualification?: number | null;
  assigned_to?: string | null;
  value?: number;
  tags?: string[];
  source?: string | null;
  priority?: string;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from('leads')
    .insert(lead)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function updateLead(id: string, updates: Partial<Omit<Lead, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'last_activity_at' | 'stage_entered_at'>>) {
  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function deleteLead(id: string) {
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertCustomFieldValues(leadId: string, values: { field_definition_id: string; value: string | null }[]) {
  if (values.length === 0) return;
  const rows = values.map(v => ({ lead_id: leadId, field_definition_id: v.field_definition_id, value: v.value }));
  const { error } = await supabase
    .from('custom_field_values')
    .upsert(rows, { onConflict: 'lead_id,field_definition_id' });
  if (error) throw error;
}

export async function getOrgMembers(orgId: string) {
  const { data, error } = await supabase
    .from('organization_members')
    .select('*, profile:profiles(*)')
    .eq('organization_id', orgId);
  if (error) throw error;
  return data as any[];
}

export async function getLeadsByFunnel(funnelId: string, filters?: LeadFilters) {
  let query = supabase
    .from('leads')
    .select('*, stage:stages(*), funnel:funnels(*), assigned_profile:profiles!leads_assigned_to_fkey(*)')
    .eq('funnel_id', funnelId);
  query = applyFilters(query, filters);
  query = query.order('last_activity_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data as any[];
}

export async function getLeadsListPaginated(
  funnelId: string,
  page: number,
  pageSize: number,
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  filters?: LeadFilters
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from('leads')
    .select('*, stage:stages(*), funnel:funnels(*), assigned_profile:profiles!leads_assigned_to_fkey(*)', { count: 'exact' })
    .eq('funnel_id', funnelId);
  query = applyFilters(query, filters);
  query = query.order(sortBy as any, { ascending: sortOrder === 'asc' }).range(from, to);
  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as any[], count: count || 0 };
}

export async function moveLeadToStage(leadId: string, stageId: string) {
  const { data, error } = await supabase
    .from('leads')
    .update({ stage_id: stageId })
    .eq('id', leadId)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function bulkMoveLeads(leadIds: string[], stageId: string) {
  const { error } = await supabase
    .from('leads')
    .update({ stage_id: stageId })
    .in('id', leadIds);
  if (error) throw error;
}

export async function bulkAssignLeads(leadIds: string[], assignedTo: string | null) {
  const { error } = await supabase
    .from('leads')
    .update({ assigned_to: assignedTo })
    .in('id', leadIds);
  if (error) throw error;
}

export async function bulkDeleteLeads(leadIds: string[]) {
  const { error } = await supabase
    .from('leads')
    .delete()
    .in('id', leadIds);
  if (error) throw error;
}

export async function archiveLead(id: string, archiveReasonId: string) {
  const { data, error } = await supabase
    .from('leads')
    .update({ archived_at: new Date().toISOString(), archive_reason_id: archiveReasonId, status: 'inactive' } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function unarchiveLead(id: string) {
  const { data, error } = await supabase
    .from('leads')
    .update({ archived_at: null, archive_reason_id: null, status: 'open' } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}
