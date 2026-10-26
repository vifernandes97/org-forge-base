import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { filterPillClass } from '@/components/leads/filters/filterStyles';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (v: string | undefined) => void;
}

/** Single-choice filter with an "any" option (Radix needs a sentinel instead of ''). */
export function TriFilter({ label, value, options, onChange }: Props) {
  const current = options.find(o => o.value === value)?.label;
  return (
    <Select value={value || '__any__'} onValueChange={v => onChange(v === '__any__' ? undefined : v)}>
      <SelectTrigger className={cn('w-auto hover:bg-accent hover:text-accent-foreground [&>svg]:h-3 [&>svg]:w-3', filterPillClass(!!value))}>
        <SelectValue>{current ? <>{label} <span className="font-normal opacity-80">· {current}</span></> : label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__any__">Qualquer</SelectItem>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
