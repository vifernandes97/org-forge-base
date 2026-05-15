import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tag, Pencil } from 'lucide-react';
import { CustomFieldRenderer } from '@/components/custom-fields/CustomFieldRenderer';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { CustomFieldDefinition } from '@/types';

interface Props {
  def: CustomFieldDefinition;
  value: string;
  onSave: (v: string) => void | Promise<void>;
  disabled?: boolean;
}

function parseMulti(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CustomFieldInlineEdit({ def, value, onSave, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!open) setDraft(value);
  }, [value, open]);

  const handleOpenChange = (next: boolean) => {
    if (!next && draft !== value) {
      onSave(draft);
    }
    setOpen(next);
  };

  const renderDisplay = () => {
    if (def.field_type === 'multi_select') {
      const items = parseMulti(value);
      if (items.length === 0) return null;
      return (
        <div className="flex flex-wrap gap-1">
          {items.map(s => (
            <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>
          ))}
        </div>
      );
    }
    if (def.field_type === 'date') {
      if (!value) return null;
      try {
        return <span>{format(parseISO(value), 'dd/MM/yyyy', { locale: ptBR })}</span>;
      } catch {
        return <span>{value}</span>;
      }
    }
    if (def.field_type === 'checkbox') {
      return <span>{value === 'true' ? 'Sim' : 'Não'}</span>;
    }
    return value ? <span className="truncate">{value}</span> : null;
  };

  const display = renderDisplay();
  const placeholder = `Adicionar ${def.field_label.toLowerCase()}...`;

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : handleOpenChange}>
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              className={cn(
                'group flex items-center gap-3 text-sm cursor-pointer rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-accent/50',
                disabled && 'cursor-default'
              )}
            >
              <span className="text-muted-foreground shrink-0"><Tag className="h-4 w-4" /></span>
              <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground truncate" title={def.field_label}>
                {def.field_label}
              </span>
              <div className="flex-1 min-w-0">
                {display ?? <span className="text-muted-foreground italic">{placeholder}</span>}
              </div>
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{def.field_label}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{def.field_label}</p>
          <CustomFieldRenderer field={def} value={draft} onChange={setDraft} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
