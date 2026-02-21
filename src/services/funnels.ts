import { supabase } from '@/integrations/supabase/client';
import type { Funnel } from '@/types';

export async function getFunnels(orgId: string): Promise<Funnel[]> {
  const { data, error } = await supabase
    .from('funnels')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Funnel[];
}

export async function getFunnel(id: string): Promise<Funnel> {
  const { data, error } = await supabase
    .from('funnels')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Funnel;
}

export async function createFunnel(orgId: string, name: string, description: string | null) {
  const { data, error } = await supabase.rpc('create_funnel_with_default_stages', {
    p_org_id: orgId,
    p_name: name,
    p_description: description,
  });
  if (error) throw error;
  return data;
}

export async function updateFunnel(id: string, updates: Partial<Pick<Funnel, 'name' | 'description' | 'is_default'>>) {
  const { data, error } = await supabase
    .from('funnels')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Funnel;
}

export async function deleteFunnel(id: string) {
  const { error } = await supabase.from('funnels').delete().eq('id', id);
  if (error) throw error;
}

export async function setDefaultFunnel(orgId: string, funnelId: string) {
  // Unset all defaults for the org
  const { error: unsetError } = await supabase
    .from('funnels')
    .update({ is_default: false })
    .eq('organization_id', orgId)
    .eq('is_default', true);
  if (unsetError) throw unsetError;

  // Set the new default
  const { error } = await supabase
    .from('funnels')
    .update({ is_default: true })
    .eq('id', funnelId);
  if (error) throw error;
}
