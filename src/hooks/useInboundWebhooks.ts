import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  getInboundWebhooks,
  getInboundWebhook,
  createInboundWebhook,
  updateInboundWebhook,
  deleteInboundWebhook,
  regenerateApiKey,
  getInboundWebhookLogs,
  getInboundWebhookLogsByWebhook,
  testInboundWebhook,
  type InboundWebhookLogFilters,
} from '@/services/inboundWebhooks';

export function useInboundWebhooks() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['inbound-webhooks', orgId],
    queryFn: () => getInboundWebhooks(orgId!),
    enabled: !!orgId,
  });
}

export function useInboundWebhook(id: string | undefined) {
  return useQuery({
    queryKey: ['inbound-webhook', id],
    queryFn: () => getInboundWebhook(id!),
    enabled: !!id,
  });
}

export function useCreateInboundWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createInboundWebhook,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbound-webhooks'] }),
  });
}

export function useUpdateInboundWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) => updateInboundWebhook(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['inbound-webhooks'] });
      qc.invalidateQueries({ queryKey: ['inbound-webhook', vars.id] });
    },
  });
}

export function useDeleteInboundWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteInboundWebhook,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbound-webhooks'] }),
  });
}

export function useRegenerateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: regenerateApiKey,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['inbound-webhooks'] });
      if (data?.id) qc.invalidateQueries({ queryKey: ['inbound-webhook', data.id] });
    },
  });
}

export function useInboundWebhookLogs(filters: InboundWebhookLogFilters = {}) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['inbound-webhook-logs', orgId, filters],
    queryFn: () => getInboundWebhookLogs(orgId!, filters),
    enabled: !!orgId,
  });
}

export function useInboundWebhookLogsByWebhook(webhookId: string | undefined) {
  return useQuery({
    queryKey: ['inbound-webhook-logs-by-webhook', webhookId],
    queryFn: () => getInboundWebhookLogsByWebhook(webhookId!),
    enabled: !!webhookId,
  });
}

export function useTestInboundWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ apiKey, payload }: { apiKey: string; payload: Record<string, any> }) =>
      testInboundWebhook(apiKey, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbound-webhook-logs'] });
      qc.invalidateQueries({ queryKey: ['inbound-webhook-logs-by-webhook'] });
    },
  });
}
