import { supabase } from '@/integrations/supabase/client';
import type { OrgRole } from '@/types';

export interface OrgInvite {
  id: string;
  organization_id: string;
  token: string;
  role: OrgRole;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  created_by: string;
  revoked_at: string | null;
  created_at: string;
}

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function listInvites(orgId: string): Promise<OrgInvite[]> {
  const { data, error } = await supabase
    .from('organization_invites')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as any;
}

export async function createInvite(params: {
  organization_id: string;
  role: OrgRole;
  expires_in_days: number | null;
  max_uses: number | null;
}): Promise<OrgInvite> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const expires_at = params.expires_in_days
    ? new Date(Date.now() + params.expires_in_days * 86400_000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('organization_invites')
    .insert({
      organization_id: params.organization_id,
      role: params.role,
      token: generateToken(),
      max_uses: params.max_uses,
      expires_at,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function revokeInvite(id: string) {
  const { error } = await supabase
    .from('organization_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteInvite(id: string) {
  const { error } = await supabase.from('organization_invites').delete().eq('id', id);
  if (error) throw error;
}

export interface InviteInfo {
  valid: boolean;
  reason?: string;
  organization_id?: string;
  organization_name?: string;
  role?: OrgRole;
  expires_at?: string | null;
  max_uses?: number | null;
  uses_count?: number;
}

export async function getInviteByToken(token: string): Promise<InviteInfo> {
  const { data, error } = await supabase.rpc('get_invite_by_token', { p_token: token });
  if (error) throw error;
  return data as any;
}

export async function acceptInvite(token: string): Promise<{ organization_id: string; already_member: boolean }> {
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
  if (error) throw error;
  return data as any;
}

export function buildInviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}
