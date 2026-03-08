import { useState } from 'react';
import { Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useFunnels } from '@/hooks/useFunnels';
import { supabase } from '@/integrations/supabase/client';
import type { Stage } from '@/types';
import {
  useStageTaskTemplates,
  useCreateStageTaskTemplate,
  useUpdateStageTaskTemplate,
  useDeleteStageTaskTemplate,
} from '@/hooks/useStageTaskTemplates';
import { AutomationCard } from '@/components/automations/AutomationCard';
import { StageTaskTemplateDialog } from '@/components/automations/StageTaskTemplateDialog';
import type { StageTaskTemplate } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function AutomationsPage() {
  const { organization } = useOrganization();
  const { data: templates, isLoading } = useStageTaskTemplates();
  const { data: funnels } = useFunnels();
  const createMut = useCreateStageTaskTemplate();
  const updateMut = useUpdateStageTaskTemplate();
  const deleteMut = useDeleteStageTaskTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StageTaskTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleSubmit = async (values: any) => {
    if (!organization) return;
    const { funnel_id, ...rest } = values;

    // Clean trigger fields based on trigger_type
    if (rest.trigger_type === 'stage_enter') {
      rest.trigger_status = null;
    } else {
      rest.stage_id = null;
    }

    // Clean action fields based on action_type
    if (rest.action_type === 'send_webhook') {
      rest.task_type = 'other';
      rest.priority = 'medium';
      rest.due_hours = 24;
      rest.assign_to_lead_owner = false;
      rest.description = null;
      rest.target_funnel_id = null;
      rest.target_stage_id = null;
    } else if (rest.action_type === 'move_lead') {
      rest.task_type = 'other';
      rest.priority = 'medium';
      rest.due_hours = 24;
      rest.assign_to_lead_owner = false;
      rest.description = null;
      rest.webhook_url = null;
      rest.webhook_secret = null;
      rest.target_funnel_id = rest.target_funnel_id || null;
      rest.target_stage_id = rest.target_stage_id || null;
    } else {
      rest.webhook_url = null;
      rest.webhook_secret = null;
      rest.target_funnel_id = null;
      rest.target_stage_id = null;
    }

    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, updates: rest });
    } else {
      await createMut.mutateAsync({ ...rest, organization_id: organization.id });
    }
    setDialogOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6" />
            Automações
          </h1>
          <p className="text-muted-foreground text-sm">
            Configure ações automáticas quando leads entram em etapas ou mudam de status.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nova Automação
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => (
            <div key={i} className="h-36 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : !templates?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Zap className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">Nenhuma automação configurada</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm">
            Crie automações para gerar tarefas, disparar webhooks ou mover leads automaticamente.
          </p>
          <Button className="mt-4" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Criar Primeira Automação
          </Button>
        </div>
      ) : (
        <AutomationsList
          organizationId={organization?.id || ''}
          templates={templates}
          funnels={funnels || []}
          onEdit={(t) => { setEditing(t); setDialogOpen(true); }}
          onDelete={(id) => setDeleteTarget(id)}
          onToggle={(id, active) => updateMut.mutate({ id, updates: { is_active: active } })}
        />
      )}

      <StageTaskTemplateDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}
        onSubmit={handleSubmit}
        template={editing}
        loading={createMut.isPending || updateMut.isPending}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) deleteMut.mutate(deleteTarget); setDeleteTarget(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AutomationsList({
  templates,
  funnels,
  organizationId,
  onEdit,
  onDelete,
  onToggle,
}: {
  templates: StageTaskTemplate[];
  funnels: any[];
  organizationId: string;
  onEdit: (t: StageTaskTemplate) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const { data: allStages } = useQuery({
    queryKey: ['all_stages', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stages')
        .select('*')
        .eq('organization_id', organizationId)
        .order('position');
      if (error) throw error;
      return data as unknown as Stage[];
    },
    enabled: !!organizationId,
  });

  const stageMap = Object.fromEntries((allStages || []).map(s => [s.id, s]));
  const funnelMap = Object.fromEntries(funnels.map(f => [f.id, f]));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {templates.map(t => {
        const stage = t.stage_id ? stageMap[t.stage_id] : undefined;
        const funnel = stage ? funnelMap[stage.funnel_id] : undefined;
        const targetFunnel = t.target_funnel_id ? funnelMap[t.target_funnel_id] : undefined;
        const targetStage = t.target_stage_id ? stageMap[t.target_stage_id] : undefined;
        return (
          <AutomationCard
            key={t.id}
            template={t}
            stage={stage}
            funnel={funnel}
            targetFunnel={targetFunnel}
            targetStage={targetStage}
            onEdit={() => onEdit(t)}
            onDelete={() => onDelete(t.id)}
            onToggle={(active) => onToggle(t.id, active)}
          />
        );
      })}
    </div>
  );
}
