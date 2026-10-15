import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (v: string | undefined) => void;
}

/** Single-choice filter with an "any" option (Radix needs a sentinel instead of ''). */
export function TriFilter({ label, value, options, onChange }: Props) {
  return (
    <Select value={value || '__any__'} onValueChange={v => onChange(v === '__any__' ? undefined : v)}>
      <SelectTrigger className={`h-9 w-auto min-w-[150px] ${value ? 'border-primary text-primary' : ''}`}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__any__">{label}: todos</SelectItem>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{label}: {o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
