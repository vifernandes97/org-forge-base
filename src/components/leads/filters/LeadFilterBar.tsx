import { normalizeKey } from '@/lib/leadDisplay';
import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { QuickFilterPill } from './QuickFilterPill';
import { AdvancedFiltersSheet } from './AdvancedFiltersSheet';
import { SaveFilterDialog } from './SaveFilterDialog';
import { SavedFiltersDropdown } from './SavedFiltersDropdown';
import { useStages } from '@/hooks/useStages';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useCustomFields } from '@/hooks/useCustomFields';
import { useLeads } from '@/hooks/useLeads';
import { useActiveArchiveReasons } from '@/hooks/useArchiveReasons';
import { useCompanies, useSegments } from '@/hooks/useCompanies';
import type { LeadFilters, LeadPriority, StageTimeFilter } from '@/types';

interface LeadFilterBarProps {
  funnelId: string;
  filters: LeadFilters;
  searchInput: string;
  activeFilterCount: number;
  setFilter: <K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) => void;
  clearFilters: () => void;
  applyFilters: (filters: LeadFilters) => void;
  applyMany: (partial: Partial<LeadFilters>) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa', color: 'hsl(210, 10%, 60%)' },
  { value: 'medium', label: 'Média', color: 'hsl(45, 90%, 50%)' },
  { value: 'high', label: 'Alta', color: 'hsl(25, 95%, 55%)' },
  { value: 'urgent', label: 'Urgente', color: 'hsl(0, 80%, 55%)' },
];

const QUALIFICATION_OPTIONS = [
  { value: '1', label: '1 — Muito Baixa' },
  { value: '2', label: '2 — Baixa' },
  { value: '3', label: '3 — Média' },
  { value: '4', label: '4 — Alta' },
  { value: '5', label: '5 — Muito Alta' },
];

const STAGE_TIME_OPTIONS: { value: StageTimeFilter; label: string }[] = [
  { value: 'less_24h', label: 'Menos de 24h' },
  { value: '1_3_days', label: '1-3 dias' },
  { value: '3_7_days', label: '3-7 dias' },
  { value: 'more_7_days', label: 'Mais de 7 dias' },
  { value: 'above_sla', label: 'Acima do SLA' },
];

