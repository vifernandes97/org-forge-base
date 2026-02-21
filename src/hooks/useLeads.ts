import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getLeads, getLead, createLead, updateLead, deleteLead, upsertCustomFieldValues } from '@/services/leads';

export function useLeads() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['leads', orgId],
    queryFn: () => getLeads(orgId!),
    enabled: !!orgId,
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: () => getLead(id!),
    enabled: !!id,
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: async (data: { lead: Parameters<typeof createLead>[0]; customFields?: { field_definition_id: string; value: string | null }[] }) => {
      const lead = await createLead(data.lead);
      if (data.customFields?.length) {
        await upsertCustomFieldValues(lead.id, data.customFields);
      }
      return lead;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads', organization?.id] });
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: async (data: { id: string; updates: Parameters<typeof updateLead>[1]; customFields?: { field_definition_id: string; value: string | null }[] }) => {
      const lead = await updateLead(data.id, data.updates);
      if (data.customFields?.length) {
        await upsertCustomFieldValues(lead.id, data.customFields);
      }
      return lead;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['leads', organization?.id] });
      qc.invalidateQueries({ queryKey: ['lead', vars.id] });
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: deleteLead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads', organization?.id] });
    },
  });
}
