import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLeadActivities, createActivity } from '@/services/activities';

export function useLeadActivities(leadId: string | undefined, page: number, pageSize = 20) {
  return useQuery({
    queryKey: ['lead-activities', leadId, page],
    queryFn: () => getLeadActivities(leadId!, page, pageSize),
    enabled: !!leadId,
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createActivity,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead-activities', vars.lead_id] });
      qc.invalidateQueries({ queryKey: ['lead', vars.lead_id] });
      qc.invalidateQueries({ queryKey: ['leads-kanban'] });
      qc.invalidateQueries({ queryKey: ['leads-list'] });
    },
  });
}
