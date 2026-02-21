import { supabase } from '@/integrations/supabase/client';
import type { OrgRole } from '@/types';

export interface MemberWithProfile {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  accepted_at: string | null;
  invited_at: string | null;
  invited_email: string | null;
  profile: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

export async function getOrgMembersWithProfiles(orgId: string): Promise<MemberWithProfile[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('*, profile:profiles!organization_members_user_id_fkey(id, full_name, email, avatar_url)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as any;
}

export async function findProfileByEmail(email: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function inviteMember(orgId: string, email: string, role: OrgRole) {
  // Find profile by email
  const profile = await findProfileByEmail(email);
  if (!profile) {
    throw new Error('Usuário não encontrado. Ele precisa se registrar primeiro.');
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', profile.id)
    .maybeSingle();
  
  if (existing) {
    throw new Error('Este usuário já é membro da organização.');
  }

  const { error } = await supabase
    .from('organization_members')
    .insert({
      organization_id: orgId,
      user_id: profile.id,
      role,
      accepted_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export async function updateMemberRole(memberId: string, role: OrgRole) {
  const { error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('id', memberId);
  if (error) throw error;
}

export async function removeMember(memberId: string) {
  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId);
  if (error) throw error;
}
