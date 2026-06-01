import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, SlidersHorizontal, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { FilterMultiSelect } from './FilterMultiSelect';
import { FilterDateRange } from './FilterDateRange';
import { FilterValueRange } from './FilterValueRange';
import { CustomFieldFilters } from './CustomFieldFilters';
import type { CustomFieldDefinition, LeadFilters, LeadPriority, StageTimeFilter } from '@/types';

interface Option {
  value: string;
  label: string;
  color?: string;
}

interface AdvancedFiltersPopoverProps {
  filters: LeadFilters;
  activeFilterCount: number;
  applyMany: (partial: Partial<LeadFilters>) => void;
  clearFilters: () => void;
  onSave: () => void;
  stageOptions: Option[];
  memberOptions: Option[];
  priorityOptions: Option[];
  qualificationOptions: Option[];
  tagOptions: Option[];
  sourceOptions: Option[];
  archiveReasonOptions: Option[];
  stageTimeOptions: { value: StageTimeFilter; label: string }[];
  customFields: CustomFieldDefinition[];
  showArchiveReason: boolean;
}

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  count?: number;
  children: React.ReactNode;
}

function Section({ title, defaultOpen = false, count = 0, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-between w-full py-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-2">
            {title}
            {count > 0 && (
              <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px]">
                {count}
              </Badge>
            )}
          </span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-2">
        <div className="space-y-2.5 pt-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface FilterRowProps {
  label: string;
  children: React.ReactNode;
}

function FilterRow({ label, children }: FilterRowProps) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="min-w-0 flex">{children}</div>
    </div>
  );
}

