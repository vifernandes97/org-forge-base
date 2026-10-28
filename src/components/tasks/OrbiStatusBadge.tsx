import { Badge } from '@/components/ui/badge';
import { useUpdateTask } from '@/hooks/useTasks';
import type { Task } from '@/types';

const estados: Record<NonNullable<Task['external_status']>, { label: string; variant: 'secondary' | 'outline' | 'destructive' } | null> = {
  queued: { label: 'Enviando ao Orbi', variant: 'outline' },
  pending: { label: 'Aguardando confirmação no Orbi', variant: 'outline' },
  accepted: { label: 'No Orbi', variant: 'secondary' },
  rejected: { label: 'Recusada no Orbi', variant: 'destructive' },
  failed: { label: 'Falha no envio ao Orbi', variant: 'destructive' },
  cancelled: null,
};

/** Estado do pedido de reunião no Orbi (docs/ORBI.md); falha tem reenvio. */
export function OrbiStatusBadge({ task }: { task: Task }) {
  const update = useUpdateTask();
  const estado = task.external_status ? estados[task.external_status] : null;
  if (!estado) return null;
  const badge = (
    <Badge variant={estado.variant} className="text-[10px]" title={task.external_error || undefined}>{estado.label}</Badge>
  );
  return (
    <>
      {task.external_url ? <a href={task.external_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{badge}</a> : badge}
      {task.external_status === 'failed' && (
        <button
          type="button"
          className="text-[10px] text-primary hover:underline"
          disabled={update.isPending}
          onClick={() => update.mutate({
            id: task.id,
            leadId: task.lead_id,
            updates: { external_status: 'queued', external_next_at: new Date().toISOString(), external_attempts: 0, external_error: null },
          })}
        >
          Reenviar
        </button>
      )}
    </>
  );
}
