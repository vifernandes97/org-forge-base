import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFunnel, useUpdateFunnel, useDeleteFunnel, useSetDefaultFunnel } from '@/hooks/useFunnels';
import { useStages } from '@/hooks/useStages';
import { useOrganization } from '@/contexts/OrganizationContext';
import { StageList } from '@/components/funnels/StageList';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function FunnelEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organization, isOwner, isAdmin } = useOrganization();
  const { data: funnel, isLoading: loadingFunnel } = useFunnel(id);
  const { data: stages, isLoading: loadingStages } = useStages(id);
  const updateFunnel = useUpdateFunnel();
  const deleteFunnel = useDeleteFunnel();
  const setDefault = useSetDefaultFunnel();
  const canEdit = isOwner || isAdmin;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialized, setInitialized] = useState(false);

  if (funnel && !initialized) {
    setName(funnel.name);
    setDescription(funnel.description || '');
    setInitialized(true);
  }

  const saveName = (val: string) => {
    if (val.trim().length < 2) return;
    updateFunnel.mutate({ id: id!, name: val.trim() });
  };

  const saveDescription = (val: string) => {
    updateFunnel.mutate({ id: id!, description: val.trim() });
  };

  const handleToggleDefault = (checked: boolean) => {
    if (checked) {
      setDefault.mutate(id!);
      toast.success('Funil definido como padrão');
    } else {
      updateFunnel.mutate({ id: id!, is_default: false });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteFunnel.mutateAsync(id!);
      toast.success('Funil deletado');
      navigate('/settings?tab=funnels');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao deletar funil');
    }
  };

  if (loadingFunnel || loadingStages) {
    return <div className="space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64" /></div>;
  }

  if (!funnel) {
    return <p className="text-muted-foreground">Funil não encontrado.</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/settings?tab=funnels')}>
        <ArrowLeft className="h-4 w-4 mr-2" />Voltar
      </Button>

      <div className="space-y-4">
        <Input
          value={name}
          disabled={!canEdit}
          className="text-xl font-bold border-none shadow-none px-0 focus-visible:ring-0"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => saveName(name)}
        />
        <Textarea
          value={description}
          disabled={!canEdit}
          placeholder="Descrição do funil (opcional)"
          className="resize-none border-none shadow-none px-0 focus-visible:ring-0"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => saveDescription(description)}
        />

        <div className="flex items-center gap-3">
          <Switch
            id="is-default"
            checked={funnel.is_default}
            onCheckedChange={handleToggleDefault}
            disabled={!canEdit}
          />
          <Label htmlFor="is-default">Funil padrão</Label>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Etapas</h2>
        {stages && (
          <StageList
            stages={stages}
            funnelId={id!}
            organizationId={organization!.id}
            canEdit={canEdit}
          />
        )}
      </div>

      {canEdit && (
        <div className="pt-6 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />Deletar Funil
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deletar funil?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Todas as etapas serão removidas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Deletar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
