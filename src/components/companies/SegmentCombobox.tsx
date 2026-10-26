import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAddSegment, useSegments } from '@/hooks/useCompanies';
import { useOrganization } from '@/contexts/OrganizationContext';
import { normalizeKey } from '@/lib/leadDisplay';

interface Props {
  /** segment id */
  value: string | null;
  /** current segment row (to show label even if inactive) */
  current?: { id: string; label: string; is_active: boolean } | null;
  onChange: (segmentId: string | null) => void;
  placeholder?: string;
  /** Borderless trigger for inline field rows (deal modal). */
  compact?: boolean;
}

export function SegmentCombobox({ value, current, onChange, placeholder = 'Selecione um segmento', compact }: Props) {
  const { data: segments } = useSegments();
  const { isOwner, isAdmin } = useOrganization();
  const addSegment = useAddSegment();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const active = (segments || []).filter(s => s.is_active);
  const selected = (segments || []).find(s => s.id === value) || (current && current.id === value ? current : null);
  const canManage = isOwner || isAdmin;
  const canCreate = canManage && search.trim().length > 0 && !(segments || []).some(s => s.is_active && normalizeKey(s.label) === normalizeKey(search));

  const handleCreate = async () => {
    try {
      const seg = await addSegment.mutateAsync(search.trim());
      onChange(seg.id);
      setSearch('');
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível criar o segmento');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1">
        <PopoverTrigger asChild>
          <Button variant={compact ? 'ghost' : 'outline'} role="combobox" type="button"
            className={cn('w-full min-w-0 justify-between font-normal', compact && 'h-7 px-1 -mx-1 hover:bg-accent/50', !selected && 'text-muted-foreground', !selected && compact && 'italic')}>
            <span className="truncate">
              {selected ? selected.label : placeholder}
              {selected && !selected.is_active && <span className="ml-1 text-xs text-muted-foreground">(inativo)</span>}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {value && (
          <Button type="button" variant="ghost" size="icon" className={cn(compact && 'h-7 w-7')} aria-label="Limpar segmento" onClick={() => onChange(null)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={canManage ? 'Buscar ou criar segmento...' : 'Buscar segmento...'} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="px-2 py-2 text-sm text-muted-foreground">Nenhum segmento encontrado.</CommandEmpty>
            <CommandGroup>
              {active.map(s => (
                <CommandItem key={s.id} value={s.label} onSelect={() => { onChange(s.id); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4', value === s.id ? 'opacity-100' : 'opacity-0')} />
                  {s.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {canCreate && (
              <CommandGroup>
                <CommandItem value={`__create__${search}`} onSelect={handleCreate} disabled={addSegment.isPending}>
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
