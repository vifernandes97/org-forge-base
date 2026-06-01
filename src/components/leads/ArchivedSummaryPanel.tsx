import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Calendar as CalendarIcon, Filter, Loader2, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getArchiveReasonsSummary } from '@/services/leads';
import type { LeadFilters } from '@/types';
import { cn } from '@/lib/utils';

type Preset = '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'custom';

interface Props {
  funnelId: string | null;
  applyMany: (partial: Partial<LeadFilters>) => void;
  currentReasonIds?: string[];
}

function computeRange(preset: Preset, custom: { from?: Date; to?: Date }): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case '7d': return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case '30d': return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case '90d': return { from: startOfDay(subDays(now, 89)), to: endOfDay(now) };
    case 'this_month': return { from: startOfMonth(now), to: endOfDay(now) };
    case 'last_month': {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case 'custom':
      return {
        from: custom.from ? startOfDay(custom.from) : startOfDay(subDays(now, 29)),
        to: custom.to ? endOfDay(custom.to) : endOfDay(now),
      };
  }
}

export function ArchivedSummaryPanel({ funnelId, applyMany, currentReasonIds }: Props) {
  const { currentOrg } = useOrganization();
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const range = useMemo(() => computeRange(preset, { from: customFrom, to: customTo }), [preset, customFrom, customTo]);

  const { data, isLoading } = useQuery({
    queryKey: ['archive-reasons-summary', currentOrg?.id, funnelId, range.from.toISOString(), range.to.toISOString()],
    queryFn: () => getArchiveReasonsSummary(currentOrg!.id, funnelId, range.from.toISOString(), range.to.toISOString()),
    enabled: !!currentOrg?.id,
  });

  const total = useMemo(() => (data || []).reduce((acc, r) => acc + r.count, 0), [data]);
  const max = useMemo(() => Math.max(1, ...(data || []).map(r => r.count)), [data]);

  const selectedId = currentReasonIds?.[0];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Resumo de arquivamento</h3>
          <span className="text-xs text-muted-foreground tabular-nums">· {total} no período</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="this_month">Este mês</SelectItem>
              <SelectItem value="last_month">Mês passado</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {preset === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                  {customFrom && customTo
                    ? `${format(customFrom, 'dd/MM')} – ${format(customTo, 'dd/MM')}`
                    : 'Selecionar datas'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: customFrom, to: customTo }}
                  onSelect={(r) => { setCustomFrom(r?.from); setCustomTo(r?.to); }}
                  numberOfMonths={2}
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : total === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">
          Nenhum negócio arquivado no período selecionado.
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

      {currentReasonIds?.length ? (
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
