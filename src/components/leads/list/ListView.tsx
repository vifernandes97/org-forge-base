import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLeadsList } from '@/hooks/useLeads';
import { useStages } from '@/hooks/useStages';
import { useCustomFields } from '@/hooks/useCustomFields';
import { getCustomFieldValuesForLeads } from '@/services/leads';
import { applyClientFilters } from '@/lib/leadClientFilters';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { BulkActionsBar } from './BulkActionsBar';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PriorityBadge } from '@/components/leads/PriorityBadge';
import { StatusBadge } from '@/components/leads/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowUpDown, ChevronLeft, ChevronRight, SlidersHorizontal, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import type { LeadFilters, CustomFieldDefinition } from '@/types';
import { getLeadDisplay, getPrimaryContact } from '@/lib/leadDisplay';
import { formatCnpj } from '@/lib/cnpj';

interface ListViewProps {
  funnelId: string;
  filters?: LeadFilters;
}

const STORAGE_KEY = 'crm_leads_visible_cols_v2';

const COLUMNS = [
  { key: 'company', label: 'Empresa', defaultVisible: true, sortable: true },
  { key: 'segment', label: 'Segmento', defaultVisible: true, sortable: true },
  { key: 'legal_name', label: 'Razão Social', defaultVisible: true, sortable: false },
  { key: 'cnpj', label: 'CNPJ', defaultVisible: false, sortable: false },
  { key: 'contact', label: 'Contato principal', defaultVisible: true, sortable: false },
  { key: 'email', label: 'E-mail', defaultVisible: true, sortable: false },
  { key: 'phone', label: 'Telefone', defaultVisible: true, sortable: false },
  { key: 'stage_id', label: 'Etapa', defaultVisible: true, sortable: true },
  { key: 'assigned', label: 'Responsável', defaultVisible: true, sortable: false },
  { key: 'value', label: 'Valor', defaultVisible: true, sortable: true },
  { key: 'priority', label: 'Prioridade', defaultVisible: true, sortable: true },
  { key: 'status', label: 'Status', defaultVisible: true, sortable: false },
  { key: 'qualification', label: 'Qualificação', defaultVisible: true, sortable: true },
  { key: 'tags', label: 'Tags', defaultVisible: false, sortable: false },
  { key: 'last_activity_at', label: 'Última atividade', defaultVisible: true, sortable: true },
  { key: 'created_at', label: 'Criado em', defaultVisible: false, sortable: false },
] as const;

type FixedColumnKey = (typeof COLUMNS)[number]['key'];

function loadVisibleColumns(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
}

