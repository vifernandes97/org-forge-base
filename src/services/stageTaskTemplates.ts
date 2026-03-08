import { supabase } from '@/integrations/supabase/client';

export async function fetchStageTaskTemplates(organizationId: string) {
  const { data, error } = await supabase
    .from('stage_task_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createStageTaskTemplate(template: {
  organization_id: string;
  stage_id: string;
  title: string;
  description?: string | null;
  task_type: string;
  priority: string;
  due_hours: number;
  assign_to_lead_owner: boolean;
}) {
  const { data, error } = await supabase
    .from('stage_task_templates')
    .insert(template)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStageTaskTemplate(id: string, updates: Record<string, any>) {
  const { data, error } = await supabase
    .from('stage_task_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStageTaskTemplate(id: string) {
  const { error } = await supabase
    .from('stage_task_templates')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
