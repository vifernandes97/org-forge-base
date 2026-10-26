import { useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { filterFieldClass, filterPillClass } from './filterStyles';

export interface QuickFilterOption {
  value: string;
  label: string;
  color?: string;
}

interface QuickFilterPillProps {
  label: string;
  options: QuickFilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** `pill` for toolbars; `field` is a full-width trigger listing the selection (filters panel). */
  variant?: 'pill' | 'field';
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}

export function QuickFilterPill({
  label,
  options,
  selected,
  onChange,
  variant = 'pill',
  placeholder = 'Todos',
  searchPlaceholder = 'Buscar...',
  emptyText = 'Nenhum resultado',
}: QuickFilterPillProps) {
  const [open, setOpen] = useState(false);
  const isActive = selected.length > 0;
  const selectedOptions = options.filter((o) => selected.includes(o.value));

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const trigger =
    variant === 'field' ? (
      <Button variant="outline" className={filterFieldClass(isActive)}>
        <span className="flex min-w-0 items-center gap-1.5">
          {selectedOptions[0]?.color && (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: selectedOptions[0].color }} />
          )}
          <span className="truncate">
            {isActive
              ? selectedOptions.slice(0, 2).map((o) => o.label).join(', ')
              : placeholder}
          </span>
          {selectedOptions.length > 2 && (
            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary tabular-nums">
              +{selectedOptions.length - 2}
            </span>
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>
    ) : (
      <Button variant="outline" size="sm" className={filterPillClass(isActive)}>
        <span>{label}</span>
        {isActive && (
          <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-primary text-primary-foreground px-1 text-[10px] tabular-nums">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn('h-3 w-3 opacity-60', isActive && 'opacity-80')} />
      </Button>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className={cn('p-0', variant === 'field' ? 'w-[--radix-popover-trigger-width] min-w-[220px]' : 'w-60')}
        align="start"
      >
        <Command>
          {options.length > 6 && (
            <CommandInput placeholder={searchPlaceholder} className="h-9 text-xs" />
          )}
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
              {emptyText}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const checked = selected.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => toggle(opt.value)}
                    className="text-xs gap-2 cursor-pointer"
                  >
                    <div
                      className={cn(
                        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                        checked
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input',
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </div>
                    {opt.color && (
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    <span className="truncate flex-1">{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {isActive && (
            <>
              <CommandSeparator />
              <div className="p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs justify-center text-muted-foreground"
                  onClick={() => onChange([])}
                >
                  <X className="h-3 w-3 mr-1" /> Limpar seleção
                </Button>
              </div>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
