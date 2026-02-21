import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useBulkMoveLeads, useBulkAssignLeads, useBulkDeleteLeads } from '@/hooks/useLeads';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { toast } from 'sonner';
import { Trash2, ArrowRight, UserPlus } from 'lucide-react';
import type { Stage } from '@/types';

interface BulkActionsBarProps {
  selectedIds: string[];
  stages: Stage[];
  onClear: () => void;
}

export function BulkActionsBar({ selectedIds, stages, onClear }: BulkActionsBarProps) {
  const bulkMove = useBulkMoveLeads();
  const bulkAssign = useBulkAssignLeads();
  const bulkDelete = useBulkDeleteLeads();
  const { data: members } = useOrgMembers();

  const handleMove = async (stageId: string) => {
    try {
      await bulkMove.mutateAsync({ leadIds: selectedIds, stageId });
      toast.success(`${selectedIds.length} leads movidos`);
      onClear();
    } catch { toast.error('Erro ao mover leads'); }
  };

  const handleAssign = async (userId: string) => {
    try {
      await bulkAssign.mutateAsync({ leadIds: selectedIds, assignedTo: userId === 'none' ? null : userId });
      toast.success(`${selectedIds.length} leads atribuídos`);
      onClear();
    } catch { toast.error('Erro ao atribuir leads'); }
  };

  const handleDelete = async () => {
    try {
      await bulkDelete.mutateAsync(selectedIds);
      toast.success(`${selectedIds.length} leads excluídos`);
      onClear();
    } catch { toast.error('Erro ao excluir leads'); }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
      <span className="text-sm font-medium">{selectedIds.length} selecionado(s)</span>

      <Select onValueChange={handleMove}>
        <SelectTrigger className="w-[180px] h-8">
          <ArrowRight className="h-3.5 w-3.5 mr-1" />
          <SelectValue placeholder="Mover para etapa" />
        </SelectTrigger>
        <SelectContent>
          {stages.map(s => (
            <SelectItem key={s.id} value={s.id}>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={handleAssign}>
        <SelectTrigger className="w-[180px] h-8">
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          <SelectValue placeholder="Atribuir" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhum</SelectItem>
          {members?.map(m => (
            <SelectItem key={m.user_id} value={m.user_id}>
              <span className="flex items-center gap-2">
                <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px]">{m.profile?.full_name?.[0]}</AvatarFallback></Avatar>
                {m.profile?.full_name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.length} leads?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button variant="ghost" size="sm" onClick={onClear}>Limpar</Button>
    </div>
  );
}
