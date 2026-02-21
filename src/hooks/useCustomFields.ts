import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CustomFieldDefinition } from '@/types';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  getCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  reorderCustomFields,
} from '@/services/customFields';

export function useCustomFields() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['custom-fields', orgId],
    queryFn: () => getCustomFields(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateCustomField() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: createCustomField,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', organization?.id] });
    },
  });
}

export function useUpdateCustomField() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Partial<Pick<CustomFieldDefinition, 'field_label' | 'field_name' | 'field_type' | 'options' | 'is_required' | 'is_active'>>) =>
      updateCustomField(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', organization?.id] });
    },
  });
}

export function useDeleteCustomField() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: deleteCustomField,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', organization?.id] });
    },
  });
}

export function useReorderCustomFields() {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: (fields: { id: string; position: number }[]) =>
      reorderCustomFields(fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', organization?.id] });
    },
  });
}
