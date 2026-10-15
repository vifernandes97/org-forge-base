import { supabase } from '@/integrations/supabase/client';

export interface CompanyOverview {
  id: string; organization_id: string; trade_name: string; legal_name: string | null; cnpj: string | null;
  instagram: string | null; segment_id: string | null; segment_label: string | null; created_at: string;
  contacts_count: number; open_leads_count: number; total_leads_count: number; open_value: number;
  last_lead_at: string | null; last_activity_at: string | null;
}

export interface ContactOverview {
  id: string; organization_id: string; company_id: string | null; name: string; email: string | null; phone: string | null;
  created_at: string; company_trade_name: string | null; segment_id: string | null; segment_label: string | null;
  leads_count: number; primary_count: number; in_active_lead: boolean;
}

export interface CompanyListFilters {
  q?: string; segment_ids?: string[]; situation?: '' | 'open' | 'no_open' | 'no_leads';
  assigned_to?: string[]; funnel_ids?: string[]; no_contacts?: boolean; created_from?: string; created_to?: string;
}
export interface ContactListFilters {
  q?: string; company_id?: string; segment_ids?: string[]; has_email?: '' | 'yes' | 'no'; has_phone?: '' | 'yes' | 'no';
  in_active?: '' | 'yes' | 'no'; created_from?: string; created_to?: string;
}
export interface ListArgs<F> { filters: F; sort: string; dir: 'asc' | 'desc'; page: number; pageSize: number | null }

export async function listCompanies(orgId: string, a: ListArgs<CompanyListFilters>) {
  const { data, error } = await (supabase.rpc as any)('list_companies', {
    p_org: orgId, p_filters: a.filters, p_sort: a.sort, p_dir: a.dir, p_page: a.page, p_page_size: a.pageSize,
  });
  if (error) throw error;
  return data as { rows: CompanyOverview[]; total: number };
}

export async function listContacts(orgId: string, a: ListArgs<ContactListFilters>) {
  const { data, error } = await (supabase.rpc as any)('list_contacts', {
    p_org: orgId, p_filters: a.filters, p_sort: a.sort, p_dir: a.dir, p_page: a.page, p_page_size: a.pageSize,
  });
  if (error) throw error;
  return data as { rows: ContactOverview[]; total: number };
}

export async function mergeContacts(keepId: string, removeId: string) {
  const { data, error } = await (supabase.rpc as any)('merge_contacts', { p_keep: keepId, p_remove: removeId });
  if (error) throw error;
  return data as { kept: string; moved: number; deduplicated: number };
}

export async function bulkSetSegment(ids: string[], segmentId: string | null) {
  const { error } = await supabase.from('companies').update({ segment_id: segmentId } as any).in('id', ids);
  if (error) throw error;
}

/** Deletes only companies without deals (their contacts are removed with them). Returns the ones skipped. */
export async function deleteCompaniesWithoutLeads(ids: string[]) {
  const { data: withLeads, error: e1 } = await supabase.from('leads').select('company_id').in('company_id', ids);
  if (e1) throw e1;
  const blocked = new Set((withLeads || []).map((l: any) => l.company_id));
  const deletable = ids.filter(id => !blocked.has(id));
  if (deletable.length) {
    const { error } = await supabase.from('companies').delete().in('id', deletable);
    if (error) throw error;
  }
  return { deleted: deletable.length, skipped: [...blocked] as string[] };
}

export async function getCompanyLeads(companyId: string) {
  const { data, error } = await supabase
    .from('leads')
    .select('id, status, value, archived_at, merged_into_lead_id, created_at, funnel:funnels(id, name), stage:stages(id, name, color), assignee:profiles!leads_assigned_to_fkey(id, full_name)')
    .eq('company_id', companyId)
    .is('merged_into_lead_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as any[];
}

export async function getCompanyActivities(companyId: string, page: number, pageSize = 30) {
  const { data, error, count } = await supabase
    .from('lead_activities')
    .select('*, user:profiles!lead_activities_user_id_fkey(id, full_name, avatar_url), lead:leads!inner(id, company_id, funnel:funnels(name), stage:stages(name))', { count: 'exact' })
    .eq('lead.company_id', companyId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw error;
  return { data: (data || []) as any[], count: count || 0 };
}

export async function getContactWithLeads(contactId: string) {
  const { data, error } = await supabase
    .from('contacts')
    .select('*, company:companies(id, trade_name), links:lead_contacts(is_primary, lead:leads(id, status, archived_at, merged_into_lead_id, funnel:funnels(name), stage:stages(name, color)))')
    .eq('id', contactId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}