function formatCustomFieldValue(value: string | null, field: CustomFieldDefinition): React.ReactNode {
  if (!value) return '—';
  switch (field.field_type) {
    case 'number':
      return Number(value).toLocaleString('pt-BR');
    case 'currency':
      return `R$ ${Number(value.replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    case 'date':
      try { return new Date(value).toLocaleDateString('pt-BR'); } catch { return value; }
    case 'checkbox':
      return value === 'true' ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />;
    case 'select':
      return <Badge variant="secondary" className="text-[10px]">{value}</Badge>;
    case 'multi_select':
      try {
        const items = JSON.parse(value) as string[];
        return (
          <div className="flex gap-1 flex-wrap">
            {items.slice(0, 2).map(i => <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{i}</Badge>)}
            {items.length > 2 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{items.length - 2}</Badge>}
          </div>
        );
      } catch { return value; }
    default:
      return <span className="truncate max-w-[150px] block">{value}</span>;
  }
}

export function ListView({ funnelId, filters }: ListViewProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('last_activity_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(loadVisibleColumns);

  const { data: stages } = useStages(funnelId);
  const { data: result, isLoading } = useLeadsList(funnelId, page, pageSize, sortBy, sortOrder, filters);
  const { data: customFields } = useCustomFields();

  const rawLeads = result?.data || [];
  const totalCount = result?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const activeCustomFields = useMemo(() => (customFields || []).filter(f => f.is_active), [customFields]);

  const leadIds = useMemo(() => rawLeads.map((l: any) => l.id), [rawLeads]);
  const { data: cfValues } = useQuery({
    queryKey: ['custom-field-values-list', leadIds],
    queryFn: () => getCustomFieldValuesForLeads(leadIds),
    enabled: leadIds.length > 0,
  });

  const cfValueMap = useMemo(() => {
    const map: Record<string, Record<string, string | null>> = {};
    (cfValues || []).forEach((v: any) => {
      if (!map[v.lead_id]) map[v.lead_id] = {};
      map[v.lead_id][v.field_definition_id] = v.value;
    });
    return map;
  }, [cfValues]);

  const leads = useMemo(
    () => applyClientFilters(rawLeads as any[], filters, stages || [], cfValueMap),
    [rawLeads, filters, stages, cfValueMap]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const isVisible = (key: string) => visibleColumns.includes(key);

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
    setPage(0);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === leads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(leads.map((l: any) => l.id));
    }
  };

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(col)}>
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortBy === col ? 'text-foreground' : 'text-muted-foreground/40'}`} />
      </div>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
      </div>
    );
  }

  const visibleCount = visibleColumns.length + 1;

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        {selectedIds.length > 0 && (
          <BulkActionsBar
            selectedIds={selectedIds}
            stages={stages || []}
            onClear={() => setSelectedIds([])}
          />
        )}
        <div className="ml-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 hidden md:inline-flex">
                <SlidersHorizontal className="h-4 w-4" />
                Colunas
              </Button>

            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2 max-h-[400px] overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Colunas visíveis</p>
              <div className="space-y-1">
                {COLUMNS.map(col => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={isVisible(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
              {activeCustomFields.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Campos personalizados</p>
                  <div className="space-y-1">
                    {activeCustomFields.map(cf => (
                      <label
                        key={cf.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={isVisible(`cf_${cf.id}`)}
                          onCheckedChange={() => toggleColumn(`cf_${cf.id}`)}
                        />
                        {cf.field_label}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="rounded-lg border overflow-auto hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={leads.length > 0 && selectedIds.length === leads.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              {isVisible('company') && <SortHeader col="company">Empresa</SortHeader>}
              {isVisible('segment') && <SortHeader col="segment">Segmento</SortHeader>}
              {isVisible('legal_name') && <TableHead>Razão Social</TableHead>}
              {isVisible('cnpj') && <TableHead>CNPJ</TableHead>}
              {isVisible('contact') && <TableHead>Contato principal</TableHead>}
              {isVisible('email') && <TableHead>E-mail</TableHead>}
              {isVisible('phone') && <TableHead>Telefone</TableHead>}
              {isVisible('stage_id') && <SortHeader col="stage_id">Etapa</SortHeader>}
              {isVisible('assigned') && <TableHead>Responsável</TableHead>}
              {isVisible('value') && <SortHeader col="value">Valor</SortHeader>}
              {isVisible('priority') && <SortHeader col="priority">Prioridade</SortHeader>}
              {isVisible('status') && <TableHead>Status</TableHead>}
              {isVisible('qualification') && <SortHeader col="qualification">Qualificação</SortHeader>}
              {isVisible('tags') && <TableHead>Tags</TableHead>}
              {isVisible('last_activity_at') && <SortHeader col="last_activity_at">Última atividade</SortHeader>}
              {isVisible('created_at') && <TableHead>Criado em</TableHead>}
              {activeCustomFields.map(cf =>
                isVisible(`cf_${cf.id}`) ? <TableHead key={cf.id}>{cf.field_label}</TableHead> : null
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCount} className="text-center text-muted-foreground py-8">
                  Nenhum negócio encontrado neste funil.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead: any) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => setSelectedLeadId(lead.id)}
                >
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(lead.id)}
                      onCheckedChange={() => toggleSelect(lead.id)}
                    />
                  </TableCell>
                  {isVisible('company') && (
                    <TableCell className="font-medium max-w-[180px] truncate">{lead.company?.trade_name || '—'}</TableCell>
                  )}
                  {isVisible('segment') && (
                    <TableCell className="max-w-[140px] truncate text-muted-foreground">{lead.company?.segment || '—'}</TableCell>
                  )}
                  {isVisible('legal_name') && (
                    <TableCell className="max-w-[140px] truncate text-muted-foreground">{lead.company?.legal_name || '—'}</TableCell>
                  )}
                  {isVisible('cnpj') && (
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{lead.company?.cnpj ? formatCnpj(lead.company.cnpj) : '—'}</TableCell>
                  )}
                  {isVisible('contact') && (
                    <TableCell className="max-w-[140px] truncate">{getPrimaryContact(lead)?.name || '—'}</TableCell>
                  )}
                  {isVisible('email') && (
                    <TableCell className="text-muted-foreground text-xs">{getPrimaryContact(lead)?.email || '—'}</TableCell>
                  )}
                  {isVisible('phone') && (
                    <TableCell className="text-muted-foreground text-xs">{getPrimaryContact(lead)?.phone || '—'}</TableCell>
                  )}
                  {isVisible('stage_id') && (
                    <TableCell>
                      {lead.stage && (
                        <Badge variant="outline" className="text-xs" style={{ borderColor: lead.stage.color, color: lead.stage.color }}>
                          {lead.stage.name}
                        </Badge>
                      )}
                    </TableCell>
                  )}
                  {isVisible('assigned') && (
                    <TableCell>
                      {lead.assigned_profile ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[9px]">{lead.assigned_profile.full_name?.[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs truncate max-w-[80px]">{lead.assigned_profile.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  {isVisible('value') && (
                    <TableCell className="text-right whitespace-nowrap">
                      {lead.value > 0
                        ? `R$ ${Number(lead.value).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                        : '—'}
                    </TableCell>
                  )}
                  {isVisible('priority') && (
                    <TableCell><PriorityBadge priority={lead.priority} /></TableCell>
                  )}
                  {isVisible('status') && (
                    <TableCell><StatusBadge status={lead.status || 'open'} /></TableCell>
                  )}
                  {isVisible('qualification') && (
                    <TableCell className="text-xs">
                      {lead.qualification
                        ? { 1: '1 - Muito Baixa', 2: '2 - Baixa', 3: '3 - Média', 4: '4 - Alta', 5: '5 - Muito Alta' }[lead.qualification as number] ?? lead.qualification
                        : '—'}
                    </TableCell>
                  )}
                  {isVisible('tags') && (
                    <TableCell>
                      <div className="flex gap-1">
                        {(lead.tags || []).slice(0, 2).map((t: string) => (
                          <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                        ))}
                        {(lead.tags || []).length > 2 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{lead.tags.length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {isVisible('last_activity_at') && (
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(lead.last_activity_at), { addSuffix: true, locale: ptBR })}
                    </TableCell>
                  )}
                  {isVisible('created_at') && (
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  )}
                  {activeCustomFields.map(cf =>
                    isVisible(`cf_${cf.id}`) ? (
                      <TableCell key={cf.id} className="text-xs">
                        {formatCustomFieldValue(cfValueMap[lead.id]?.[cf.id] ?? null, cf)}
                      </TableCell>
                    ) : null
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {leads.length === 0 ? (
          <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            Nenhum negócio encontrado neste funil.
          </div>
        ) : (
          leads.map((lead: any) => (
            <div
              key={lead.id}
              className="rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/50 active:bg-accent transition-colors"
              onClick={() => setSelectedLeadId(lead.id)}
            >
              <div className="flex items-start gap-2">
                <div onClick={e => e.stopPropagation()} className="pt-0.5">
                  <Checkbox
                    checked={selectedIds.includes(lead.id)}
                    onCheckedChange={() => toggleSelect(lead.id)}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm truncate">
                      {getLeadDisplay(lead).title}
                    </p>
                    {lead.stage && (
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 px-1.5 py-0"
                        style={{ borderColor: lead.stage.color, color: lead.stage.color }}
                      >
                        {lead.stage.name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {[getPrimaryContact(lead)?.name, lead.company?.segment, lead.value > 0 ? `R$ ${Number(lead.value).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : null]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {lead.assigned_profile ? (
                        <>
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarFallback className="text-[9px]">
                              {lead.assigned_profile.full_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground truncate">
                            {lead.assigned_profile.full_name}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem responsável</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                      {formatDistanceToNow(new Date(lead.last_activity_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <PriorityBadge priority={lead.priority} />
                    <StatusBadge status={lead.status || 'open'} />
                    {(lead.tags || []).slice(0, 2).map((t: string) => (
                      <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                    ))}
                    {(lead.tags || []).length > 2 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{lead.tags.length - 2}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>


      {/* Pagination */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Exibindo {leads.length} de {totalCount}</span>
          <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-[70px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-2">{page + 1} / {Math.max(1, totalPages)}</span>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} aria-label="Próxima página">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <LeadDetailSheet leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
    </>
  );
}
