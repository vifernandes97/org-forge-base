import { useState, useMemo } from 'react';
import {
  format,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
  subDays, subMonths, addMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, X, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { filterFieldClass, filterPillClass } from './filterStyles';

interface FilterDateRangeProps {
  label: string;
  from?: string;
  to?: string;
  onChangeFrom: (v: string | undefined) => void;
  onChangeTo: (v: string | undefined) => void;
  /** `pill` for toolbars; `field` is a full-width trigger (filters panel). */
  variant?: 'pill' | 'field';
}

type Preset = { key: string; label: string; range: () => [Date, Date] };

function buildPresets(): Preset[] {
  const now = new Date();
  return [
    { key: 'today',         label: 'Hoje',                  range: () => [startOfDay(now), endOfDay(now)] },
    { key: 'yesterday',     label: 'Ontem',                 range: () => { const d = subDays(now, 1); return [startOfDay(d), endOfDay(d)]; } },
    { key: 'last7',         label: 'Últimos 7 dias',        range: () => [startOfDay(subDays(now, 6)), endOfDay(now)] },
    { key: 'last30',        label: 'Últimos 30 dias',       range: () => [startOfDay(subDays(now, 29)), endOfDay(now)] },
    { key: 'this_week',     label: 'Semana atual',          range: () => [startOfWeek(now, { weekStartsOn: 0 }), endOfWeek(now, { weekStartsOn: 0 })] },
    { key: 'this_month',    label: 'Mês atual',             range: () => [startOfMonth(now), endOfMonth(now)] },
    { key: 'last_month',    label: 'Mês passado',           range: () => { const d = subMonths(now, 1); return [startOfMonth(d), endOfMonth(d)]; } },
    { key: 'this_quarter',  label: 'Trimestre atual',       range: () => [startOfQuarter(now), endOfQuarter(now)] },
    { key: 'this_year',     label: 'Ano atual',             range: () => [startOfYear(now), endOfYear(now)] },
    { key: 'last_year',     label: 'Ano passado',           range: () => { const d = new Date(now.getFullYear() - 1, 0, 1); return [startOfYear(d), endOfYear(d)]; } },
  ];
}

function buildMonthList(): { key: string; label: string; range: [Date, Date] }[] {
  const out: { key: string; label: string; range: [Date, Date] }[] = [];
  const today = new Date();
  // Last 12 months including current, then forward 2 months
  const start = subMonths(startOfMonth(today), 11);
  for (let i = 0; i < 14; i++) {
    const d = addMonths(start, i);
    const range: [Date, Date] = [startOfMonth(d), endOfMonth(d)];
    out.push({
      key: format(d, 'yyyy-MM'),
      label: format(d, "MMMM 'de' yyyy", { locale: ptBR }),
      range,
    });
  }
  return out.reverse();
}

export function FilterDateRange({ label, from, to, onChangeFrom, onChangeTo, variant = 'pill' }: FilterDateRangeProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'preset' | 'month' | 'custom'>('preset');
  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;

  const presets = useMemo(buildPresets, []);
  const months = useMemo(buildMonthList, []);

  const hasValue = !!(from || to);

  const apply = (start: Date, end: Date) => {
    onChangeFrom(start.toISOString());
    onChangeTo(end.toISOString());
    setOpen(false);
  };

  const matchedPresetKey = useMemo(() => {
    if (!fromDate || !toDate) return null;
    const f = fromDate.getTime();
    const t = toDate.getTime();
    for (const p of presets) {
      const [a, b] = p.range();
      if (Math.abs(a.getTime() - f) < 60_000 && Math.abs(b.getTime() - t) < 60_000) return p.key;
    }
    for (const m of months) {
      if (Math.abs(m.range[0].getTime() - f) < 60_000 && Math.abs(m.range[1].getTime() - t) < 60_000) return `m:${m.key}`;
    }
    return null;
  }, [fromDate, toDate, presets, months]);

  const summary = (() => {
    if (matchedPresetKey?.startsWith('m:')) {
      return months.find(m => `m:${m.key}` === matchedPresetKey)?.label;
    }
    if (matchedPresetKey) return presets.find(p => p.key === matchedPresetKey)?.label;
    if (from || to) {
      return `${from ? format(new Date(from), 'dd/MM/yy', { locale: ptBR }) : '...'} → ${to ? format(new Date(to), 'dd/MM/yy', { locale: ptBR }) : '...'}`;
    }
    return null;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === 'field' ? (
          <Button variant="outline" className={filterFieldClass(hasValue)}>
            <span className="flex min-w-0 items-center gap-2">
              <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="truncate">{summary || 'Qualquer data'}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className={filterPillClass(hasValue)}>
            <CalendarIcon className="h-3 w-3" />
            {label}
            {summary && <span className="max-w-[140px] truncate font-normal opacity-80">· {summary}</span>}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Sidebar tabs */}
          <div className="border-r p-2 flex flex-col gap-1 w-[120px]">
            <Button
              variant={tab === 'preset' ? 'secondary' : 'ghost'}
              size="sm"
              className="justify-start h-7 text-xs"
              onClick={() => setTab('preset')}
            >
              Períodos
            </Button>
            <Button
              variant={tab === 'month' ? 'secondary' : 'ghost'}
              size="sm"
              className="justify-start h-7 text-xs"
              onClick={() => setTab('month')}
            >
              Por mês
            </Button>
            <Button
              variant={tab === 'custom' ? 'secondary' : 'ghost'}
              size="sm"
              className="justify-start h-7 text-xs"
              onClick={() => setTab('custom')}
            >
              Personalizado
            </Button>
            {hasValue && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start h-7 text-xs text-muted-foreground mt-auto"
                onClick={() => { onChangeFrom(undefined); onChangeTo(undefined); setOpen(false); }}
              >
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="p-2 min-w-[220px]">
            {tab === 'preset' && (
              <div className="flex flex-col gap-0.5">
                {presets.map(p => {
                  const active = matchedPresetKey === p.key;
                  return (
                    <Button
                      key={p.key}
                      variant="ghost"
                      size="sm"
                      className={cn("justify-between h-7 text-xs", active && "bg-accent")}
                      onClick={() => { const [a, b] = p.range(); apply(a, b); }}
                    >
                      <span>{p.label}</span>
                      {active && <Check className="h-3 w-3" />}
                    </Button>
                  );
                })}
              </div>
            )}

            {tab === 'month' && (
              <ScrollArea className="h-[260px] pr-2">
                <div className="flex flex-col gap-0.5">
                  {months.map(m => {
                    const active = matchedPresetKey === `m:${m.key}`;
                    return (
                      <Button
                        key={m.key}
                        variant="ghost"
                        size="sm"
                        className={cn("justify-between h-7 text-xs capitalize", active && "bg-accent")}
                        onClick={() => apply(m.range[0], m.range[1])}
                      >
                        <span>{m.label}</span>
                        {active && <Check className="h-3 w-3" />}
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {tab === 'custom' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">De</p>
                    <Calendar
                      mode="single"
                      selected={fromDate}
                      onSelect={(d) => onChangeFrom(d ? startOfDay(d).toISOString() : undefined)}
                      locale={ptBR}
                      className="p-2 pointer-events-auto"
                      initialFocus
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Até</p>
                    <Calendar
                      mode="single"
                      selected={toDate}
                      onSelect={(d) => onChangeTo(d ? endOfDay(d).toISOString() : undefined)}
                      locale={ptBR}
                      className="p-2 pointer-events-auto"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
