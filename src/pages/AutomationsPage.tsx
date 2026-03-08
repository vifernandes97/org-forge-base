import { useState } from 'react';
import { Zap, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useAutomations, useUpdateAutomation, useDeleteAutomation } from '@/hooks/useAutomations';
import { useFunnels } from '@/hooks/useFunnels';
import { useStages } from '@/hooks/useStages';
import AutomationFormDialog from '@/components/automations/AutomationFormDialog';

function StageName({ stageId, funnelId }: { stageId: string | null; funnelId: string }) {
  const { data: stages } = useStages(funnelId);
  if (!stageId) {
    const first = stages?.[0];
    return <span className="font-medium">{first?.name || 'Primeira etapa'}</span>;
  }
  const stage = stages?.find(s => s.id === stageId);
  return <span className="font-medium">{stage?.name || '...'}</span>;
}

function FunnelName({ funnelId }: { funnelId: string }) {
  const { data: funnels } = useFunnels();
  const funnel = funnels?.find(f => f.id === funnelId);
  return <span className="font-medium">{funnel?.name || '...'}</span>;
}

export default function AutomationsPage() {
  const { data: automations, isLoading } = useAutomations();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await updateAutomation.mutateAsync({ id, is_active: isActive });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAutomation.mutateAsync(id);
      toast.success('Automação excluída!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6" /> Automações
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure regras para mover leads entre funis automaticamente.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Automação
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : automations && automations.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Nenhuma automação configurada</CardTitle>
            <CardDescription>Crie uma automação para mover leads entre funis automaticamente.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Criar automação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(automations || []).map(auto => (
            <div
              key={auto.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-4">
                <Switch
                  checked={auto.is_active}
                  onCheckedChange={v => handleToggle(auto.id, v)}
                />
                <div className="space-y-1">
                  <p className={`font-medium ${!auto.is_active ? 'text-muted-foreground line-through' : ''}`}>
                    {auto.name}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    Lead chega em <StageName stageId={auto.trigger_stage_id} funnelId={auto.trigger_funnel_id} /> de <FunnelName funnelId={auto.trigger_funnel_id} />
                    <ArrowRight className="h-3.5 w-3.5 inline" />
                    <StageName stageId={auto.action_stage_id} funnelId={auto.action_funnel_id} /> de <FunnelName funnelId={auto.action_funnel_id} />
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Essa ação não pode ser desfeita. Leads já movidos não serão afetados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(auto.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      <AutomationFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
