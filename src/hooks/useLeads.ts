import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { LeadFilters } from '@/types';
import {
  getLeads, getLead, createLead, updateLead, deleteLead,
  upsertCustomFieldValues, getLeadsByFunnel, getLeadsListPaginated,
  moveLeadToStage, bulkMoveLeads, bulkAssignLeads, bulkDeleteLeads, bulkArchiveLeads,
  archiveLead, unarchiveLead,
} from '@/services/leads';

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

export function useLeadsByFunnel(funnelId: string | undefined, filters?: LeadFilters) {
  return useQuery({
    queryKey: ['leads-kanban', funnelId, filters],
    queryFn: () => getLeadsByFunnel(funnelId!, filters),
    enabled: !!funnelId,
  });
}

export function useLeadsList(
  funnelId: string | undefined,
  page: number,
  pageSize: number,
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  filters?: LeadFilters
) {
  return useQuery({
    queryKey: ['leads-list', funnelId, page, pageSize, sortBy, sortOrder, filters],
    queryFn: () => getLeadsListPaginated(funnelId!, page, pageSize, sortBy, sortOrder, filters),
    enabled: !!funnelId,
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
      qc.invalidateQueries({ queryKey: ['leads-kanban'] });
      qc.invalidateQueries({ queryKey: ['leads-list'] });
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
      qc.invalidateQueries({ queryKey: ['leads-kanban'] });
      qc.invalidateQueries({ queryKey: ['leads-list'] });
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
      qc.invalidateQueries({ queryKey: ['leads-kanban'] });
      qc.invalidateQueries({ queryKey: ['leads-list'] });
    },
  });
}

export function useMoveLeadToStage(funnelId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, stageId }: { leadId: string; stageId: string }) =>
      moveLeadToStage(leadId, stageId),
    onMutate: async ({ leadId, stageId }) => {
      await qc.cancelQueries({ queryKey: ['leads-kanban'] });
      const queries = qc.getQueriesData({ queryKey: ['leads-kanban', funnelId] });
      const prev = queries[0]?.[1];
      qc.setQueriesData({ queryKey: ['leads-kanban', funnelId] }, (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((l: any) =>
          l.id === leadId ? { ...l, stage_id: stageId, stage_entered_at: new Date().toISOString() } : l
        );
      });
      return { prev };
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev) {
        qc.setQueriesData({ queryKey: ['leads-kanban', funnelId] }, ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['leads-kanban'] });
      qc.invalidateQueries({ queryKey: ['leads-list'] });
    },
  });
}

export function useBulkMoveLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadIds, stageId }: { leadIds: string[]; stageId: string }) =>
      bulkMoveLeads(leadIds, stageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads-kanban'] });
      qc.invalidateQueries({ queryKey: ['leads-list'] });
    },
  });
}

export function useBulkAssignLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadIds, assignedTo }: { leadIds: string[]; assignedTo: string | null }) =>
      bulkAssignLeads(leadIds, assignedTo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads-kanban'] });
      qc.invalidateQueries({ queryKey: ['leads-list'] });
    },
  });
}

export function useBulkDeleteLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadIds: string[]) => bulkDeleteLeads(leadIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads-kanban'] });
      qc.invalidateQueries({ queryKey: ['leads-list'] });
    },
  });
}

export function useBulkArchiveLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadIds, reasonId }: { leadIds: string[]; reasonId: string }) =>
      bulkArchiveLeads(leadIds, reasonId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads-kanban'] });
      qc.invalidateQueries({ queryKey: ['leads-list'] });
    },
  });
}

export function useArchiveLead() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: ({ leadId, reasonId }: { leadId: string; reasonId: string }) =>
      archiveLead(leadId, reasonId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['leads', organization?.id] });
      qc.invalidateQueries({ queryKey: ['lead', vars.leadId] });
      qc.invalidateQueries({ queryKey: ['leads-kanban'] });
      qc.invalidateQueries({ queryKey: ['leads-list'] });
    },
  });
}

export function useUnarchiveLead() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: (leadId: string) => unarchiveLead(leadId),
    onSuccess: (_, leadId) => {
      qc.invalidateQueries({ queryKey: ['leads', organization?.id] });
      qc.invalidateQueries({ queryKey: ['lead', leadId] });
      qc.invalidateQueries({ queryKey: ['leads-kanban'] });
      qc.invalidateQueries({ queryKey: ['leads-list'] });
    },
  });
}
