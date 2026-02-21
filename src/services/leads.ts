import { supabase } from '@/integrations/supabase/client';
import type { Lead } from '@/types';

export async function getLeads(orgId: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*, stage:stages(*), funnel:funnels(*), assigned_profile:profiles!leads_assigned_to_fkey(*)')
    .eq('organization_id', orgId)
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
