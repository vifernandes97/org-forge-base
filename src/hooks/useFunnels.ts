import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getFunnels, getFunnel, createFunnel, updateFunnel, deleteFunnel, setDefaultFunnel } from '@/services/funnels';

export function useFunnels() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['funnels', orgId],
    queryFn: () => getFunnels(orgId!),
    enabled: !!orgId,
  });
}

export function useFunnel(id: string | undefined) {
  return useQuery({
    queryKey: ['funnel', id],
    queryFn: () => getFunnel(id!),
    enabled: !!id,
  });
}

export function useCreateFunnel() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description: string | null }) =>
      createFunnel(organization!.id, name, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['funnels', organization?.id] });
    },
  });
}

export function useUpdateFunnel() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; name?: string; description?: string; is_default?: boolean }) =>
      updateFunnel(id, updates),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['funnels', organization?.id] });
      qc.invalidateQueries({ queryKey: ['funnel', vars.id] });
    },
  });
}

export function useDeleteFunnel() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: (id: string) => deleteFunnel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['funnels', organization?.id] });
    },
  });
}

export function useSetDefaultFunnel() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: (funnelId: string) => setDefaultFunnel(organization!.id, funnelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['funnels', organization?.id] });
    },
  });
}
