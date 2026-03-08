import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  fetchStageTaskTemplates,
  createStageTaskTemplate,
  updateStageTaskTemplate,
  deleteStageTaskTemplate,
} from '@/services/stageTaskTemplates';
import { toast } from 'sonner';

export function useStageTaskTemplates() {
  const { organization } = useOrganization();
  return useQuery({
    queryKey: ['stage_task_templates', organization?.id],
    queryFn: () => fetchStageTaskTemplates(organization!.id),
    enabled: !!organization?.id,
  });
}

export function useCreateStageTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createStageTaskTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stage_task_templates'] });
      toast.success('Automação criada com sucesso');
    },
    onError: () => toast.error('Erro ao criar automação'),
  });
}

export function useUpdateStageTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, any> }) =>
      updateStageTaskTemplate(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stage_task_templates'] });
      toast.success('Automação atualizada');
    },
    onError: () => toast.error('Erro ao atualizar automação'),
  });
}

export function useDeleteStageTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteStageTaskTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stage_task_templates'] });
      toast.success('Automação excluída');
    },
    onError: () => toast.error('Erro ao excluir automação'),
  });
}
