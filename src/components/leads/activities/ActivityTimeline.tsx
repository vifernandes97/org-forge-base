import { useState } from 'react';
import { useLeadActivities, useUpdateActivity } from '@/hooks/useActivities';
import { ActivityIcon } from './ActivityIcon';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { LeadActivityWithUser, ActivityType } from '@/types';

const PAGE_SIZE = 20;

export function ActivityTimeline({ leadId }: { leadId: string }) {
  const [page, setPage] = useState(0);
  const [allActivities, setAllActivities] = useState<LeadActivityWithUser[]>([]);
  const { data, isLoading } = useLeadActivities(leadId, page, PAGE_SIZE);

  // Merge pages
  const activities = page === 0 ? (data?.data || []) : [...allActivities, ...(data?.data || [])];
  const hasMore = data ? (page + 1) * PAGE_SIZE < data.count : false;

  const loadMore = () => {
    setAllActivities(activities);
    setPage(p => p + 1);
  };

  if (isLoading && page === 0) {
    return (
      <div className="space-y-4 px-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade registrada.</p>;
  }

  return (
    <div className="relative px-1">
      {/* Vertical line */}
      <div className="absolute left-[16px] top-4 bottom-4 w-px bg-border" />

      <div className="space-y-4">
        {activities.map(activity => (
          <ActivityItem key={activity.id} activity={activity} leadId={leadId} />
        ))}
      </div>

      {hasMore && (
        <div className="text-center mt-4">
          <Button variant="ghost" size="sm" onClick={loadMore} disabled={isLoading}>
            {isLoading ? 'Carregando...' : 'Carregar mais'}
          </Button>
        </div>
      )}
    </div>
  );
}

const EDITABLE_TYPES = ['note', 'call', 'email', 'meeting'];

function ActivityItem({ activity, leadId }: { activity: LeadActivityWithUser; leadId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description || '');
  const { user } = useAuth();
  const updateActivityMut = useUpdateActivity();
  const hasLongDesc = activity.description && activity.description.length > 120;
  const canEdit =
    EDITABLE_TYPES.includes(activity.activity_type) && user?.id === activity.user_id;

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('O título não pode ficar vazio');
      return;
    }
    try {
      await updateActivityMut.mutateAsync({
        id: activity.id,
        lead_id: leadId,
        title: title.trim(),
        description: description.trim() || null,
      });
      toast.success('Nota atualizada!');
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar nota');
    }
  };

  const handleCancel = () => {
    setTitle(activity.title);
    setDescription(activity.description || '');
    setEditing(false);
  };

  return (
    <div className="flex gap-3 relative group">
      <ActivityIcon type={activity.activity_type as ActivityType} />
      <div className="flex-1 min-w-0 pt-0.5">
        {editing ? (
          <div className="space-y-2">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Título"
              className="h-8 text-sm"
            />
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descrição"
              rows={4}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={updateActivityMut.isPending}>
                {updateActivityMut.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <p className="text-sm font-medium leading-snug flex-1">{activity.title}</p>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  onClick={() => setEditing(true)}
                  aria-label="Editar nota"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
            {activity.description && (
              <div className="mt-0.5">
                <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${!expanded && hasLongDesc ? 'line-clamp-2' : ''}`}>
                  {activity.description}
                </p>
                {hasLongDesc && (
                  <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary hover:underline flex items-center gap-0.5 mt-0.5">
                    {expanded ? <><ChevronUp className="h-3 w-3" /> Menos</> : <><ChevronDown className="h-3 w-3" /> Mais</>}
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              {activity.user && (
                <span className="flex items-center gap-1">
                  <Avatar className="h-4 w-4">
                    <AvatarFallback className="text-[8px]">{activity.user.full_name?.[0]}</AvatarFallback>
                  </Avatar>
                  {activity.user.full_name}
                </span>
              )}
              <span>·</span>
              <span>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: ptBR })}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
