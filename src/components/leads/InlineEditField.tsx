import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface BaseProps {
  label?: string;
  icon?: ReactNode;
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
}

interface TextFieldProps extends BaseProps {
  type: 'text' | 'textarea';
  value: string;
}

interface CurrencyFieldProps extends BaseProps {
  type: 'currency';
  value: number;
}

interface SelectFieldProps extends BaseProps {
  type: 'select';
  value: string;
  options: { value: string; label: string }[];
}

export type InlineEditFieldProps = TextFieldProps | CurrencyFieldProps | SelectFieldProps;

export function InlineEditField(props: InlineEditFieldProps) {
  const { type, onSave, placeholder = 'Adicionar...', icon, className, label } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const rawValue = type === 'currency' ? String(props.value || 0) : props.value;

  useEffect(() => {
    if (editing) {
      setDraft(rawValue);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  const handleSave = async () => {
    if (draft === rawValue) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  // Reusable label fragment for all modes (only rendered when label is set)
  const LabelNode = label ? (
    <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground truncate" title={label}>
      {label}
    </span>
  ) : null;

  // Tooltip wrapper kept for truncated label accessibility
  const wrapWithTooltip = (node: JSX.Element) => {
    if (!label) return node;
    return (
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  };

  // Select type
  if (type === 'select') {
    const opts = (props as SelectFieldProps).options;
    const currentLabel = opts.find(o => o.value === props.value)?.label;

    return wrapWithTooltip(
      <div className={cn('group flex items-center gap-3 text-sm', className)}>
        {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
        {LabelNode}
        <div className="flex-1 min-w-0">
          <Select
            value={props.value || '__none__'}
            onValueChange={async (v) => {
              const val = v === '__none__' ? '' : v;
              setSaving(true);
              try { await onSave(val); } finally { setSaving(false); }
            }}
            disabled={saving}
          >
            <SelectTrigger className="h-auto w-full border-none bg-transparent shadow-none px-0 py-0.5 hover:bg-accent/50 rounded transition-colors focus:ring-1 text-sm font-normal">
              <SelectValue placeholder={placeholder}>
                {currentLabel || <span className="text-muted-foreground">{placeholder}</span>}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="text-muted-foreground">{placeholder}</span>
              </SelectItem>
              {opts.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  // Display mode
  if (!editing) {
    const displayValue = type === 'currency'
      ? `R$ ${Number(props.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : props.value;

    const isEmpty = !props.value && props.value !== 0;

    return wrapWithTooltip(
      <div
        className={cn(
          'group flex items-center gap-3 text-sm cursor-pointer rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-accent/50',
          className
        )}
        onClick={() => setEditing(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') setEditing(true); }}
      >
        {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
        {LabelNode}
        <div className="flex-1 min-w-0 truncate">
          {isEmpty ? (
            <span className="text-muted-foreground italic">{placeholder}</span>
          ) : (
            <span className={cn(type === 'currency' && 'font-medium')}>{displayValue}</span>
          )}
        </div>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    );
  }

  // Edit mode - textarea
  if (type === 'textarea') {
    return (
      <div className={cn('flex items-start gap-3 text-sm', className)}>
        {icon && <span className="text-muted-foreground shrink-0 mt-2">{icon}</span>}
        {label && (
          <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground truncate mt-2" title={label}>
            {label}
          </span>
        )}
        <Textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => { if (e.key === 'Escape') setEditing(false); }}
          disabled={saving}
          className="min-h-[60px] text-sm flex-1"
          placeholder={placeholder}
        />
      </div>
    );
  }

  // Edit mode - text / currency input
  return (
    <div className={cn('flex items-center gap-3 text-sm', className)}>
      {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
      {LabelNode}
      <Input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type === 'currency' ? 'number' : 'text'}
        step={type === 'currency' ? '0.01' : undefined}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="h-7 text-sm px-2 flex-1"
        placeholder={placeholder}
      />
    </div>
  );
}
