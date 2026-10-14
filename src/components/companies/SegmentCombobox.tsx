import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSegments } from '@/hooks/useCompanies';
import { normalizeKey } from '@/lib/leadDisplay';

interface Props {
  value: string | null;
  onChange: (segment: string | null) => void;
  placeholder?: string;
}

export function SegmentCombobox({ value, onChange, placeholder = 'Selecione um segmento' }: Props) {
  const { data: segments } = useSegments();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const options = Array.from(new Set([...(segments || []), ...(value ? [value] : [])]));
  const canCreate = search.trim().length > 0 && !options.some(s => normalizeKey(s) === normalizeKey(search));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex gap-1">
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" type="button"
            className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}>
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {value && (
          <Button type="button" variant="ghost" size="icon" aria-label="Limpar segmento" onClick={() => onChange(null)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar ou criar segmento..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="px-2 py-2 text-sm text-muted-foreground">Nenhum segmento encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map(s => (
                <CommandItem key={s} value={s} onSelect={() => { onChange(s); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4', value === s ? 'opacity-100' : 'opacity-0')} />
                  {s}
                </CommandItem>
              ))}
            </CommandGroup>
            {canCreate && (
              <CommandGroup>
                <CommandItem value={`__create__${search}`} onSelect={() => { onChange(search.trim()); setSearch(''); setOpen(false); }}>
                  <Plus className="mr-2 h-4 w-4" />
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