export function LeadFilterBar({
  funnelId,
  filters,
  searchInput,
  activeFilterCount,
  setFilter,
  clearFilters,
  applyFilters,
  applyMany,
}: LeadFilterBarProps) {
  const [saveOpen, setSaveOpen] = useState(false);

  const { data: stages } = useStages(funnelId);
  const { data: members } = useOrgMembers();
  const { data: customFields } = useCustomFields();
  const { data: allLeads } = useLeads();
  const { data: archiveReasons } = useActiveArchiveReasons();

  const { data: companies } = useCompanies();
  const { data: segments } = useSegments();
  const segmentOptions = useMemo(
    () => (segments || []).map(s => ({ value: s.id, label: s.is_active ? s.label : `${s.label} (inativo)` })),
    [segments],
  );
  // Legacy filters (saved/URL) store the segment text: convert by normalized name to ids.
  useEffect(() => {
    if (!filters.segments?.length || !segments) return;
    const keys = new Set(filters.segments.map(normalizeKey));
    const ids = segments.filter(s => keys.has(normalizeKey(s.label))).map(s => s.id);
    applyMany({ segments: undefined, segment_ids: Array.from(new Set([...(filters.segment_ids || []), ...ids])) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.segments, segments]);
  const companyOptions = useMemo(
    () => (companies || []).map(c => ({ value: c.id, label: c.trade_name })),
    [companies],
  );

  const archiveReasonOptions = useMemo(
    () => (archiveReasons || []).map((r) => ({ value: r.id, label: r.label })),
    [archiveReasons],
  );

  const stageOptions = useMemo(
    () =>
      (stages || [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ value: s.id, label: s.name, color: s.color })),
    [stages],
  );

  const memberOptions = useMemo(() => {
    const opts = (members || []).map((m) => ({
      value: m.profile?.id || m.user_id,
      label: m.profile?.full_name || m.invited_email || 'Sem nome',
    }));
    return [{ value: '__none__', label: 'Sem responsável' }, ...opts];
  }, [members]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    (allLeads || []).forEach((l: any) =>
      (l.tags || []).forEach((t: string) => set.add(t)),
    );
    return Array.from(set).sort().map((t) => ({ value: t, label: t }));
  }, [allLeads]);

  const allSources = useMemo(() => {
    const set = new Set<string>();
    (allLeads || []).forEach((l: any) => {
      if (l.source) set.add(l.source);
    });
    return Array.from(set).sort().map((s) => ({ value: s, label: s }));
  }, [allLeads]);

  const activeCustomFields = useMemo(
    () => (customFields || []).filter((f) => f.is_active),
    [customFields],
  );

  const showArchiveReason = (filters.status_filters || []).includes('archived');

  // Build active filter chips (grouped per category)
  type Chip = {
    key: string;
    label: string;
    color?: string;
    onRemove: () => void;
  };

  const chips = useMemo<Chip[]>(() => {
    const list: Chip[] = [];
    const findOpt = <T extends { value: string; label: string; color?: string }>(
      opts: T[],
      v: string,
    ) => opts.find((o) => o.value === v);

    // Group multi-selects: one chip per category if >2 selected
    const groupOrSpread = (
      keyPrefix: string,
      categoryLabel: string,
      values: string[],
      opts: { value: string; label: string; color?: string }[],
      onRemoveAll: () => void,
      onRemoveOne: (v: string) => void,
    ) => {
      if (values.length === 0) return;
      if (values.length > 2) {
        list.push({
          key: `${keyPrefix}-grp`,
          label: `${categoryLabel}: ${values.length} selecionados`,
          onRemove: onRemoveAll,
        });
      } else {
        values.forEach((v) => {
          const opt = findOpt(opts, v);
          list.push({
            key: `${keyPrefix}-${v}`,
            label: `${categoryLabel}: ${opt?.label ?? v}`,
            color: opt?.color,
            onRemove: () => onRemoveOne(v),
          });
        });
      }
    };

    const statuses = filters.status_filters || ['open'];
    if (statuses.length !== 1 || statuses[0] !== 'open') {
      const labels: Record<string, string> = {
        open: 'Ativos',
        won: 'Ganhos',
        archived: 'Arquivados',
      };
      list.push({
        key: 'status',
        label: `Status: ${statuses.map((s) => labels[s] ?? s).join(', ')}`,
        onRemove: () => setFilter('status_filters', ['open']),
      });
    }

    groupOrSpread(
      'stage',
      'Etapa',
      filters.stage_ids || [],
      stageOptions,
      () => setFilter('stage_ids', undefined),
      (v) => setFilter('stage_ids', (filters.stage_ids || []).filter((x) => x !== v)),
    );
    groupOrSpread(
      'assigned',
      'Responsável',
      filters.assigned_to || [],
      memberOptions,
      () => setFilter('assigned_to', undefined),
      (v) =>
        setFilter('assigned_to', (filters.assigned_to || []).filter((x) => x !== v)),
    );
    groupOrSpread(
      'prio',
      'Prioridade',
      (filters.priorities || []) as string[],
      PRIORITY_OPTIONS,
      () => setFilter('priorities', undefined),
      (v) =>
        setFilter(
          'priorities',
          (filters.priorities || []).filter((x) => x !== v) as LeadPriority[],
        ),
    );
    groupOrSpread(
      'qual',
      'Qualificação',
      (filters.qualifications || []).map(String),
      QUALIFICATION_OPTIONS,
      () => setFilter('qualifications', undefined),
      (v) =>
        setFilter(
          'qualifications',
          (filters.qualifications || []).filter((x) => String(x) !== v),
        ),
    );
    groupOrSpread(
      'src',
      'Fonte',
      filters.sources || [],
      allSources,
      () => setFilter('sources', undefined),
      (v) => setFilter('sources', (filters.sources || []).filter((x) => x !== v)),
    );
    groupOrSpread(
      'tag',
      'Tag',
      filters.tags || [],
      allTags,
      () => setFilter('tags', undefined),
      (v) => setFilter('tags', (filters.tags || []).filter((x) => x !== v)),
    );
    groupOrSpread(
      'seg',
      'Segmento',
      filters.segment_ids || [],
      segmentOptions,
      () => setFilter('segment_ids', undefined),
      (v) => setFilter('segment_ids', (filters.segment_ids || []).filter((x) => x !== v)),
    );
    groupOrSpread(
      'comp',
      'Empresa',
      filters.company_ids || [],
      companyOptions,
      () => setFilter('company_ids', undefined),
      (v) => setFilter('company_ids', (filters.company_ids || []).filter((x) => x !== v)),
    );
    groupOrSpread(
      'arch',
      'Motivo',
      filters.archive_reason_ids || [],
      archiveReasonOptions,
      () => setFilter('archive_reason_ids', undefined),
      (v) =>
        setFilter(
          'archive_reason_ids',
          (filters.archive_reason_ids || []).filter((x) => x !== v),
        ),
    );

    if (filters.value_min != null || filters.value_max != null) {
      const min = filters.value_min != null ? `R$ ${filters.value_min}` : '−∞';
      const max = filters.value_max != null ? `R$ ${filters.value_max}` : '+∞';
      list.push({
        key: 'value',
        label: `Valor: ${min} – ${max}`,
        onRemove: () => {
          setFilter('value_min', undefined);
          setFilter('value_max', undefined);
        },
      });
    }
    if (filters.created_at_from || filters.created_at_to) {
      list.push({
        key: 'created',
        label: 'Período de criação',
        onRemove: () => {
          setFilter('created_at_from', undefined);
          setFilter('created_at_to', undefined);
        },
      });
    }
    if (filters.last_activity_from || filters.last_activity_to) {
      list.push({
        key: 'lastact',
        label: 'Última atividade',
        onRemove: () => {
          setFilter('last_activity_from', undefined);
          setFilter('last_activity_to', undefined);
        },
      });
    }
    if (filters.stage_time) {
      const lbl = STAGE_TIME_OPTIONS.find((o) => o.value === filters.stage_time)?.label;
      list.push({
        key: 'stagetime',
        label: `Tempo na etapa: ${lbl}`,
        onRemove: () => setFilter('stage_time', undefined),
      });
    }
    Object.entries(filters.custom_fields || {}).forEach(([fid, val]) => {
      const f = activeCustomFields.find((cf) => cf.id === fid);
      list.push({
        key: `cf-${fid}`,
        label: `${f?.field_label ?? 'Campo'}: ${
          typeof val === 'object' ? '...' : String(val)
        }`,
        onRemove: () => {
          const current = { ...(filters.custom_fields || {}) };
          delete current[fid];
          setFilter(
            'custom_fields',
            Object.keys(current).length > 0 ? current : undefined,
          );
        },
      });
    });
    return list;
  }, [
    filters,
    stageOptions,
    memberOptions,
    archiveReasonOptions,
    activeCustomFields,
    allSources,
    allTags,
    setFilter,
  ]);

  return (
    <div className="space-y-2.5">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[360px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa, CNPJ ou contato..."
            value={searchInput}
            onChange={(e) => setFilter('search', e.target.value)}
            className="h-9 pl-9 text-sm bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-input"
          />
        </div>

        {/* Quick pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <QuickFilterPill
            label="Etapa"
            options={stageOptions}
            selected={filters.stage_ids || []}
            onChange={(v) => setFilter('stage_ids', v)}
          />
          <QuickFilterPill
            label="Responsável"
            options={memberOptions}
            selected={filters.assigned_to || []}
            onChange={(v) => setFilter('assigned_to', v)}
          />
          <QuickFilterPill
            label="Prioridade"
            options={PRIORITY_OPTIONS}
            selected={(filters.priorities || []) as string[]}
            onChange={(v) => setFilter('priorities', v as LeadPriority[])}
          />
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-1 ml-auto">
          <AdvancedFiltersSheet
            filters={filters}
            activeFilterCount={activeFilterCount}
            applyMany={applyMany}
            clearFilters={clearFilters}
            onSave={() => setSaveOpen(true)}
            stageOptions={stageOptions}
            memberOptions={memberOptions}
            priorityOptions={PRIORITY_OPTIONS}
            qualificationOptions={QUALIFICATION_OPTIONS}
            tagOptions={allTags}
            sourceOptions={allSources}
            archiveReasonOptions={archiveReasonOptions}
            segmentOptions={segmentOptions}
            companyOptions={companyOptions}
            stageTimeOptions={STAGE_TIME_OPTIONS}
            customFields={activeCustomFields}
            showArchiveReason={showArchiveReason}
          />
          <SavedFiltersDropdown onApply={applyFilters} />
          {activeFilterCount > 0 && (
            <>
              <Separator orientation="vertical" className="h-5 mx-0.5" />
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Active chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onRemove}
              className="inline-flex items-center gap-1.5 h-6 rounded-full bg-muted/70 hover:bg-muted px-2.5 text-[11px] text-foreground transition-colors group"
            >
              {c.color && (
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
              )}
              <span className="truncate max-w-[220px]">{c.label}</span>
              <X className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
            </button>
          ))}
          {chips.length >= 3 && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar tudo
            </button>
          )}
        </div>
      )}

      <SaveFilterDialog open={saveOpen} onOpenChange={setSaveOpen} filters={filters} />
    </div>
  );
}
