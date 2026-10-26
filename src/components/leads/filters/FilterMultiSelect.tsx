import { QuickFilterPill, type QuickFilterOption } from './QuickFilterPill';

interface FilterMultiSelectProps {
  label: string;
  options: QuickFilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  variant?: 'pill' | 'field';
}

/** Multi-select filter; same trigger and list as the deals toolbar pills. */
export function FilterMultiSelect({ label, options, selected, onChange, placeholder, variant = 'pill' }: FilterMultiSelectProps) {
  return (
    <QuickFilterPill
      label={label}
      options={options}
      selected={selected}
      onChange={onChange}
      variant={variant}
      placeholder={placeholder}
    />
  );
}
