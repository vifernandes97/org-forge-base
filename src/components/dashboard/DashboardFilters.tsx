import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
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
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'month', label: 'Mês específico' },
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
}

export default function DashboardFilters({
  periodKey, onPeriodChange, funnelId, onFunnelChange,
  customFrom, customTo, onCustomFromChange, onCustomToChange,
  targetMonth, onTargetMonthChange,
}: DashboardFiltersProps) {
  const { data: funnels } = useFunnels();
  const monthOptions = buildMonthOptions();


  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={periodKey} onValueChange={(v) => onPeriodChange(v as PeriodKey)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {periodKey === 'month' && (
        <Select value={targetMonth} onValueChange={onTargetMonthChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Selecione o mês" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {monthOptions.map(o => (
              <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <Select value={funnelId ?? '__all__'} onValueChange={(v) => onFunnelChange(v === '__all__' ? null : v)}>
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos os funis</SelectItem>
          {funnels?.map(f => (
            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
