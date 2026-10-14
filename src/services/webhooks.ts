import { getPrimaryContact } from '@/lib/leadDisplay';
import { supabase } from '@/integrations/supabase/client';

export interface WebhookLogFilters {
  success?: boolean | null;
  stageId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
}

export async function getWebhookLogs(orgId: string, filters: WebhookLogFilters = {}) {
  const { page = 0, pageSize = 50 } = filters;
  let query = supabase
    .from('webhook_logs')
    .select('*, stages!inner(name, color)', { count: 'exact' })
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (filters.success !== null && filters.success !== undefined) {
    query = query.eq('success', filters.success);
  }
  if (filters.stageId) {
    query = query.eq('stage_id', filters.stageId);
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

export async function getWebhookStats(orgId: string) {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, successRes, failRes] = await Promise.all([
    supabase
      .from('webhook_logs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    supabase
      .from('webhook_logs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('success', true),
    supabase
      .from('webhook_logs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('success', false)
      .gte('created_at', last24h),
  ]);

  const total = totalRes.count || 0;
  const successCount = successRes.count || 0;
  const failures24h = failRes.count || 0;
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

  return { total, successRate, failures24h };
}

export async function fireWebhook(data: {
  webhook_url: string;
  payload: any;
  organization_id: string;
  stage_id: string;
  lead_id: string;
}) {
  const { error } = await supabase.functions.invoke('fire-webhook', {
    body: data,
  });
  if (error) throw error;
}

export function buildWebhookPayload({
  lead,
  fromStage,
  toStage,
  funnel,
  user,
  organization,
  customFields = {},
}: {
  lead: any;
  fromStage: { id: string; name: string };
  toStage: { id: string; name: string };
  funnel: { id: string; name: string };
  user: { id: string; full_name?: string; email?: string };
  organization: { id: string; name: string };
  customFields?: Record<string, string>;
}) {
  return {
    event: 'lead.stage_changed',
    timestamp: new Date().toISOString(),
    lead: {
      id: lead.id,
      company: lead.company
        ? {
            id: lead.company.id, trade_name: lead.company.trade_name, legal_name: lead.company.legal_name,
            cnpj: lead.company.cnpj, instagram: lead.company.instagram, segment: lead.company.segment,
          }
        : null,
      contacts: (lead.lead_contacts || []).filter((x: any) => x.contact).map((x: any) => ({
        id: x.contact.id, name: x.contact.name, email: x.contact.email, phone: x.contact.phone, is_primary: x.is_primary,
      })),
      /** @deprecated use contacts[is_primary] */
      name: getPrimaryContact(lead)?.name || null,
      /** @deprecated use contacts[is_primary] */
      email: getPrimaryContact(lead)?.email || null,
      /** @deprecated use contacts[is_primary] */
      phone: getPrimaryContact(lead)?.phone || null,
      /** @deprecated use company.segment */
      company_segment: lead.company?.segment || null,
      value: lead.value || 0,
      tags: lead.tags || [],
      priority: lead.priority || 'medium',
      source: lead.source || null,
      custom_fields: customFields,
    },
    transition: {
      previous_stage: { id: fromStage.id, name: fromStage.name },
      new_stage: { id: toStage.id, name: toStage.name },
      funnel: { id: funnel.id, name: funnel.name },
      moved_by: { id: user.id, name: user.full_name || user.email || '' },
      moved_at: new Date().toISOString(),
    },
    organization: {
      id: organization.id,
      name: organization.name,
    },
  };
}
