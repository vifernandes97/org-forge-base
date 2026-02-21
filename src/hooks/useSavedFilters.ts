import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getSavedFilters, createSavedFilter, deleteSavedFilter } from '@/services/savedFilters';

export function useSavedFilters() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['saved-filters', orgId],
    queryFn: () => getSavedFilters(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateSavedFilter() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: createSavedFilter,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-filters', organization?.id] });
    },
  });
}

export function useDeleteSavedFilter() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: deleteSavedFilter,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-filters', organization?.id] });
    },
  });
}
