import { useCustomFields, useCreateCustomField } from '@/hooks/useCustomFields';
import { useOrganization } from '@/contexts/OrganizationContext';
import { CustomFieldList } from '@/components/custom-fields/CustomFieldList';
import { CustomFieldDialog } from '@/components/custom-fields/CustomFieldDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { CustomFieldType } from '@/types';

export default function CustomFieldsPage() {
  const { organization, isOwner, isAdmin } = useOrganization();
  const { data: fields, isLoading } = useCustomFields();
  const createField = useCreateCustomField();
  const canEdit = isOwner || isAdmin;

  const handleCreate = (data: {
    field_label: string;
    field_name: string;
    field_type: CustomFieldType;
    options?: string[] | null;
    is_required: boolean;
  }) => {
    createField.mutate(
      {
        organization_id: organization!.id,
        field_label: data.field_label,
        field_name: data.field_name,
        field_type: data.field_type,
        options: data.options,
        is_required: data.is_required,
        position: fields?.length ?? 0,
      },
      {
        onSuccess: () => toast.success('Campo criado com sucesso'),
        onError: (err: any) => toast.error(err.message || 'Erro ao criar campo'),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campos Personalizados</h1>
          <p className="text-muted-foreground">Defina os campos extras para seus negócios.</p>
        </div>
        {canEdit && (
          <CustomFieldDialog
            trigger={<Button><Plus className="h-4 w-4 mr-2" />Novo Campo</Button>}
            onSave={handleCreate}
            isPending={createField.isPending}
          />
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : fields?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground mb-4">Nenhum campo personalizado criado ainda.</p>
          {canEdit && (
            <CustomFieldDialog
              trigger={<Button variant="outline"><Plus className="h-4 w-4 mr-2" />Criar primeiro campo</Button>}
              onSave={handleCreate}
              isPending={createField.isPending}
            />
          )}
        </div>
      ) : (
        <CustomFieldList fields={fields!} canEdit={canEdit} />
      )}
    </div>
  );
}
