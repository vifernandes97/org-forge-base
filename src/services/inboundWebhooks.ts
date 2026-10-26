import { supabase } from '@/integrations/supabase/client';

export interface InboundWebhookLogFilters {
  webhookId?: string | null;
  action?: string[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
}

export async function getInboundWebhooks(orgId: string) {
  const { data, error } = await supabase
    .from('inbound_webhooks' as any)
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getInboundWebhook(id: string) {
  const { data, error } = await supabase
    .from('inbound_webhooks' as any)
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createInboundWebhook(payload: {
  organization_id: string;
  name: string;
  funnel_id?: string | null;
  default_source?: string;
  default_assigned_to?: string | null;
  default_tags?: string[];
  duplicate_strategy?: string;
  field_mapping?: Record<string, any>;
}) {
  const api_key = crypto.randomUUID();
  const { data, error } = await supabase
    .from('inbound_webhooks' as any)
    .insert({ ...payload, api_key })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateInboundWebhook(id: string, payload: Record<string, any>) {
  const { data, error } = await supabase
    .from('inbound_webhooks' as any)
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteInboundWebhook(id: string) {
  const { error } = await supabase
    .from('inbound_webhooks' as any)
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function regenerateApiKey(id: string) {
  const newKey = crypto.randomUUID();
  const { data, error } = await supabase
    .from('inbound_webhooks' as any)
    .update({ api_key: newKey })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getInboundWebhookLogs(orgId: string, filters: InboundWebhookLogFilters = {}) {
  const { page = 0, pageSize = 50 } = filters;
  let query = supabase
    .from('inbound_webhook_logs' as any)
    .select('*, inbound_webhooks!inner(name)', { count: 'exact' })
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (filters.webhookId) {
    query = query.eq('inbound_webhook_id', filters.webhookId);
  }
  if (filters.action && filters.action.length > 0) {
    query = query.in('action', filters.action);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function getInboundWebhookLogsByWebhook(webhookId: string, limit = 20) {
  const { data, error } = await supabase
    .from('inbound_webhook_logs' as any)
    .select('*')
    .eq('inbound_webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getInboundWebhookLeadCount(webhookId: string) {
  const { count, error } = await supabase
    .from('inbound_webhook_logs' as any)
    .select('id', { count: 'exact', head: true })
    .eq('inbound_webhook_id', webhookId)
    .in('action', ['created', 'updated']);
  if (error) throw error;
  return count || 0;
}

export async function testInboundWebhook(apiKey: string, payload: Record<string, any>) {
  const url = `${window.location.origin}/api/inbound-webhook`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(payload),
  });
  return res.json();
}
