import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface FilterDateRangeProps {
  label: string;
  from?: string;
  to?: string;
  onChangeFrom: (v: string | undefined) => void;
  onChangeTo: (v: string | undefined) => void;
}

export function FilterDateRange({ label, from, to, onChangeFrom, onChangeTo }: FilterDateRangeProps) {
  const [open, setOpen] = useState(false);
  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;

  const hasValue = from || to;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 gap-1 text-xs", hasValue && "border-primary/50")}>
          <CalendarIcon className="h-3 w-3" />
          {label}
          {hasValue && (
            <span className="text-[10px] text-muted-foreground ml-1">
              {from ? format(new Date(from), 'dd/MM', { locale: ptBR }) : '...'} - {to ? format(new Date(to), 'dd/MM', { locale: ptBR }) : '...'}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="flex gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">De</p>
              <Calendar
                mode="single"
                selected={fromDate}
                onSelect={(d) => onChangeFrom(d ? d.toISOString() : undefined)}
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
                onSelect={(d) => onChangeTo(d ? d.toISOString() : undefined)}
                locale={ptBR}
                className="p-2 pointer-events-auto"
              />
            </div>
          </div>
          {hasValue && (
            <Button variant="ghost" size="sm" className="w-full h-6 text-xs" onClick={() => { onChangeFrom(undefined); onChangeTo(undefined); }}>
              <X className="h-3 w-3 mr-1" /> Limpar datas
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
