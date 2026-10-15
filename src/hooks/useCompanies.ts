import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  getCompanies, getCompany, createCompany, updateCompany, getSegments, mergeCompanies, getCompanyCounts,
  getSegmentUsage, addSegment, updateSegment, deleteSegment, reorderSegments, mergeSegments,
  type CompanyInput,
} from '@/services/companies';
import {
  getCompanyContacts, createContact, updateContact, deleteContact, type ContactInput,
} from '@/services/contacts';
import { linkContact, unlinkContact, setPrimaryContact, changeLeadCompany } from '@/services/leadContacts';

export function invalidateLeadData(qc: QueryClient) {
  for (const k of ['leads', 'lead', 'leads-kanban', 'leads-list', 'companies', 'company', 'company-contacts', 'segments', 'tasks', 'activities', 'companies-list', 'contacts-list', 'company-leads', 'company-activities', 'contact-detail']) {
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
    onSuccess: () => invalidateLeadData(qc),
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
    onSuccess: () => invalidateLeadData(qc),
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

export function useSegmentUsage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({ queryKey: ['segments', 'usage', orgId], queryFn: () => getSegmentUsage(orgId!), enabled: !!orgId });
}

function useSegmentMutation<T>(fn: (v: T, orgId: string) => Promise<any>) {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: (v: T) => fn(v, organization!.id),
    onSuccess: () => invalidateLeadData(qc),
  });
}

export const useAddSegment = () => useSegmentMutation<string>((label, org) => addSegment(org, label));
export const useUpdateSegment = () =>
  useSegmentMutation<{ id: string; updates: { label?: string; is_active?: boolean } }>(({ id, updates }) => updateSegment(id, updates));
export const useDeleteSegment = () => useSegmentMutation<string>(id => deleteSegment(id));
export const useReorderSegments = () => useSegmentMutation<string[]>((ids, org) => reorderSegments(org, ids));
export const useMergeSegments = () =>
  useSegmentMutation<{ sourceId: string; targetId: string }>(({ sourceId, targetId }) => mergeSegments(sourceId, targetId));
