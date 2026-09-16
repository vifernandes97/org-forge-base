import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  getArchiveReasons,
  getActiveArchiveReasons,
  createArchiveReason,
  addArchiveReason,
  updateArchiveReason,
  deleteArchiveReason,
  seedDefaultReasons,
} from '@/services/archiveReasons';

export function useArchiveReasons() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['archive-reasons', orgId],
    queryFn: () => getArchiveReasons(orgId!),
    enabled: !!orgId,
  });
}

export function useActiveArchiveReasons() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['archive-reasons-active', orgId],
    queryFn: () => getActiveArchiveReasons(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateArchiveReason() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: ({ label, position }: { label: string; position: number }) =>
      createArchiveReason(organization!.id, label, position),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archive-reasons'] });
      qc.invalidateQueries({ queryKey: ['archive-reasons-active'] });
    },
  });
}

export function useAddArchiveReason() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: (label: string) => addArchiveReason(organization!.id, label),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archive-reasons'] });
      qc.invalidateQueries({ queryKey: ['archive-reasons-active'] });
    },
  });
}

export function useUpdateArchiveReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateArchiveReason>[1] }) =>
      updateArchiveReason(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archive-reasons'] });
      qc.invalidateQueries({ queryKey: ['archive-reasons-active'] });
    },
  });
}

export function useDeleteArchiveReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteArchiveReason,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archive-reasons'] });
      qc.invalidateQueries({ queryKey: ['archive-reasons-active'] });
    },
  });
}

export function useSeedDefaultReasons() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: () => seedDefaultReasons(organization!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archive-reasons'] });
      qc.invalidateQueries({ queryKey: ['archive-reasons-active'] });
    },
  });
}
