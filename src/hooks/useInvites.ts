import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { listInvites, createInvite, revokeInvite, deleteInvite, listInviteLogs } from '@/services/invites';
import type { OrgRole } from '@/types';

export function useInvites() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['org-invites', orgId],
    queryFn: () => listInvites(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: (params: { role: OrgRole; expires_in_days: number | null; max_uses: number | null }) =>
      createInvite({ organization_id: organization!.id, ...params }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-invites'] });
      qc.invalidateQueries({ queryKey: ['invite-logs'] });
    },
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeInvite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-invites'] });
      qc.invalidateQueries({ queryKey: ['invite-logs'] });
    },
  });
}

export function useDeleteInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInvite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-invites'] });
      qc.invalidateQueries({ queryKey: ['invite-logs'] });
    },
  });
}

export function useInviteAuditLog(page: number, events?: string[], pageSize = 20) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['invite-logs', orgId, page, events, pageSize],
    queryFn: () => listInviteLogs(orgId!, page, pageSize, events),
    enabled: !!orgId,
  });
}
