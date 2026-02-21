import { supabase } from '@/integrations/supabase/client';
import type { CustomFieldDefinition } from '@/types';

export async function getCustomFields(orgId: string): Promise<CustomFieldDefinition[]> {
  const { data, error } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('organization_id', orgId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data as CustomFieldDefinition[];
}

export async function createCustomField(field: {
  organization_id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  options?: string[] | null;
  is_required?: boolean;
  position: number;
}) {
  const { data, error } = await supabase
    .from('custom_field_definitions')
    .insert(field)
    .select()
    .single();
  if (error) throw error;
  return data as CustomFieldDefinition;
}

export async function updateCustomField(
  id: string,
  updates: Partial<Pick<CustomFieldDefinition, 'field_label' | 'field_name' | 'field_type' | 'options' | 'is_required' | 'is_active'>>
) {
  const { data, error } = await supabase
    .from('custom_field_definitions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as CustomFieldDefinition;
}

export async function deleteCustomField(id: string) {
  const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderCustomFields(fields: { id: string; position: number }[]) {
  const { error } = await supabase.rpc('reorder_custom_fields', {
    p_fields: fields as any,
  });
  if (error) throw error;
}
