import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useFunnels } from '@/hooks/useFunnels';
import type { PeriodKey } from '@/hooks/useDashboard';

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'this_year', label: 'Este ano' },
  { value: 'custom', label: 'Personalizado' },
];

function buildMonthOptions() {
  const now = new Date();
  const opts: { value: string; label: string; disabled: boolean }[] = [];
  for (const year of [now.getFullYear(), now.getFullYear() - 1]) {
    for (let m = 11; m >= 0; m--) {
      const d = new Date(year, m, 1);
      const label = format(d, 'MMMM yyyy', { locale: ptBR });
      opts.push({
        value: `${year}-${String(m + 1).padStart(2, '0')}`,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        disabled: year === now.getFullYear() && m > now.getMonth(),
      });
    }
  }
  return opts;
}

function monthLabel(targetMonth: string) {
  const [y, m] = targetMonth.split('-').map(Number);
  const label = format(new Date(y, (m || 1) - 1, 1), 'MMMM yyyy', { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface DashboardFiltersProps {
  periodKey: PeriodKey;
  onPeriodChange: (key: PeriodKey) => void;
  funnelId: string | null;
  onFunnelChange: (id: string | null) => void;
  customFrom?: Date;
  customTo?: Date;
  onCustomFromChange: (d: Date | undefined) => void;
  onCustomToChange: (d: Date | undefined) => void;
  targetMonth: string;
  onTargetMonthChange: (m: string) => void;
  isCurrentMonth: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onResetToCurrentMonth: () => void;
}

export default function DashboardFilters({
  periodKey, onPeriodChange, funnelId, onFunnelChange,
  customFrom, customTo, onCustomFromChange, onCustomToChange,
  targetMonth, onTargetMonthChange,
  isCurrentMonth, onPrevMonth, onNextMonth, onResetToCurrentMonth,
}: DashboardFiltersProps) {
  const { data: funnels } = useFunnels();
  const monthOptions = buildMonthOptions();
  const isMonthMode = periodKey === 'month';
  const activeLabel = PERIOD_OPTIONS.find(o => o.value === periodKey)?.label ?? 'Período';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={funnelId ?? '__all__'} onValueChange={(v) => onFunnelChange(v === '__all__' ? null : v)}>
        <SelectTrigger className="h-9 w-auto min-w-[160px] gap-2 font-medium" aria-label="Funil">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos os funis</SelectItem>
          {funnels?.map(f => (
            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isMonthMode ? (
        <div className="flex h-9 items-center gap-1 rounded-md border bg-background px-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrevMonth} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 min-w-[130px] font-medium">
                {monthLabel(targetMonth)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="center">
              <div className="max-h-[300px] overflow-y-auto p-1">
                {monthOptions.map(o => (
                  <button
                    key={o.value}
                    disabled={o.disabled}
                    onClick={() => onTargetMonthChange(o.value)}
                    className={cn(
                      'w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40',
                      o.value === targetMonth && 'bg-accent font-medium'
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onNextMonth}
            disabled={isCurrentMonth}
            aria-label="Mês seguinte"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex h-9 items-center gap-1 rounded-md border bg-background pl-3 pr-1">
          <span className="text-sm font-medium">{activeLabel}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onResetToCurrentMonth} aria-label="Voltar para o mês atual">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {periodKey === 'custom' && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('w-[130px] justify-start text-left font-normal', !customFrom && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customFrom ? format(customFrom, 'dd/MM/yyyy') : 'De'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customFrom} onSelect={onCustomFromChange} locale={ptBR} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">—</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('w-[130px] justify-start text-left font-normal', !customTo && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customTo ? format(customTo, 'dd/MM/yyyy') : 'Até'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customTo} onSelect={onCustomToChange} locale={ptBR} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Outros períodos" title="Outros períodos">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] space-y-4" align="end">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Período</p>
            <Select value={isMonthMode ? '' : periodKey} onValueChange={(v) => onPeriodChange(v as PeriodKey)}>
              <SelectTrigger>
                <SelectValue placeholder="Outros períodos" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" size="sm" className="w-full" onClick={onResetToCurrentMonth} disabled={isMonthMode && isCurrentMonth}>
            Voltar para o mês atual
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
