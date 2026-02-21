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
  // 1. Create org
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name, slug })
    .select()
    .single();
  if (orgError) throw orgError;

  // 2. Add current user as owner
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: 'owner' as any,
      accepted_at: new Date().toISOString(),
    });
  if (memberError) throw memberError;

  return org;
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
