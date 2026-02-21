import { supabase } from '@/integrations/supabase/client';
import type { SavedFilter, LeadFilters } from '@/types';

export async function getSavedFilters(orgId: string): Promise<SavedFilter[]> {
  const { data, error } = await supabase
    .from('saved_filters')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(d => ({ ...d, filters: d.filters as unknown as LeadFilters })) as SavedFilter[];
}

export async function createSavedFilter(filter: {
  organization_id: string;
  user_id: string;
  name: string;
  filters: LeadFilters;
  is_shared: boolean;
}) {
  const { data, error } = await supabase
    .from('saved_filters')
    .insert({ ...filter, filters: filter.filters as any })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSavedFilter(id: string) {
  const { error } = await supabase.from('saved_filters').delete().eq('id', id);
  if (error) throw error;
}
