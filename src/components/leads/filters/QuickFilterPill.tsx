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
  searchPlaceholder?: string;
  emptyText?: string;
}

export function QuickFilterPill({
  label,
  options,
  selected,
  onChange,
  searchPlaceholder = 'Buscar...',
  emptyText = 'Nenhum resultado',
}: QuickFilterPillProps) {
  const [open, setOpen] = useState(false);
  const isActive = selected.length > 0;

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
            isActive &&
              'bg-primary/10 text-primary border-primary/30 hover:bg-primary/15 hover:text-primary',
          )}
        >
          <span>{label}</span>
          {isActive && (
            <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-primary text-primary-foreground px-1 text-[10px] tabular-nums">
              {selected.length}
            </span>
          )}
          <ChevronDown className={cn('h-3 w-3 opacity-60', isActive && 'opacity-80')} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          {options.length > 6 && (
            <CommandInput placeholder={searchPlaceholder} className="h-9 text-xs" />
          )}
          <CommandList>
            <CommandEmpty className="py-4 text-xs text-muted-foreground">
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
                        'flex h-3.5 w-3.5 items-center justify-center rounded-sm border',
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
