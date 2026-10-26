import { supabase } from '@/integrations/supabase/client';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  lead_id: string | null;
  read_at: string | null;
  created_at: string;
}

/** Latest notifications of the logged user in the organization (RLS limits to their own). */
export async function getNotifications(organizationId: string, limit = 30) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, lead_id, read_at, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as AppNotification[];
}

export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
}
