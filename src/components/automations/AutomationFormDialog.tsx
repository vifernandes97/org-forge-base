import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFunnels } from '@/hooks/useFunnels';
import { useStages } from '@/hooks/useStages';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCreateAutomation } from '@/hooks/useAutomations';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AutomationFormDialog({ open, onOpenChange }: Props) {
  const { organization } = useOrganization();
  const { data: funnels } = useFunnels();
  const createAutomation = useCreateAutomation();

  const [name, setName] = useState('');
  const [triggerFunnelId, setTriggerFunnelId] = useState('');
  const [triggerStageId, setTriggerStageId] = useState('');
  const [actionFunnelId, setActionFunnelId] = useState('');
  const [actionStageId, setActionStageId] = useState('');

  const { data: triggerStages } = useStages(triggerFunnelId || undefined);
  const { data: actionStages } = useStages(actionFunnelId || undefined);

  useEffect(() => {
    if (open) {
      setName('');
      setTriggerFunnelId('');
      setTriggerStageId('');
      setActionFunnelId('');
      setActionStageId('');
    }
  }, [open]);

  // Reset stage when funnel changes
  useEffect(() => { setTriggerStageId(''); }, [triggerFunnelId]);
  useEffect(() => { setActionStageId(''); }, [actionFunnelId]);

  const canSubmit = name.trim() && triggerFunnelId && triggerStageId && actionFunnelId;

  const handleSubmit = async () => {
    if (!canSubmit || !organization) return;
    try {
      await createAutomation.mutateAsync({
        organization_id: organization.id,
        name: name.trim(),
        trigger_funnel_id: triggerFunnelId,
        trigger_stage_id: triggerStageId,
        action_funnel_id: actionFunnelId,
        action_stage_id: actionStageId || null,
      });
      toast.success('Automação criada!');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar automação');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Automação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Conversão → Pós-venda" />
          </div>

          <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium text-muted-foreground">Quando o lead chegar em...</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Funil de origem</Label>
                <Select value={triggerFunnelId} onValueChange={setTriggerFunnelId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(funnels || []).map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Etapa gatilho</Label>
                <Select value={triggerStageId} onValueChange={setTriggerStageId} disabled={!triggerFunnelId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(triggerStages || []).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium text-muted-foreground">Mover automaticamente para...</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Funil de destino</Label>
                <Select value={actionFunnelId} onValueChange={setActionFunnelId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(funnels || []).map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Etapa de destino</Label>
                <Select value={actionStageId} onValueChange={setActionStageId} disabled={!actionFunnelId}>
                  <SelectTrigger><SelectValue placeholder="Primeira etapa" /></SelectTrigger>
                  <SelectContent>
                    {(actionStages || []).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Se nenhuma etapa for selecionada, o lead entrará na primeira etapa do funil.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || createAutomation.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
