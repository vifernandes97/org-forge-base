import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NATIVE_TARGETS } from '@/lib/spreadsheet';
import type { CustomFieldDefinition } from '@/types';

interface Props {
  headers: string[];
  sample: Record<string, string>[];
  mapping: Record<string, string>;
  customFields: CustomFieldDefinition[];
  onChange: (header: string, target: string) => void;
}

export function ColumnMappingStep({ headers, sample, mapping, customFields, onChange }: Props) {
  const usedTargets = new Set(Object.values(mapping).filter(Boolean));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Confira para onde vai cada coluna da planilha. Colunas marcadas como "Ignorar" não são importadas.
      </p>
      <div className="space-y-2">
        {headers.map(header => {
          const current = mapping[header] || '__ignore__';
          const example = sample.map(r => r[header]).find(v => v);
          return (
            <div
              key={header}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{header}</p>
                {example && (
                  <p className="truncate text-xs text-muted-foreground">Exemplo: {example}</p>
                )}
              </div>
              <Select
                value={current}
                onValueChange={v => onChange(header, v === '__ignore__' ? '' : v)}
              >
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ignore__">Ignorar</SelectItem>
                  {NATIVE_TARGETS.map(t => (
                    <SelectItem
                      key={t.key}
                      value={t.key}
                      disabled={current !== t.key && usedTargets.has(t.key)}
                    >
                      {t.label}
                    </SelectItem>
                  ))}
                  {customFields.map(f => (
                    <SelectItem
                      key={f.id}
                      value={`cf:${f.id}`}
                      disabled={current !== `cf:${f.id}` && usedTargets.has(`cf:${f.id}`)}
                    >
                      {f.field_label} (personalizado)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
