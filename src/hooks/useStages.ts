import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStages, createStage, updateStage, deleteStage, reorderStages } from '@/services/stages';

export function useStages(funnelId: string | undefined) {
  return useQuery({
    queryKey: ['stages', funnelId],
    queryFn: () => getStages(funnelId!),
    enabled: !!funnelId,
  });
}

export function useCreateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createStage,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['stages', data.funnel_id] });
    },
  });
}

export function useUpdateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, funnelId, ...updates }: { id: string; funnelId: string; name?: string; color?: string; sla_hours?: number | null; webhook_url?: string | null }) =>
      updateStage(id, updates),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['stages', vars.funnelId] });
    },
  });
}

export function useDeleteStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; funnelId: string }) => deleteStage(id),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['stages', vars.funnelId] });
    },
  });
}

export function useReorderStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ funnelId, stages }: { funnelId: string; stages: { id: string; position: number }[] }) =>
      reorderStages(stages),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['stages', vars.funnelId] });
    },
  });
}
