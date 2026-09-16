import { useState } from 'react';
import type { CustomFieldDefinition } from '@/types';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { CalendarIcon, X, Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAddCustomFieldOption } from '@/hooks/useCustomFields';
import { toast } from '@/hooks/use-toast';

interface CustomFieldRendererProps {
  field: CustomFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CustomFieldRenderer({ field, value, onChange, disabled }: CustomFieldRendererProps) {
  switch (field.field_type) {
    case 'text':
      return <Input value={value} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={field.field_label} />;

    case 'number':
      return <Input type="number" value={value} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={field.field_label} />;

    case 'currency':
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
          <Input
            className="pl-10"
            value={value}
            disabled={disabled}
            placeholder="0,00"
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9,\.]/g, '');
              onChange(raw);
            }}
          />
        </div>
      );

    case 'date':
      return <DateField value={value} onChange={onChange} disabled={disabled} label={field.field_label} />;

    case 'select':
      return <SelectCombobox field={field} value={value} onChange={onChange} disabled={disabled} />;

    case 'multi_select':
      return <MultiSelectField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={value === 'true'}
            onCheckedChange={checked => onChange(checked ? 'true' : 'false')}
            disabled={disabled}
          />
          <span className="text-sm">{field.field_label}</span>
        </div>
      );

    case 'url':
      return <Input type="url" value={value} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder="https://..." />;

    case 'email':
      return <Input type="email" value={value} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder="email@exemplo.com" />;

    case 'phone':
      return (
        <Input
          value={value}
          disabled={disabled}
          placeholder="(00) 00000-0000"
          onChange={e => {
            let v = e.target.value.replace(/\D/g, '').slice(0, 11);
            if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
            else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
            else if (v.length > 0) v = `(${v}`;
            onChange(v);
          }}
        />
      );

    default:
      return <Input value={value} onChange={e => onChange(e.target.value)} disabled={disabled} />;
  }
}

function DateField({ value, onChange, disabled, label }: { value: string; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  const date = value ? parseISO(value) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled} className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : `Selecione ${label}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={d => onChange(d ? d.toISOString().split('T')[0] : '')} locale={ptBR} />
      </PopoverContent>
    </Popover>
  );
}

function MultiSelectField({ options, value, onChange, disabled }: { options: string[]; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const selected: string[] = value ? JSON.parse(value || '[]') : [];
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
    onChange(JSON.stringify(next));
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {selected.map(s => (
          <Badge key={s} variant="secondary" className="gap-1">
            {s}
            {!disabled && <X className="h-3 w-3 cursor-pointer" onClick={() => toggle(s)} />}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.filter(o => !selected.includes(o)).map(opt => (
          <Badge key={opt} variant="outline" className={cn('cursor-pointer', disabled && 'cursor-default opacity-50')} onClick={() => !disabled && toggle(opt)}>
            + {opt}
          </Badge>
        ))}
      </div>
    </div>
  );
}
