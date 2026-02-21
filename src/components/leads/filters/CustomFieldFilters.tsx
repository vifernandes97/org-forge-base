import type { CustomFieldDefinition } from '@/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilterMultiSelect } from './FilterMultiSelect';
import { FilterDateRange } from './FilterDateRange';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface CustomFieldFiltersProps {
  fields: CustomFieldDefinition[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
}

export function CustomFieldFilters({ fields, values, onChange }: CustomFieldFiltersProps) {
  if (fields.length === 0) return null;

  return (
    <>
      {fields.map(field => {
        const val = values[field.id];

        switch (field.field_type) {
          case 'text':
          case 'url':
          case 'email':
          case 'phone':
            return (
              <div key={field.id} className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">{field.field_label}</Label>
                <Input
                  placeholder={`Buscar ${field.field_label.toLowerCase()}...`}
                  value={val || ''}
                  onChange={e => onChange(field.id, e.target.value || undefined)}
                  className="h-8 w-36 text-xs"
                />
              </div>
            );

          case 'number':
          case 'currency':
            return (
              <div key={field.id} className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">{field.field_label}</Label>
                <Input
                  type="number"
                  placeholder="Mín"
                  value={val?.min ?? ''}
                  onChange={e => onChange(field.id, { ...val, min: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-8 w-20 text-xs"
                />
                <span className="text-xs">-</span>
                <Input
                  type="number"
                  placeholder="Máx"
                  value={val?.max ?? ''}
                  onChange={e => onChange(field.id, { ...val, max: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-8 w-20 text-xs"
                />
              </div>
            );

          case 'date':
            return (
              <FilterDateRange
                key={field.id}
                label={field.field_label}
                from={val?.from}
                to={val?.to}
                onChangeFrom={v => onChange(field.id, { ...val, from: v })}
                onChangeTo={v => onChange(field.id, { ...val, to: v })}
              />
            );

          case 'select':
            return (
              <div key={field.id} className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">{field.field_label}</Label>
                <Select value={val || '__any__'} onValueChange={v => onChange(field.id, v === '__any__' ? undefined : v)}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="Qualquer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Qualquer</SelectItem>
                    {(field.options || []).map(o => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );

          case 'multi_select':
            return (
              <FilterMultiSelect
                key={field.id}
                label={field.field_label}
                options={(field.options || []).map(o => ({ value: o, label: o }))}
                selected={val || []}
                onChange={v => onChange(field.id, v.length > 0 ? v : undefined)}
              />
            );

          case 'checkbox':
            return (
              <div key={field.id} className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">{field.field_label}</Label>
                <Select value={val ?? '__any__'} onValueChange={v => onChange(field.id, v === '__any__' ? undefined : v)}>
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Qualquer</SelectItem>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );

          default:
            return null;
        }
      })}
    </>
  );
}
