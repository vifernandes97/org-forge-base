import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFunnels } from '@/hooks/useFunnels';
import { useStages } from '@/hooks/useStages';

interface MoveToFunnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFunnelId?: string;
  count?: number;
  isPending?: boolean;
  onConfirm: (funnelId: string, funnelName: string, stageId: string, stageName: string) => Promise<void> | void;
}

export function MoveToFunnelDialog({
  open,
  onOpenChange,
  currentFunnelId,
  count = 1,
  isPending,
  onConfirm,
}: MoveToFunnelDialogProps) {
  const { data: funnels } = useFunnels();
  const [funnelId, setFunnelId] = useState<string>('');
  const [stageId, setStageId] = useState<string>('');
  const { data: stages } = useStages(funnelId || undefined);

  const available = (funnels || []).filter(f => f.id !== currentFunnelId);

  useEffect(() => {
    if (!open) {
      setFunnelId('');
      setStageId('');
    }
  }, [open]);

  useEffect(() => {
    if (stages?.length) {
      setStageId(prev => (stages.some(s => s.id === prev) ? prev : stages[0].id));
    } else {
      setStageId('');
    }
  }, [stages]);

  const handleConfirm = async () => {
    if (!funnelId || !stageId) return;
    const funnelName = available.find(f => f.id === funnelId)?.name || '';
    const stageName = stages?.find(s => s.id === stageId)?.name || '';
    await onConfirm(funnelId, funnelName, stageId, stageName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover para outro funil</DialogTitle>
          <DialogDescription>
            {count > 1
              ? `${count} negócios serão movidos para o funil e etapa escolhidos.`
              : 'Escolha o funil e a etapa de destino deste negócio.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Funil de destino</Label>
            <Select value={funnelId} onValueChange={setFunnelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o funil" />
              </SelectTrigger>
              <SelectContent>
                {available.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {available.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum outro funil disponível nesta empresa.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Etapa de destino</Label>
            <Select value={stageId} onValueChange={setStageId} disabled={!funnelId || !stages?.length}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                {stages?.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!funnelId || !stageId || isPending}>
            {isPending ? 'Movendo...' : 'Mover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
