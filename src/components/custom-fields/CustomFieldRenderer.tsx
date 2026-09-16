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

const norm = (v: string) => v.trim().toLowerCase();

function useOptionCreator(field: CustomFieldDefinition) {
  const addOption = useAddCustomFieldOption();
  const [localOptions, setLocalOptions] = useState<string[]>([]);

  const options = Array.from(
    new Map([...(field.options || []), ...localOptions].map(o => [norm(o), o])).values()
  );

  const create = async (raw: string): Promise<string | null> => {
    const option = raw.trim();
    if (!option) return null;
    const existing = options.find(o => norm(o) === norm(option));
    if (existing) return existing;
    try {
      const next = await addOption.mutateAsync({ fieldId: field.id, option });
      setLocalOptions(next);
      return next.find(o => norm(o) === norm(option)) ?? option;
    } catch (e: any) {
      toast({
        title: 'Não foi possível criar a opção',
        description: e?.message ?? 'Tente novamente.',
        variant: 'destructive',
      });
      return null;
    }
  };

  return { options, create, isCreating: addOption.isPending };
}

function SelectCombobox({ field, value, onChange, disabled }: { field: CustomFieldDefinition; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { options, create, isCreating } = useOptionCreator(field);

  const canCreate = search.trim().length > 0 && !options.some(o => norm(o) === norm(search));

  const handleCreate = async () => {
    const created = await create(search);
    if (created) {
      onChange(created);
      setSearch('');
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
        >
          <span className="truncate">{value || `Selecione ${field.field_label}`}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput placeholder="Buscar ou criar..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="py-2 px-2 text-sm text-muted-foreground">
              {search.trim() ? 'Nenhuma opção encontrada.' : 'Nenhuma opção cadastrada.'}
            </CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt === value ? '' : opt);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === opt ? 'opacity-100' : 'opacity-0')} />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
            {canCreate && (
              <CommandGroup>
                <CommandItem value={`__create__${search}`} onSelect={handleCreate} disabled={isCreating}>
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Criar "{search.trim()}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MultiSelectField({ field, value, onChange, disabled }: { field: CustomFieldDefinition; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [search, setSearch] = useState('');
  const { options, create, isCreating } = useOptionCreator(field);

  let selected: string[] = [];
  try {
    const parsed = value ? JSON.parse(value) : [];
    if (Array.isArray(parsed)) selected = parsed;
  } catch {
    selected = [];
  }

  const toggle = (opt: string) => {
    const next = selected.some(s => norm(s) === norm(opt))
      ? selected.filter(s => norm(s) !== norm(opt))
      : [...selected, opt];
    onChange(JSON.stringify(next));
  };

  const canCreate = search.trim().length > 0 && !options.some(o => norm(o) === norm(search));

  const handleCreate = async () => {
    const created = await create(search);
    if (created) {
      if (!selected.some(s => norm(s) === norm(created))) {
        onChange(JSON.stringify([...selected, created]));
      }
      setSearch('');
    }
  };

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(s => (
            <Badge key={s} variant="secondary" className="gap-1">
              {s}
              {!disabled && <X className="h-3 w-3 cursor-pointer" onClick={() => toggle(s)} />}
            </Badge>
          ))}
        </div>
      )}
      {!disabled && (
        <Command shouldFilter className="rounded-md border">
          <CommandInput placeholder="Buscar ou criar..." value={search} onValueChange={setSearch} />
          <CommandList className="max-h-40">
            <CommandEmpty className="py-2 px-2 text-sm text-muted-foreground">
              {search.trim() ? 'Nenhuma opção encontrada.' : 'Nenhuma opção cadastrada.'}
            </CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem key={opt} value={opt} onSelect={() => toggle(opt)}>
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected.some(s => norm(s) === norm(opt)) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
            {canCreate && (
              <CommandGroup>
                <CommandItem value={`__create__${search}`} onSelect={handleCreate} disabled={isCreating}>
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Criar "{search.trim()}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      )}
    </div>
  );
}
