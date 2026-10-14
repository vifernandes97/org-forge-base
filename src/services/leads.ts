import { supabase } from '@/integrations/supabase/client';
import type { Lead, LeadFilters } from '@/types';

function applyFilters(query: any, filters?: LeadFilters) {
  if (!filters) {
    query = query.is('archived_at', null).eq('status', 'open');
    return query;
  }
  const statuses = filters.status_filters?.length
    ? filters.status_filters
    : [filters.status_filter || 'open'];
  const unique = Array.from(new Set(statuses));
  if (unique.length === 1) {
    const s = unique[0];
    if (s === 'archived') {
      query = query.not('archived_at', 'is', null);
    } else if (s === 'won') {
      query = query.eq('status', 'won').is('archived_at', null);
    } else {
      query = query.eq('status', 'open').is('archived_at', null);
    }
  } else {
    const parts = unique.map((s) =>
      s === 'archived'
        ? 'archived_at.not.is.null'
        : `and(status.eq.${s},archived_at.is.null)`,
    );
    query = query.or(parts.join(','));
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
  if (filters.company_ids?.length) {
    query = query.in('company_id', filters.company_ids);
  }
  if (filters.segments?.length) {
    // requires the company embed to be !inner (see leadsQuery)
    query = query.in('company.segment', filters.segments);
  }
  return query;
}

/** Relations every deal screen needs: company + linked contacts. */
export const LEAD_COMPANY_REL = 'company:companies(*), lead_contacts(id, is_primary, created_at, contact:contacts(*))';

/**
 * Base deals query. Uses search_leads RPC when there is a search term (accent-insensitive,
 * searches company and all linked contacts), otherwise the leads table.
 */
function leadsQuery(select: string, filters: LeadFilters | undefined, orgId: string | undefined, opts?: { count?: 'exact' }) {
  const sel = filters?.segments?.length ? select.replace('company:companies(*)', 'company:companies!inner(*)') : select;
  const term = filters?.search?.trim();
  if (term && orgId) {
    return (supabase as any).rpc('search_leads', { p_org: orgId, p_term: term }, opts?.count ? { count: opts.count } : undefined).select(sel);
  }
  return supabase.from('leads').select(sel, opts as any);
}

const SORT_MAP: Record<string, string> = {
  company: 'company(trade_name)',
  segment: 'company(segment)',
};

export async function getLeads(orgId: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select(`*, stage:stages(*), funnel:funnels(*), assigned_profile:profiles!leads_assigned_to_fkey(*), ${LEAD_COMPANY_REL}`)
    .eq('organization_id', orgId)
    .is('archived_at', null)
    .order('last_activity_at', { ascending: false });
  if (error) throw error;
  return data as any;
}

export async function getLead(id: string) {
  const { data, error } = await supabase
    .from('leads')
    .select(`*, stage:stages(*), funnel:funnels(*), assigned_profile:profiles!leads_assigned_to_fkey(*), custom_field_values(*), ${LEAD_COMPANY_REL}`)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as any;
}

export async function createLead(lead: {
  organization_id: string;
  funnel_id: string;
  stage_id: string;
  company_id: string;
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

export async function upsertCustomFieldValue(
  leadId: string,
  fieldDefinitionId: string,
  value: string | null
) {
  if (!value) {
    const { error } = await supabase
      .from('custom_field_values')
      .delete()
      .eq('lead_id', leadId)
      .eq('field_definition_id', fieldDefinitionId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('custom_field_values')
    .upsert(
      { lead_id: leadId, field_definition_id: fieldDefinitionId, value },
      { onConflict: 'lead_id,field_definition_id' }
    );
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

export async function getLeadsByFunnel(funnelId: string, filters?: LeadFilters, orgId?: string) {
  let query = leadsQuery(`*, stage:stages(*), funnel:funnels(*), assigned_profile:profiles!leads_assigned_to_fkey(*), ${LEAD_COMPANY_REL}`, filters, orgId)
    .eq('funnel_id', funnelId);
  if (orgId) query = query.eq('organization_id', orgId);
  query = applyFilters(query, filters);
  query = query.order('last_activity_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data as any[];
}

/** Full lead records (all relations) matching the current server-side filters, for export. */
export async function getLeadsForExport(funnelId: string, filters?: LeadFilters, orgId?: string) {
  let query = leadsQuery(
    `*, stage:stages(*), funnel:funnels(*), assigned_profile:profiles!leads_assigned_to_fkey(*), archive_reason:archive_reasons(*), ${LEAD_COMPANY_REL}`,
    filters,
    orgId
  ).eq('funnel_id', funnelId);
  if (orgId) query = query.eq('organization_id', orgId);
  query = applyFilters(query, filters);
  query = query.order('created_at', { ascending: false });
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
  filters?: LeadFilters,
  orgId?: string
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let query = leadsQuery(
    `*, stage:stages(*), funnel:funnels(*), assigned_profile:profiles!leads_assigned_to_fkey(*), ${LEAD_COMPANY_REL}`,
    filters,
    orgId,
    { count: 'exact' }
  ).eq('funnel_id', funnelId);
  if (orgId) query = query.eq('organization_id', orgId);
  query = applyFilters(query, filters);
  query = query.order((SORT_MAP[sortBy] || sortBy) as any, { ascending: sortOrder === 'asc' }).range(from, to);
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

export async function moveLeadToFunnel(leadId: string, funnelId: string, stageId: string) {
  const { data, error } = await supabase
    .from('leads')
    .update({ funnel_id: funnelId, stage_id: stageId })
    .eq('id', leadId)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function bulkMoveLeadsToFunnel(leadIds: string[], funnelId: string, stageId: string) {
  const { error } = await supabase
    .from('leads')
    .update({ funnel_id: funnelId, stage_id: stageId })
    .in('id', leadIds);
  if (error) throw error;
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

export async function getCustomFieldValuesForLeads(leadIds: string[]) {
  if (leadIds.length === 0) return [];
  const { data, error } = await supabase
    .from('custom_field_values')
    .select('*')
    .in('lead_id', leadIds);
  if (error) throw error;
  return data;
}

export async function bulkArchiveLeads(leadIds: string[], reasonId: string) {
  const { error } = await supabase
    .from('leads')
    .update({ archived_at: new Date().toISOString(), archive_reason_id: reasonId, status: 'inactive' } as any)
    .in('id', leadIds);
  if (error) throw error;
}

export async function archiveLead(id: string, archiveReasonId: string, details?: string | null) {
  const { data, error } = await supabase
    .from('leads')
    .update({
      archived_at: new Date().toISOString(),
      archive_reason_id: archiveReasonId,
      status: 'inactive',
      archive_details: details?.trim() ? details.trim() : null,
    } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function unarchiveLead(id: string) {
  const { data, error } = await supabase
    .from('leads')
    .update({ archived_at: null, archive_reason_id: null, archive_details: null, status: 'open' } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export interface ArchiveReasonSummaryRow {
  archive_reason_id: string | null;
  label: string;
  count: number;
}

export async function getArchiveReasonsSummary(
  orgId: string,
  funnelId: string | null,
  from: string | null,
  to: string | null,
  assignedTo?: string[] | null
): Promise<ArchiveReasonSummaryRow[]> {
  const { data, error } = await supabase.rpc('get_archive_reasons_summary' as any, {
    p_org_id: orgId,
    p_funnel_id: funnelId,
    p_date_from: from,
    p_date_to: to,
    p_assigned_to: assignedTo && assignedTo.length ? assignedTo : null,
  });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    archive_reason_id: r.archive_reason_id,
    label: r.label,
    count: Number(r.count),
  }));
}

export async function mergeLeads(primaryId: string, duplicateIds: string[]) {
  const { data, error } = await supabase.rpc('merge_leads' as any, {
    p_primary_id: primaryId,
    p_duplicate_ids: duplicateIds,
  });
  if (error) throw error;
  return data as any;
}

export async function getLeadsByIds(ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('leads')
    .select(`*, stage:stages(*), assigned_profile:profiles!leads_assigned_to_fkey(*), ${LEAD_COMPANY_REL}`)
    .in('id', ids);
  if (error) throw error;
  return data as any[];
}

export async function searchLeadsForMerge(orgId: string, term: string, excludeId: string) {
  const t = term.trim();
  const sel = `*, stage:stages(*), ${LEAD_COMPANY_REL}`;
  const base: any = t
    ? (supabase as any).rpc('search_leads', { p_org: orgId, p_term: t }).select(sel)
    : supabase.from('leads').select(sel).eq('organization_id', orgId);
  const { data, error } = await base.neq('id', excludeId).limit(10).order('last_activity_at', { ascending: false });
  if (error) throw error;
  return data as any[];
}
