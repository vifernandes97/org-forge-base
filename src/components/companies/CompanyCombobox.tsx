import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronDown, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompanies } from '@/hooks/useCompanies';
import { normalizeKey } from '@/lib/leadDisplay';
import { formatCnpj, onlyDigits } from '@/lib/cnpj';
import { filterPillClass } from '@/components/leads/filters/filterStyles';
import type { Company } from '@/types';

interface Props {
  value: string | null;
  onChange: (company: Company) => void;
  /** Called with the typed text when the user chooses "Criar nova empresa". Omit to hide the option. */
  onCreate?: (name: string) => void;
  excludeId?: string;
  placeholder?: string;
  /** Toolbar filter pill instead of a form field. */
  pill?: boolean;
}

export function CompanyCombobox({ value, onChange, onCreate, excludeId, placeholder = 'Selecione a empresa', pill }: Props) {
  const { data: companies } = useCompanies();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = companies?.find(c => c.id === value);

  const filtered = useMemo(() => {
    const list = (companies || []).filter(c => c.id !== excludeId);
    const k = normalizeKey(search);
    const d = onlyDigits(search);
    if (!k) return list.slice(0, 50);
    return list
      .filter(c =>
        normalizeKey(c.trade_name).includes(k) ||
        normalizeKey(c.legal_name).includes(k) ||
        (d.length >= 3 && (c.cnpj || '').includes(d)))
      .slice(0, 50);
  }, [companies, search, excludeId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {pill ? (
          <Button variant="outline" size="sm" role="combobox" type="button" className={filterPillClass(false)}>
            {placeholder}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        ) : (
        <Button variant="outline" role="combobox" type="button"
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground')}>
          <span className="truncate">
            {selected ? selected.trade_name : placeholder}
            {selected?.segment_ref?.label && <span className="ml-2 text-xs text-muted-foreground">{selected.segment_ref?.label}</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className={cn('p-0', pill ? 'w-80' : 'w-[--radix-popover-trigger-width] min-w-[280px]')} align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nome, razão social ou CNPJ..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="px-2 py-2 text-sm text-muted-foreground">Nenhuma empresa encontrada.</CommandEmpty>
            <CommandGroup>
              {filtered.map(c => (
                <CommandItem key={c.id} value={c.id} onSelect={() => { onChange(c); setOpen(false); setSearch(''); }}>
                  <Check className={cn('mr-2 h-4 w-4 shrink-0', value === c.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="min-w-0">
                    <div className="truncate">{c.trade_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[c.segment_ref?.label, c.legal_name, c.cnpj ? formatCnpj(c.cnpj) : null].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreate && (
              <CommandGroup>
                <CommandItem value="__create__" onSelect={() => { onCreate(search.trim()); setOpen(false); setSearch(''); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  {search.trim() ? `Criar nova empresa "${search.trim()}"` : 'Criar nova empresa'}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
