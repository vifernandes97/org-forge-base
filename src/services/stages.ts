import { supabase } from '@/integrations/supabase/client';
import type { Stage } from '@/types';

export async function getStages(funnelId: string): Promise<Stage[]> {
  const { data, error } = await supabase
    .from('stages')
    .select('*')
    .eq('funnel_id', funnelId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data as Stage[];
}

export async function createStage(stage: {
  funnel_id: string;
  organization_id: string;
  name: string;
  color: string;
  position: number;
}) {
  const { data, error } = await supabase
    .from('stages')
    .insert(stage)
    .select()
    .single();
  if (error) throw error;
  return data as Stage;
}

export async function updateStage(id: string, updates: Partial<Pick<Stage, 'name' | 'color' | 'sla_hours' | 'webhook_url'>>) {
  const { data, error } = await supabase
    .from('stages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Stage;
}

export async function deleteStage(id: string) {
  const { error } = await supabase.from('stages').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderStages(stages: { id: string; position: number }[]) {
  const { error } = await supabase.rpc('reorder_stages', {
    p_stages: stages,
  });
  if (error) throw error;
}
