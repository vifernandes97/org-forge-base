import { supabase } from '@/integrations/supabase/client';
import type { Organization, OrganizationMember } from '@/types';

export async function getUserOrganizations(): Promise<(OrganizationMember & { organizations: Organization })[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('*, organizations(*)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as any;
}

export async function createOrganization(name: string, slug: string) {
  const { data, error } = await supabase.rpc('create_organization_with_owner', {
    p_name: name,
    p_slug: slug,
  });
  if (error) throw error;
  return data;
}

export async function checkSlugAvailable(slug: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return !data;
}
