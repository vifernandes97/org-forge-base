import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveArchiveReasons, useAddArchiveReason } from '@/hooks/useArchiveReasons';
import { toast } from 'sonner';

interface Props {
  value: string;
  onChange: (reasonId: string) => void;
}

const norm = (v: string) => v.trim().toLowerCase();

export function ArchiveReasonCombobox({ value, onChange }: Props) {
  const { data: reasons } = useActiveArchiveReasons();
  const addReason = useAddArchiveReason();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const options = reasons || [];
  const selected = options.find(r => r.id === value);
  const canCreate = search.trim().length > 0 && !options.some(r => norm(r.label) === norm(search));

  const handleCreate = async () => {
    try {
      const created = await addReason.mutateAsync(search.trim());
      onChange(created.id);
      setSearch('');
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível criar o motivo');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground')}
        >
          <span className="truncate">{selected?.label || 'Selecione um motivo'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput placeholder="Buscar ou criar motivo..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="px-2 py-2 text-sm text-muted-foreground">
              {search.trim() ? 'Nenhum motivo encontrado.' : 'Nenhum motivo cadastrado.'}
            </CommandEmpty>
            <CommandGroup>
              {options.map(r => (
                <CommandItem
                  key={r.id}
                  value={r.label}
                  onSelect={() => {
                    onChange(r.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === r.id ? 'opacity-100' : 'opacity-0')} />
                  {r.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {canCreate && (
              <CommandGroup>
                <CommandItem value={`__create__${search}`} onSelect={handleCreate} disabled={addReason.isPending}>
                  {addReason.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
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
