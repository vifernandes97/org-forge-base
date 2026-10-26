import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, SlidersHorizontal, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { FilterMultiSelect } from './FilterMultiSelect';
import { FilterDateRange } from './FilterDateRange';
import { CustomFieldFilters } from './CustomFieldFilters';
import { filterPillClass } from './filterStyles';
import type { CustomFieldDefinition, LeadFilters, LeadPriority, LeadStatusFilter, StageTimeFilter } from '@/types';

interface Option {
  value: string;
  label: string;
  color?: string;
}

const STATUS_OPTIONS: Option[] = [
  { value: 'open', label: 'Ativos' },
  { value: 'won', label: 'Ganhos' },
  { value: 'archived', label: 'Arquivados' },
];

interface AdvancedFiltersSheetProps {
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
  segmentOptions: Option[];
  companyOptions: Option[];
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
  const [open, setOpen] = useState(defaultOpen || count > 0);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b last:border-b-0">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-accent/40"
        >
          <span className="flex items-center gap-2">
            {title}
            {count > 0 && (
              <Badge className="h-5 min-w-[20px] justify-center px-1.5 text-[10px] tabular-nums">{count}</Badge>
            )}
          </span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 px-5 pb-5 pt-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

/** Toggle chips for short option lists (status, priority, qualification, time in stage). */
function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(o.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
              active
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {active ? <Check className="h-3 w-3" /> : o.color && (
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const toggleIn = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export function AdvancedFiltersSheet({
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
  segmentOptions = [],
  companyOptions = [],
  stageTimeOptions,
  customFields,
  showArchiveReason,
}: AdvancedFiltersSheetProps) {
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
      (() => {
        const st = draft.status_filters || ['open'];
        return st.length !== 1 || st[0] !== 'open' ? 1 : 0;
      })() +
      (draft.stage_ids?.length || 0) +
      (draft.assigned_to?.length || 0) +
      (draft.priorities?.length || 0) +
      (draft.qualifications?.length || 0);
    const origin =
      (draft.sources?.length || 0) +
      (draft.tags?.length || 0) +
      (draft.segment_ids?.length || 0) +
      (draft.company_ids?.length || 0) +
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
      'status_filters',
      'stage_ids',
      'assigned_to',
      'priorities',
      'qualifications',
      'sources',
      'tags',
      'archive_reason_ids',
      'segments',
      'segment_ids',
      'company_ids',
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
    if (!partial.status_filters?.length) partial.status_filters = ['open'];
    applyMany(partial);
    setOpen(false);
  };

  const handleClear = () => {
    setDraft({ search: filters.search, status_filters: ['open'] });
  };

  const draftCount = Object.values(sectionCounts).reduce((a, b) => a + b, 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className={filterPillClass(activeFilterCount > 0)}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[440px]">
        <SheetHeader className="space-y-0.5 border-b px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            Filtros
          </SheetTitle>
          <SheetDescription className="text-xs">
            {draftCount > 0 ? `${draftCount} filtro(s) selecionado(s)` : 'Mostrando todos os negócios ativos'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <Section title="Principais" defaultOpen count={sectionCounts.essentials}>
            <Field label="Status">
              <ChipGroup
                options={STATUS_OPTIONS}
                selected={(draft.status_filters || ['open']) as string[]}
                onToggle={(v) => {
                  const next = toggleIn((draft.status_filters || ['open']) as string[], v);
                  setDraftField('status_filters', (next.length ? next : ['open']) as LeadStatusFilter[]);
                }}
              />
            </Field>
            <Field label="Etapa">
              <FilterMultiSelect
                variant="field"
                label="Etapa"
                placeholder="Todas as etapas"
                options={stageOptions}
                selected={draft.stage_ids || []}
                onChange={(v) => setDraftField('stage_ids', v)}
              />
            </Field>
            <Field label="Responsável">
              <FilterMultiSelect
                variant="field"
                label="Responsável"
                placeholder="Qualquer responsável"
                options={memberOptions}
                selected={draft.assigned_to || []}
                onChange={(v) => setDraftField('assigned_to', v)}
              />
            </Field>
            <Field label="Prioridade">
              <ChipGroup
                options={priorityOptions}
                selected={(draft.priorities || []) as string[]}
                onToggle={(v) => setDraftField('priorities', toggleIn((draft.priorities || []) as string[], v) as LeadPriority[])}
              />
            </Field>
            <Field label="Qualificação">
              <ChipGroup
                options={qualificationOptions}
                selected={(draft.qualifications || []).map(String)}
                onToggle={(v) => setDraftField('qualifications', toggleIn((draft.qualifications || []).map(String), v).map(Number))}
              />
            </Field>
          </Section>

          <Section title="Empresa e origem" count={sectionCounts.origin}>
            {companyOptions.length > 0 && (
              <Field label="Empresa">
                <FilterMultiSelect
                  variant="field"
                  label="Empresa"
                  placeholder="Qualquer empresa"
                  options={companyOptions}
                  selected={draft.company_ids || []}
                  onChange={(v) => setDraftField('company_ids', v)}
                />
              </Field>
            )}
            {segmentOptions.length > 0 && (
              <Field label="Segmento">
                <FilterMultiSelect
                  variant="field"
                  label="Segmento"
                  placeholder="Qualquer segmento"
                  options={segmentOptions}
                  selected={draft.segment_ids || []}
                  onChange={(v) => setDraftField('segment_ids', v)}
                />
              </Field>
            )}
            {sourceOptions.length > 0 && (
              <Field label="Fonte">
                <FilterMultiSelect
                  variant="field"
                  label="Fonte"
                  placeholder="Qualquer fonte"
                  options={sourceOptions}
                  selected={draft.sources || []}
                  onChange={(v) => setDraftField('sources', v)}
                />
              </Field>
            )}
            {tagOptions.length > 0 && (
              <Field label="Tags">
                <FilterMultiSelect
                  variant="field"
                  label="Tags"
                  placeholder="Qualquer tag"
                  options={tagOptions}
                  selected={draft.tags || []}
                  onChange={(v) => setDraftField('tags', v)}
                />
              </Field>
            )}
            {showArchiveReason && archiveReasonOptions.length > 0 && (
              <Field label="Motivo de arquivamento">
                <FilterMultiSelect
                  variant="field"
                  label="Motivo"
                  placeholder="Qualquer motivo"
                  options={archiveReasonOptions}
                  selected={draft.archive_reason_ids || []}
                  onChange={(v) => setDraftField('archive_reason_ids', v)}
                />
              </Field>
            )}
            {companyOptions.length === 0 && segmentOptions.length === 0 && sourceOptions.length === 0 && tagOptions.length === 0 && !showArchiveReason && (
              <p className="text-xs italic text-muted-foreground">Sem opções disponíveis.</p>
            )}
          </Section>

          <Section title="Datas e tempo" count={sectionCounts.time}>
            <Field label="Criado em">
              <FilterDateRange
                variant="field"
                label="Criado em"
                from={draft.created_at_from}
                to={draft.created_at_to}
                onChangeFrom={(v) => setDraftField('created_at_from', v)}
                onChangeTo={(v) => setDraftField('created_at_to', v)}
              />
            </Field>
            <Field label="Última atividade">
              <FilterDateRange
                variant="field"
                label="Última atividade"
                from={draft.last_activity_from}
                to={draft.last_activity_to}
                onChangeFrom={(v) => setDraftField('last_activity_from', v)}
                onChangeTo={(v) => setDraftField('last_activity_to', v)}
              />
            </Field>
            <Field label="Tempo na etapa">
              <ChipGroup
                options={stageTimeOptions}
                selected={draft.stage_time ? [draft.stage_time] : []}
                onToggle={(v) => setDraftField('stage_time', draft.stage_time === v ? undefined : (v as StageTimeFilter))}
              />
            </Field>
          </Section>

          <Section title="Valor" count={sectionCounts.value}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mínimo (R$)">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={draft.value_min ?? ''}
                  onChange={(e) => setDraftField('value_min', e.target.value ? Number(e.target.value) : undefined)}
                  className="h-9"
                />
              </Field>
              <Field label="Máximo (R$)">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Sem limite"
                  value={draft.value_max ?? ''}
                  onChange={(e) => setDraftField('value_max', e.target.value ? Number(e.target.value) : undefined)}
                  className="h-9"
                />
              </Field>
            </div>
          </Section>

          {customFields.length > 0 && (
            <Section title="Campos personalizados" count={sectionCounts.custom}>
              <div className="flex flex-col items-start gap-3">
                <CustomFieldFilters
                  fields={customFields}
                  values={draft.custom_fields || {}}
                  onChange={handleCustomFieldChange}
                />
              </div>
            </Section>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-5 py-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleClear} disabled={draftCount === 0}>
            Limpar tudo
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                handleApply();
                onSave();
              }}
              disabled={draftCount === 0}
            >
              <Star className="h-3.5 w-3.5" /> Salvar
            </Button>
            <Button size="sm" onClick={handleApply}>
              Aplicar{draftCount > 0 ? ` (${draftCount})` : ''}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
