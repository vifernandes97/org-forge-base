import { supabase } from '@/integrations/supabase/client';
import type { Task, TaskWithRelations } from '@/types';

export async function getLeadTasks(leadId: string, orgId?: string) {
  let query = supabase
    .from('tasks')
    .select('*, assigned_profile:profiles!tasks_assigned_to_fkey(*)')
    .eq('lead_id', leadId);
  if (orgId) query = query.eq('organization_id', orgId);
  const { data, error } = await query
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data as unknown as TaskWithRelations[];
}

export async function getMyTasks(userId: string, orgId?: string) {
  let query = supabase
    .from('tasks')
    .select('*, lead:leads!tasks_lead_id_fkey(id, priority, stage_id, company:companies(trade_name, segment_ref:company_segments(id, label, is_active)), lead_contacts(is_primary, contact:contacts(name))), assigned_profile:profiles!tasks_assigned_to_fkey(*)')
    .eq('assigned_to', userId);
  if (orgId) query = query.eq('organization_id', orgId);
  const { data, error } = await query
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data as unknown as TaskWithRelations[];
}

export async function getTaskBadgeCounts(userId: string, orgId?: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  let overdueQuery = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', userId)
    .is('completed_at', null)
    .lt('due_date', now.toISOString());
  let todayQuery = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', userId)
    .is('completed_at', null)
    .gte('due_date', startOfToday)
    .lt('due_date', endOfToday);
  if (orgId) {
    overdueQuery = overdueQuery.eq('organization_id', orgId);
    todayQuery = todayQuery.eq('organization_id', orgId);
  }

  const [overdueRes, todayRes] = await Promise.all([overdueQuery, todayQuery]);
  if (overdueRes.error) throw overdueRes.error;
  if (todayRes.error) throw todayRes.error;
  return { overdue: overdueRes.count || 0, today: todayRes.count || 0 };
}

export async function createTask(data: {
  organization_id: string;
  lead_id: string;
  assigned_to: string;
  title: string;
  description?: string | null;
  task_type: string;
  due_date: string;
  priority: string;
}) {
  const { data: task, error } = await supabase
    .from('tasks')
    .insert(data as any)
    .select()
    .single();
  if (error) throw error;
  return task as unknown as Task;
}

export async function updateTask(id: string, updates: Partial<Task>) {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Task;
}

export async function completeTask(id: string) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ completed_at: new Date().toISOString() } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Task;
}

export async function uncompleteTask(id: string) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ completed_at: null } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Task;
}
