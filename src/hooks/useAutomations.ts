import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getAutomations, createAutomation, updateAutomation, deleteAutomation } from '@/services/automations';

export function useAutomations() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['automations', orgId],
    queryFn: () => getAutomations(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: createAutomation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations', organization?.id] });
    },
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; name?: string; is_active?: boolean; trigger_funnel_id?: string; trigger_stage_id?: string; action_funnel_id?: string; action_stage_id?: string | null }) =>
      updateAutomation(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations', organization?.id] });
    },
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: deleteAutomation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations', organization?.id] });
    },
  });
}
