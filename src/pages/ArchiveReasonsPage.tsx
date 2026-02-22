import { useState } from 'react';
import { Archive, Plus, Trash2, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  useArchiveReasons,
  useCreateArchiveReason,
  useUpdateArchiveReason,
  useDeleteArchiveReason,
  useSeedDefaultReasons,
} from '@/hooks/useArchiveReasons';

export default function ArchiveReasonsPage() {
  const { data: reasons, isLoading } = useArchiveReasons();
  const createReason = useCreateArchiveReason();
  const updateReason = useUpdateArchiveReason();
  const deleteReason = useDeleteArchiveReason();
  const seedDefaults = useSeedDefaultReasons();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    try {
      await createReason.mutateAsync({ label: newLabel.trim(), position: (reasons?.length || 0) });
      toast.success('Motivo criado!');
      setNewLabel('');
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar motivo');
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await updateReason.mutateAsync({ id, updates: { is_active: isActive } });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReason.mutateAsync(id);
      toast.success('Motivo excluído!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      await seedDefaults.mutateAsync();
      toast.success('Motivos padrão criados!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar motivos padrão');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="h-6 w-6" /> Motivos de Arquivamento
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie os motivos disponíveis ao arquivar um lead.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Motivo
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : reasons && reasons.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Nenhum motivo cadastrado</CardTitle>
            <CardDescription>Crie motivos padrão para começar.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={handleSeedDefaults} disabled={seedDefaults.isPending}>
              <PackagePlus className="h-4 w-4 mr-1" /> Criar motivos padrão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(reasons || []).map(reason => (
            <div
              key={reason.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-3">
                <Switch
                  checked={reason.is_active}
                  onCheckedChange={v => handleToggle(reason.id, v)}
                />
                <span className={reason.is_active ? '' : 'text-muted-foreground line-through'}>
                  {reason.label}
                </span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir motivo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Leads que usam este motivo manterão o registro, mas o motivo não estará mais disponível.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(reason.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Motivo de Arquivamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Nome do motivo</Label>
            <Input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Ex: Cliente sem orçamento"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newLabel.trim() || createReason.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
