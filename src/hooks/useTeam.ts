import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getOrgMembersWithProfiles, inviteMember, updateMemberRole, removeMember } from '@/services/team';
import type { OrgRole } from '@/types';

export function useTeamMembers() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['team-members', orgId],
    queryFn: () => getOrgMembersWithProfiles(orgId!),
    enabled: !!orgId,
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: OrgRole }) =>
      inviteMember(organization!.id, email, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: OrgRole }) =>
      updateMemberRole(memberId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
  });
}
