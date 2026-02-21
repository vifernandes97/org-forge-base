import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getOrgMembers } from '@/services/leads';

export function useOrgMembers() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['org-members', orgId],
    queryFn: () => getOrgMembers(orgId!),
    enabled: !!orgId,
  });
}
