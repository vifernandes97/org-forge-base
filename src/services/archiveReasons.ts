import { supabase } from '@/integrations/supabase/client';

export interface ArchiveReason {
  id: string;
  organization_id: string;
  label: string;
  position: number;
  is_active: boolean;
  created_at: string;
}

export async function getArchiveReasons(orgId: string): Promise<ArchiveReason[]> {
  const { data, error } = await supabase
    .from('archive_reasons')
    .select('*')
    .eq('organization_id', orgId)
    .order('position');
  if (error) throw error;
  return data as unknown as ArchiveReason[];
}

export async function getActiveArchiveReasons(orgId: string): Promise<ArchiveReason[]> {
  const { data, error } = await supabase
    .from('archive_reasons')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('position');
  if (error) throw error;
  return data as unknown as ArchiveReason[];
}

export async function createArchiveReason(orgId: string, label: string, position: number) {
  const { data, error } = await supabase
    .from('archive_reasons')
    .insert({ organization_id: orgId, label, position } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ArchiveReason;
}

export async function addArchiveReason(orgId: string, label: string): Promise<ArchiveReason> {
  const { data, error } = await supabase.rpc('add_archive_reason' as any, {
    p_org_id: orgId,
    p_label: label,
  });
  if (error) throw error;
  return data as unknown as ArchiveReason;
}

export async function updateArchiveReason(id: string, updates: Partial<Pick<ArchiveReason, 'label' | 'is_active' | 'position'>>) {
  const { error } = await supabase
    .from('archive_reasons')
    .update(updates as any)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteArchiveReason(id: string) {
  const { error } = await supabase
    .from('archive_reasons')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function seedDefaultReasons(orgId: string) {
  const defaults = [
    { organization_id: orgId, label: 'Contratou concorrente', position: 0 },
    { organization_id: orgId, label: 'Não tem perfil de cliente ideal', position: 1 },
    { organization_id: orgId, label: 'Demora no follow-up', position: 2 },
  ];
  const { error } = await supabase
    .from('archive_reasons')
    .insert(defaults as any[]);
  if (error) throw error;
}
