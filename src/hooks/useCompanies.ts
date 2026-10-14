import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  getCompanies, getCompany, createCompany, updateCompany, getSegments, mergeCompanies, getCompanyCounts,
  type CompanyInput,
} from '@/services/companies';
import {
  getCompanyContacts, createContact, updateContact, deleteContact, type ContactInput,
} from '@/services/contacts';
import { linkContact, unlinkContact, setPrimaryContact, changeLeadCompany } from '@/services/leadContacts';

export function invalidateLeadData(qc: QueryClient) {
  for (const k of ['leads', 'lead', 'leads-kanban', 'leads-list', 'companies', 'company', 'company-contacts', 'segments', 'tasks', 'activities']) {
    qc.invalidateQueries({ queryKey: [k] });
  }
}

export function useCompanies() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['companies', orgId],
    queryFn: () => getCompanies(orgId!),
    enabled: !!orgId,
  });
}

export function useCompany(id: string | null | undefined) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: () => getCompany(id!),
    enabled: !!id,
  });
}

export function useCompanyCounts(id: string | null | undefined) {
  return useQuery({
    queryKey: ['company', id, 'counts'],
    queryFn: () => getCompanyCounts(id!),
    enabled: !!id,
  });
}

export function useSegments() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['segments', orgId],
    queryFn: () => getSegments(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: (input: CompanyInput) => createCompany(organization!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['segments'] });
    },
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CompanyInput> }) => updateCompany(id, input),
    onSuccess: () => invalidateLeadData(qc),
  });
}

export function useMergeCompanies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, sourceId }: { targetId: string; sourceId: string }) => mergeCompanies(targetId, sourceId),
    onSuccess: () => invalidateLeadData(qc),
  });
}

export function useCompanyContacts(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ['company-contacts', companyId],
    queryFn: () => getCompanyContacts(companyId!),
    enabled: !!companyId,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: ({ companyId, input }: { companyId: string; input: ContactInput }) =>
      createContact(organization!.id, companyId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-contacts'] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ContactInput> }) => updateContact(id, input),
    onSuccess: () => invalidateLeadData(qc),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => invalidateLeadData(qc),
  });
}

export function useLinkContact() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: ({ leadId, contactId, isPrimary }: { leadId: string; contactId: string; isPrimary?: boolean }) =>
      linkContact(organization!.id, leadId, contactId, isPrimary),
    onSuccess: () => invalidateLeadData(qc),
  });
}

export function useUnlinkContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, contactId }: { leadId: string; contactId: string }) => unlinkContact(leadId, contactId),
    onSuccess: () => invalidateLeadData(qc),
  });
}

export function useSetPrimaryContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, contactId }: { leadId: string; contactId: string }) => setPrimaryContact(leadId, contactId),
    onSuccess: () => invalidateLeadData(qc),
  });
}

export function useChangeLeadCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, companyId }: { leadId: string; companyId: string }) => changeLeadCompany(leadId, companyId),
    onSuccess: () => invalidateLeadData(qc),
  });
}
