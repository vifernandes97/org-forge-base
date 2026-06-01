import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Filter, Loader2, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getArchiveReasonsSummary } from '@/services/leads';
import type { LeadFilters } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  funnelId: string | null;
  filters: LeadFilters;
  applyMany: (partial: Partial<LeadFilters>) => void;
}

export function ArchivedSummaryPanel({ funnelId, filters, applyMany }: Props) {
  const { organization } = useOrganization();
  const currentOrg = organization;

  const from = filters.created_at_from || null;
  const to = filters.created_at_to || null;
  const assignedTo = filters.assigned_to?.filter(id => id !== '__none__') ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ['archive-reasons-summary', currentOrg?.id, funnelId, from, to, assignedTo?.join(',') ?? ''],
    queryFn: () => getArchiveReasonsSummary(currentOrg!.id, funnelId, from, to, assignedTo),
    enabled: !!currentOrg?.id,
  });

  const total = useMemo(() => (data || []).reduce((acc, r) => acc + r.count, 0), [data]);
  const max = useMemo(() => Math.max(1, ...(data || []).map(r => r.count)), [data]);

  const selectedId = filters.archive_reason_ids?.[0];

  const periodLabel = useMemo(() => {
    if (!from && !to) return 'todos';
    const f = from ? format(new Date(from), 'dd/MM/yy') : '…';
    const t = to ? format(new Date(to), 'dd/MM/yy') : '…';
    return `${f} – ${t}`;
  }, [from, to]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Archive className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Resumo de arquivamento</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          · {total} no período · {periodLabel}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : total === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">
          Nenhum negócio arquivado no recorte atual.
        </p>
      ) : (
        <ul className="space-y-2">
          {(data || []).map((row) => {
            const pct = total ? Math.round((row.count / total) * 100) : 0;
            const barPct = (row.count / max) * 100;
            const isSelected = (row.archive_reason_id ?? null) === (selectedId ?? null) && !!selectedId && !!row.archive_reason_id;
            return (
              <li key={row.archive_reason_id ?? 'none'} className="group">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm truncate">{row.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {row.count} · {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', isSelected ? 'bg-primary' : 'bg-primary/60')}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                  {row.archive_reason_id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => applyMany({ archive_reason_ids: [row.archive_reason_id!] })}
                    >
                      <Filter className="h-3 w-3 mr-1" />
                      Filtrar
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {filters.archive_reason_ids?.length ? (
        <div className="flex items-center justify-end pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => applyMany({ archive_reason_ids: [] })}
          >
            Limpar filtro de motivo
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