export function AdvancedFiltersPopover({
  filters,
  activeFilterCount,
  applyMany,
  clearFilters,
  onSave,
  stageOptions,
  memberOptions,
  priorityOptions,
  qualificationOptions,
  tagOptions,
  sourceOptions,
  archiveReasonOptions,
  stageTimeOptions,
  customFields,
  showArchiveReason,
}: AdvancedFiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LeadFilters>(filters);

  // Sync draft when popover opens
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const setDraftField = <K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0)
      ) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    const current = { ...(draft.custom_fields || {}) };
    if (value === undefined || value === null || value === '') {
      delete current[fieldId];
    } else {
      current[fieldId] = value;
    }
    setDraftField(
      'custom_fields',
      Object.keys(current).length > 0 ? current : undefined,
    );
  };

  const sectionCounts = useMemo(() => {
    const essentials =
      (draft.status_filter && draft.status_filter !== 'open' ? 1 : 0) +
      (draft.stage_ids?.length || 0) +
      (draft.assigned_to?.length || 0) +
      (draft.priorities?.length || 0) +
      (draft.qualifications?.length || 0);
    const origin =
      (draft.sources?.length || 0) +
      (draft.tags?.length || 0) +
      (showArchiveReason ? draft.archive_reason_ids?.length || 0 : 0);
    const time =
      (draft.created_at_from || draft.created_at_to ? 1 : 0) +
      (draft.last_activity_from || draft.last_activity_to ? 1 : 0) +
      (draft.stage_time ? 1 : 0);
    const value =
      draft.value_min !== undefined || draft.value_max !== undefined ? 1 : 0;
    const custom = draft.custom_fields ? Object.keys(draft.custom_fields).length : 0;
    return { essentials, origin, time, value, custom };
  }, [draft, showArchiveReason]);

  const handleApply = () => {
    // Build a partial that explicitly clears removed keys
    const allKeys: (keyof LeadFilters)[] = [
      'stage_ids',
      'assigned_to',
      'priorities',
      'qualifications',
      'sources',
      'tags',
      'archive_reason_ids',
      'created_at_from',
      'created_at_to',
      'last_activity_from',
      'last_activity_to',
      'stage_time',
      'value_min',
      'value_max',
      'custom_fields',
    ];
    const partial: Partial<LeadFilters> = {};
    for (const k of allKeys) {
      (partial as any)[k] = (draft as any)[k];
    }
    applyMany(partial);
    setOpen(false);
  };

  const handleClear = () => {
    setDraft({ search: filters.search, status_filter: filters.status_filter });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 gap-1.5 rounded-full px-3.5 text-xs font-medium',
            activeFilterCount > 0 && 'border-primary/30',
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {activeFilterCount > 0 && (
            <Badge
              variant="default"
              className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px] tabular-nums"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[420px] p-0 overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Filtros</h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <ScrollArea className="h-[60vh]">
          <div className="px-4 py-2 divide-y divide-border">
            <Section title="Essenciais" defaultOpen count={sectionCounts.essentials}>
              <FilterRow label="Etapa">
                <FilterMultiSelect
                  label="Selecionar etapas"
                  options={stageOptions}
                  selected={draft.stage_ids || []}
                  onChange={(v) => setDraftField('stage_ids', v)}
                />
              </FilterRow>
              <FilterRow label="Responsável">
                <FilterMultiSelect
                  label="Selecionar"
                  options={memberOptions}
                  selected={draft.assigned_to || []}
                  onChange={(v) => setDraftField('assigned_to', v)}
                />
              </FilterRow>
              <FilterRow label="Prioridade">
                <FilterMultiSelect
                  label="Selecionar"
                  options={priorityOptions}
                  selected={(draft.priorities || []) as string[]}
                  onChange={(v) => setDraftField('priorities', v as LeadPriority[])}
                />
              </FilterRow>
              <FilterRow label="Qualificação">
                <FilterMultiSelect
                  label="Selecionar"
                  options={qualificationOptions}
                  selected={(draft.qualifications || []).map(String)}
                  onChange={(v) => setDraftField('qualifications', v.map(Number))}
                />
              </FilterRow>
            </Section>

            <Section title="Origem & classificação" count={sectionCounts.origin}>
              {sourceOptions.length > 0 && (
                <FilterRow label="Fonte">
                  <FilterMultiSelect
                    label="Selecionar"
                    options={sourceOptions}
                    selected={draft.sources || []}
                    onChange={(v) => setDraftField('sources', v)}
                  />
                </FilterRow>
              )}
              {tagOptions.length > 0 && (
                <FilterRow label="Tags">
                  <FilterMultiSelect
                    label="Selecionar"
                    options={tagOptions}
                    selected={draft.tags || []}
                    onChange={(v) => setDraftField('tags', v)}
                  />
                </FilterRow>
              )}
              {showArchiveReason && archiveReasonOptions.length > 0 && (
                <FilterRow label="Motivo arq.">
                  <FilterMultiSelect
                    label="Selecionar"
                    options={archiveReasonOptions}
                    selected={draft.archive_reason_ids || []}
                    onChange={(v) => setDraftField('archive_reason_ids', v)}
                  />
                </FilterRow>
              )}
              {sourceOptions.length === 0 && tagOptions.length === 0 && !showArchiveReason && (
                <p className="text-xs text-muted-foreground italic px-1 py-1">
                  Sem opções disponíveis.
                </p>
              )}
            </Section>

            <Section title="Tempo" count={sectionCounts.time}>
              <FilterRow label="Criação">
                <FilterDateRange
                  label="De → Até"
                  from={draft.created_at_from}
                  to={draft.created_at_to}
                  onChangeFrom={(v) => setDraftField('created_at_from', v)}
                  onChangeTo={(v) => setDraftField('created_at_to', v)}
                />
              </FilterRow>
              <FilterRow label="Atividade">
                <FilterDateRange
                  label="De → Até"
                  from={draft.last_activity_from}
                  to={draft.last_activity_to}
                  onChangeFrom={(v) => setDraftField('last_activity_from', v)}
                  onChangeTo={(v) => setDraftField('last_activity_to', v)}
                />
              </FilterRow>
              <FilterRow label="Na etapa">
                <Select
                  value={draft.stage_time || '__any__'}
                  onValueChange={(v) =>
                    setDraftField(
                      'stage_time',
                      v === '__any__' ? undefined : (v as StageTimeFilter),
                    )
                  }
                >
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Qualquer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Qualquer</SelectItem>
                    {stageTimeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterRow>
            </Section>

            <Section title="Valor" count={sectionCounts.value}>
              <FilterRow label="Faixa (R$)">
                <FilterValueRange
                  valueMin={draft.value_min}
                  valueMax={draft.value_max}
                  onChangeMin={(v) => setDraftField('value_min', v)}
                  onChangeMax={(v) => setDraftField('value_max', v)}
                />
              </FilterRow>
            </Section>

            {customFields.length > 0 && (
              <Section title="Campos personalizados" count={sectionCounts.custom}>
                <div className="flex flex-wrap gap-2">
                  <CustomFieldFilters
                    fields={customFields}
                    values={draft.custom_fields || {}}
                    onChange={handleCustomFieldChange}
                  />
                </div>
              </Section>
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={handleClear}
          >
            Limpar tudo
          </Button>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => {
                handleApply();
                onSave();
              }}
              disabled={activeFilterCount === 0 && Object.keys(draft).length <= 2}
            >
              <Star className="h-3 w-3" /> Salvar
            </Button>
            <Button size="sm" className="h-8 px-3 text-xs" onClick={handleApply}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
