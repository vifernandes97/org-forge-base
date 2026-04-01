import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X, Star, Archive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FilterMultiSelect } from './FilterMultiSelect';
import { FilterDateRange } from './FilterDateRange';
import { FilterValueRange } from './FilterValueRange';
import { CustomFieldFilters } from './CustomFieldFilters';
import { SaveFilterDialog } from './SaveFilterDialog';
import { SavedFiltersDropdown } from './SavedFiltersDropdown';
import { useStages } from '@/hooks/useStages';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useCustomFields } from '@/hooks/useCustomFields';
import { useLeads } from '@/hooks/useLeads';
import type { LeadFilters, LeadPriority, StageTimeFilter } from '@/types';

interface LeadFilterBarProps {
  funnelId: string;
  filters: LeadFilters;
  searchInput: string;
  activeFilterCount: number;
  setFilter: <K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) => void;
  clearFilters: () => void;
  applyFilters: (filters: LeadFilters) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa', color: 'hsl(210, 10%, 60%)' },
  { value: 'medium', label: 'Média', color: 'hsl(45, 90%, 50%)' },
  { value: 'high', label: 'Alta', color: 'hsl(25, 95%, 55%)' },
  { value: 'urgent', label: 'Urgente', color: 'hsl(0, 80%, 55%)' },
];

const STAGE_TIME_OPTIONS: { value: StageTimeFilter; label: string }[] = [
  { value: 'less_24h', label: 'Menos de 24h' },
  { value: '1_3_days', label: '1-3 dias' },
  { value: '3_7_days', label: '3-7 dias' },
  { value: 'more_7_days', label: 'Mais de 7 dias' },
  { value: 'above_sla', label: 'Acima do SLA' },
];

export function LeadFilterBar({
  funnelId, filters, searchInput, activeFilterCount,
  setFilter, clearFilters, applyFilters,
}: LeadFilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const { data: stages } = useStages(funnelId);
  const { data: members } = useOrgMembers();
  const { data: customFields } = useCustomFields();
  const { data: allLeads } = useLeads();

  const stageOptions = useMemo(() =>
    (stages || [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(s => ({ value: s.id, label: s.name, color: s.color })),
    [stages]
  );

  const memberOptions = useMemo(() => {
    const opts = (members || []).map(m => ({
      value: m.profile?.id || m.user_id,
      label: m.profile?.full_name || m.invited_email || 'Sem nome',
    }));
    return [{ value: '__none__', label: 'Sem responsável' }, ...opts];
  }, [members]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    (allLeads || []).forEach((l: any) => (l.tags || []).forEach((t: string) => set.add(t)));
    return Array.from(set).sort().map(t => ({ value: t, label: t }));
  }, [allLeads]);

  const allSources = useMemo(() => {
    const set = new Set<string>();
    (allLeads || []).forEach((l: any) => { if (l.source) set.add(l.source); });
    return Array.from(set).sort().map(s => ({ value: s, label: s }));
  }, [allLeads]);

  const activeCustomFields = useMemo(() =>
    (customFields || []).filter(f => f.is_active),
    [customFields]
  );

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    const current = { ...(filters.custom_fields || {}) };
    if (value === undefined || value === null || value === '') {
      delete current[fieldId];
    } else {
      current[fieldId] = value;
    }
    setFilter('custom_fields', Object.keys(current).length > 0 ? current : undefined);
  };

  return (
    <div className="space-y-2">
      {/* Collapsed bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail, empresa, telefone..."
            value={searchInput}
            onChange={e => setFilter('search', e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              <SlidersHorizontal className="h-3 w-3" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-1 h-4 px-1 text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>

        <SavedFiltersDropdown onApply={applyFilters} />

        {activeFilterCount > 0 && (
          <>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground" onClick={clearFilters}>
              <X className="h-3 w-3" /> Limpar
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => setSaveOpen(true)}>
              <Star className="h-3 w-3" /> Salvar
            </Button>
          </>
        )}
      </div>

      {/* Expanded filters */}
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleContent>
          <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-muted/30">
            {/* Stage filter */}
            <FilterMultiSelect
              label="Etapa"
              options={stageOptions}
              selected={filters.stage_ids || []}
              onChange={v => setFilter('stage_ids', v)}
            />

            {/* Assigned to */}
            <FilterMultiSelect
              label="Responsável"
              options={memberOptions}
              selected={filters.assigned_to || []}
              onChange={v => setFilter('assigned_to', v)}
            />

            {/* Priority */}
            <FilterMultiSelect
              label="Prioridade"
              options={PRIORITY_OPTIONS}
              selected={(filters.priorities || []) as string[]}
              onChange={v => setFilter('priorities', v as LeadPriority[])}
            />

            {/* Tags */}
            {allTags.length > 0 && (
              <FilterMultiSelect
                label="Tags"
                options={allTags}
                selected={filters.tags || []}
                onChange={v => setFilter('tags', v)}
              />
            )}

            {/* Sources */}
            {allSources.length > 0 && (
              <FilterMultiSelect
                label="Fonte"
                options={allSources}
                selected={filters.sources || []}
                onChange={v => setFilter('sources', v)}
              />
            )}

            {/* Value range */}
            <FilterValueRange
              valueMin={filters.value_min}
              valueMax={filters.value_max}
              onChangeMin={v => setFilter('value_min', v)}
              onChangeMax={v => setFilter('value_max', v)}
            />

            {/* Created at */}
            <FilterDateRange
              label="Criação"
              from={filters.created_at_from}
              to={filters.created_at_to}
              onChangeFrom={v => setFilter('created_at_from', v)}
              onChangeTo={v => setFilter('created_at_to', v)}
            />

            {/* Last activity */}
            <FilterDateRange
              label="Última atividade"
              from={filters.last_activity_from}
              to={filters.last_activity_to}
              onChangeFrom={v => setFilter('last_activity_from', v)}
              onChangeTo={v => setFilter('last_activity_to', v)}
            />

            {/* Stage time */}
            <Select value={filters.stage_time || '__any__'} onValueChange={v => setFilter('stage_time', v === '__any__' ? undefined : v as StageTimeFilter)}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Tempo na etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Tempo na etapa</SelectItem>
                {STAGE_TIME_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Custom fields */}
            <CustomFieldFilters
              fields={activeCustomFields}
              values={filters.custom_fields || {}}
              onChange={handleCustomFieldChange}
            />

          </div>
        </CollapsibleContent>
      </Collapsible>

      <SaveFilterDialog open={saveOpen} onOpenChange={setSaveOpen} filters={filters} />
    </div>
  );
}
