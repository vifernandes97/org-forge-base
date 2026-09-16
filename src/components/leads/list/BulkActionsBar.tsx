import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useBulkMoveLeads, useBulkAssignLeads, useBulkDeleteLeads, useBulkArchiveLeads, useBulkMoveLeadsToFunnel } from '@/hooks/useLeads';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useActiveArchiveReasons } from '@/hooks/useArchiveReasons';
import { toast } from 'sonner';
import { useState } from 'react';
import { MergeLeadsDialog } from '../MergeLeadsDialog';
import { MoveToFunnelDialog } from '../MoveToFunnelDialog';
import { Trash2, ArrowRight, UserPlus, Archive, Merge, GitBranch } from 'lucide-react';
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
  const bulkArchive = useBulkArchiveLeads();
  const { data: members } = useOrgMembers();
  const { data: archiveReasons } = useActiveArchiveReasons();
  const [mergeOpen, setMergeOpen] = useState(false);
  const [moveFunnelOpen, setMoveFunnelOpen] = useState(false);
  const bulkMoveFunnel = useBulkMoveLeadsToFunnel();

  const handleMoveFunnel = async (funnelId: string, funnelName: string, stageId: string) => {
    try {
      await bulkMoveFunnel.mutateAsync({ leadIds: selectedIds, funnelId, stageId });
      toast.success(`${selectedIds.length} negócios movidos para ${funnelName}`);
      onClear();
    } catch { toast.error('Erro ao mover negócios de funil'); }
  };

  const handleMove = async (stageId: string) => {
    try {
      await bulkMove.mutateAsync({ leadIds: selectedIds, stageId });
      toast.success(`${selectedIds.length} negócios movidos`);
      onClear();
    } catch { toast.error('Erro ao mover negócios'); }
  };

  const handleAssign = async (userId: string) => {
    try {
      await bulkAssign.mutateAsync({ leadIds: selectedIds, assignedTo: userId === 'none' ? null : userId });
      toast.success(`${selectedIds.length} negócios atribuídos`);
      onClear();
    } catch { toast.error('Erro ao atribuir negócios'); }
  };

  const handleArchive = async (reasonId: string) => {
    try {
      await bulkArchive.mutateAsync({ leadIds: selectedIds, reasonId });
      toast.success(`${selectedIds.length} negócios arquivados`);
      onClear();
    } catch { toast.error('Erro ao arquivar negócios'); }
  };

  const handleDelete = async () => {
    try {
      await bulkDelete.mutateAsync(selectedIds);
      toast.success(`${selectedIds.length} negócios excluídos`);
      onClear();
    } catch { toast.error('Erro ao excluir negócios'); }
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

      <Select onValueChange={handleArchive}>
        <SelectTrigger className="w-[180px] h-8">
          <Archive className="h-3.5 w-3.5 mr-1" />
          <SelectValue placeholder="Arquivar" />
        </SelectTrigger>
        <SelectContent>
          {archiveReasons?.map(r => (
            <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="sm"
        disabled={selectedIds.length < 2}
        onClick={() => setMergeOpen(true)}
      >
        <Merge className="h-3.5 w-3.5 mr-1" /> Mesclar
      </Button>

      <MergeLeadsDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        leadIds={selectedIds}
        onMerged={onClear}
      />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.length} negócios?</AlertDialogTitle>
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
