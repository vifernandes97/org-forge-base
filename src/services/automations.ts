import { supabase } from '@/integrations/supabase/client';

export async function getAutomations(orgId: string) {
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createAutomation(automation: {
  organization_id: string;
  name: string;
  trigger_funnel_id: string;
  trigger_stage_id: string;
  action_funnel_id: string;
  action_stage_id: string | null;
}) {
  const { data, error } = await supabase
    .from('automations')
    .insert(automation)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAutomation(id: string, updates: { name?: string; is_active?: boolean; trigger_funnel_id?: string; trigger_stage_id?: string; action_funnel_id?: string; action_stage_id?: string | null }) {
  const { data, error } = await supabase
    .from('automations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAutomation(id: string) {
  const { error } = await supabase.from('automations').delete().eq('id', id);
  if (error) throw error;
}
