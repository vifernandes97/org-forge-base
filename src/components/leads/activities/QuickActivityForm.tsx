import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateActivity } from '@/hooks/useActivities';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { MessageSquare, Phone, Mail, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type FormType = 'note' | 'call' | 'email' | 'meeting' | null;

const buttons: { type: FormType & string; icon: React.ElementType; label: string }[] = [
  { type: 'note', icon: MessageSquare, label: 'Nota' },
  { type: 'call', icon: Phone, label: 'Ligação' },
  { type: 'email', icon: Mail, label: 'E-mail' },
  { type: 'meeting', icon: Calendar, label: 'Reunião' },
];

export function QuickActivityForm({ leadId }: { leadId: string }) {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const createActivity = useCreateActivity();
  const [activeType, setActiveType] = useState<FormType>(null);
  const [description, setDescription] = useState('');
  const [extra, setExtra] = useState('');

  const reset = () => {
    setActiveType(null);
    setDescription('');
    setExtra('');
  };

  const handleSubmit = async () => {
    if (!description.trim() || !user || !organization) return;

    const titleMap: Record<string, string> = {
      note: 'Adicionou uma nota',
      call: `Registrou uma ligação${extra ? ` (${extra} min)` : ''}`,
      email: `Enviou um e-mail${extra ? `: ${extra}` : ''}`,
      meeting: `Agendou uma reunião${extra ? ` para ${extra}` : ''}`,
    };

    const metadata: Record<string, any> = {};
    if (activeType === 'call' && extra) metadata.duration_minutes = parseInt(extra);
    if (activeType === 'email' && extra) metadata.subject = extra;
    if (activeType === 'meeting' && extra) metadata.scheduled_at = extra;

    try {
      await createActivity.mutateAsync({
        organization_id: organization.id,
        lead_id: leadId,
        user_id: user.id,
        activity_type: activeType!,
        title: titleMap[activeType!],
        description: description.trim(),
        metadata: Object.keys(metadata).length ? metadata : null,
      });
      toast.success('Atividade registrada!');
      reset();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar atividade');
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
      <div className="flex gap-1.5 flex-wrap">
        {buttons.map(b => (
          <Button
            key={b.type}
            variant={activeType === b.type ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveType(activeType === b.type ? null : b.type)}
            className="h-8 gap-1.5 px-2.5 text-xs"
          >
            <b.icon className="h-3.5 w-3.5" />
            {b.label}
          </Button>
        ))}
      </div>

      {activeType && (
        <div className="space-y-2">
          {activeType === 'call' && (
            <div className="space-y-1">
              <Label className="text-xs">Duração (minutos)</Label>
              <Input type="number" placeholder="Ex: 15" value={extra} onChange={e => setExtra(e.target.value)} className="h-8" />
            </div>
          )}
          {activeType === 'email' && (
            <div className="space-y-1">
              <Label className="text-xs">Assunto</Label>
              <Input placeholder="Assunto do e-mail" value={extra} onChange={e => setExtra(e.target.value)} className="h-8" />
            </div>
          )}
          {activeType === 'meeting' && (
            <div className="space-y-1">
              <Label className="text-xs">Data/hora</Label>
              <Input type="datetime-local" value={extra} onChange={e => setExtra(e.target.value)} className="h-8" />
            </div>
          )}
          <Textarea
            placeholder="Descreva a atividade..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={reset}>Cancelar</Button>
            <Button size="sm" onClick={handleSubmit} disabled={!description.trim() || createActivity.isPending}>
              {createActivity.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
