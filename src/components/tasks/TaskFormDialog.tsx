import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateTask } from '@/hooks/useTasks';
import { useTaskTypes, useTaskSubtypes } from '@/hooks/useTaskTypes';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
}

export function TaskFormDialog({ open, onOpenChange, leadId }: TaskFormDialogProps) {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const { data: members } = useOrgMembers();
  const createTask = useCreateTask();
  const { data: types } = useTaskTypes();
  const { data: subtypes } = useTaskSubtypes();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('follow_up');
  const [subtypeId, setSubtypeId] = useState('');
  const [assignedTo, setAssignedTo] = useState(user?.id || '');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');

  const activeTypes = (types || []).filter(t => t.is_active);
  const typeSubtypes = (subtypes || []).filter(s => s.is_active && s.task_type_id === types?.find(t => t.code === taskType)?.id);

  const handleTypeChange = (code: string) => {
    setTaskType(code);
    setSubtypeId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate || !organization) return;

    try {
      await createTask.mutateAsync({
        organization_id: organization.id,
        lead_id: leadId,
        assigned_to: assignedTo || user!.id,
        title: title.trim(),
        description: description.trim() || null,
        task_type: taskType,
        task_subtype_id: subtypeId || null,
        due_date: new Date(dueDate).toISOString(),
        priority,
      });
      toast.success('Tarefa criada!');
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setTaskType('follow_up');
      setSubtypeId('');
      setDueDate('');
      setPriority('medium');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar tarefa');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Ligar para o cliente" required />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={taskType} onValueChange={handleTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeTypes.map(t => <SelectItem key={t.id} value={t.code}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {typeSubtypes.length > 0 && (
            <div className="space-y-2">
              <Label>Subtipo</Label>
              <Select value={subtypeId || 'none'} onValueChange={v => setSubtypeId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem subtipo</SelectItem>
                  {typeSubtypes.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prazo *</Label>
              <Input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {members?.map((m: any) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profile?.full_name || m.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createTask.isPending}>
              {createTask.isPending ? 'Criando...' : 'Criar Tarefa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
