import { useQuery, useMutation } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getWebhookLogs, getWebhookStats, fireWebhook, type WebhookLogFilters } from '@/services/webhooks';

export function useWebhookLogs(filters: WebhookLogFilters = {}) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['webhook-logs', orgId, filters],
    queryFn: () => getWebhookLogs(orgId!, filters),
    enabled: !!orgId,
  });
}

export function useWebhookStats() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['webhook-stats', orgId],
    queryFn: () => getWebhookStats(orgId!),
    enabled: !!orgId,
    refetchInterval: 30000,
  });
}

export function useFireWebhook() {
  return useMutation({
    mutationFn: fireWebhook,
  });
}
