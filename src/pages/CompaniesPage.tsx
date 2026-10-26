import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MobileFab } from '@/components/shared/MobileFab';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Check, Download, Merge, MoreHorizontal, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSegments, invalidateLeadData } from '@/hooks/useCompanies';
import { useFunnels } from '@/hooks/useFunnels';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useUrlListState } from '@/hooks/useUrlListState';
import { DataTable, ColumnsMenu, useVisibleColumns, type Column } from '@/components/directory/DataTable';
import { TriFilter } from '@/components/directory/TriFilter';
import { MergeCompaniesDialog } from '@/components/directory/MergeCompaniesDialog';
import { FilterMultiSelect } from '@/components/leads/filters/FilterMultiSelect';
import { FilterDateRange } from '@/components/leads/filters/FilterDateRange';
import { filterPillClass, filterSearchClass } from '@/components/leads/filters/filterStyles';
import { CompanyFormDialog } from '@/components/companies/CompanyFormDialog';
import { SegmentCombobox } from '@/components/companies/SegmentCombobox';
import { listCompanies, bulkSetSegment, deleteCompaniesWithoutLeads, type CompanyOverview, type CompanyListFilters } from '@/services/directory';
import { formatCnpj } from '@/lib/cnpj';
import { formatCurrency } from '@/lib/formatCurrency';
import { downloadCSV } from '@/lib/exportCsv';

const PAGE_SIZE = 50;
const SCHEMA = {
  q: 'string', segment_ids: 'array', situation: 'string', assigned_to: 'array', funnel_ids: 'array',
  no_contacts: 'bool', created_from: 'string', created_to: 'string',
} as const;
const fmtDate = (v: string | null) => (v ? format(new Date(v), 'dd/MM/yyyy') : '—');

export default function CompaniesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { organization, isOwner, isAdmin, isViewer } = useOrganization();
  const canManage = isOwner || isAdmin;
  const orgId = organization?.id;
  const st = useUrlListState<CompanyListFilters>(SCHEMA as any, 'trade_name');
  const { filters, sort, dir, page } = st;
  const { data: segments } = useSegments();
  const { data: funnels } = useFunnels();
  const { data: members } = useOrgMembers();
  const [search, setSearch] = useState(filters.q || '');
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [bulkSegment, setBulkSegment] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { document.title = `${organization?.name || 'Org Connect'} — Empresas`; }, [organization?.name]);
  useEffect(() => {
    const t = setTimeout(() => { if ((filters.q || '') !== search) st.setFilter('q', search || undefined); }, 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSelected([]); }, [orgId]);

  const { data, isLoading } = useQuery({
    queryKey: ['companies-list', orgId, filters, sort, dir, page],
    queryFn: () => listCompanies(orgId!, { filters, sort, dir, page, pageSize: PAGE_SIZE }),
    enabled: !!orgId,
    placeholderData: prev => prev,
  });
  const rows = data?.rows || [];
  const [selectedRows, setSelectedRows] = useState<Record<string, CompanyOverview>>({});
  useEffect(() => {
    setSelectedRows(prev => {
      const n: Record<string, CompanyOverview> = {};
      for (const id of selected) n[id] = rows.find(r => r.id === id) || prev[id];
      return n;
    });
  }, [selected, rows]);

  const segOptions = useMemo(() => [
    { value: '__none__', label: 'Sem segmento' },
    ...(segments || []).map(s => ({ value: s.id, label: s.is_active ? s.label : `${s.label} (inativo)` })),
  ], [segments]);

  const columns: Column<CompanyOverview>[] = [
    { key: 'trade_name', label: 'Nome fantasia', sortKey: 'trade_name', fixed: true, render: r => <span className="font-medium">{r.trade_name}</span> },
    { key: 'segment', label: 'Segmento', sortKey: 'segment', render: r => r.segment_label ? <Badge variant="secondary">{r.segment_label}</Badge> : <span className="text-muted-foreground">—</span> },
    { key: 'legal_name', label: 'Razão social', sortKey: 'legal_name', render: r => r.legal_name || '—' },
    { key: 'cnpj', label: 'CNPJ', sortKey: 'cnpj', className: 'whitespace-nowrap', render: r => (r.cnpj ? formatCnpj(r.cnpj) : '—') },
    { key: 'instagram', label: 'Instagram', sortKey: 'instagram', render: r => r.instagram || '—' },
    { key: 'contacts', label: 'Contatos', sortKey: 'contacts_count', className: 'text-right', render: r => r.contacts_count },
    { key: 'leads', label: 'Negócios abertos / total', sortKey: 'open_leads_count', className: 'text-right whitespace-nowrap', render: r => `${r.open_leads_count} / ${r.total_leads_count}` },
    { key: 'open_value', label: 'Valor em aberto', sortKey: 'open_value', className: 'text-right whitespace-nowrap', render: r => formatCurrency(Number(r.open_value) || 0) },
    { key: 'last_activity', label: 'Última atividade', sortKey: 'last_activity_at', className: 'whitespace-nowrap', render: r => fmtDate(r.last_activity_at) },
    { key: 'created_at', label: 'Criada em', sortKey: 'created_at', className: 'whitespace-nowrap', render: r => fmtDate(r.created_at) },
  ];
  const { visible, toggle } = useVisibleColumns('companies-columns', columns.map(c => c.key));

  const exportCsv = async () => {
    if (!orgId) return;
    setExporting(true);
    try {
      const all = await listCompanies(orgId, { filters, sort, dir, page: 0, pageSize: null });
      if (!all.rows.length) { toast.info('Nada para exportar'); return; }
      downloadCSV(all.rows.map(r => ({
        'Nome fantasia': r.trade_name, Segmento: r.segment_label || '', 'Razão social': r.legal_name || '',
        CNPJ: r.cnpj ? formatCnpj(r.cnpj) : '', Instagram: r.instagram || '', Contatos: r.contacts_count,
        'Negócios abertos': r.open_leads_count, 'Negócios total': r.total_leads_count,
        'Valor em aberto': Number(r.open_value) || 0, 'Última atividade': fmtDate(r.last_activity_at), 'Criada em': fmtDate(r.created_at),
      })), `empresas-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    } catch (e: any) { toast.error(e?.message || 'Erro ao exportar'); } finally { setExporting(false); }
  };

  const applySegment = async () => {
    try {
      await bulkSetSegment(selected, bulkSegment);
      toast.success(`Segmento alterado em ${selected.length} empresa(s)`);
      invalidateLeadData(qc); setSegmentOpen(false); setSelected([]);
    } catch (e: any) { toast.error(e?.message || 'Erro ao alterar segmento'); }
  };
  const selRows = selected.map(id => selectedRows[id]).filter(Boolean);
  const withLeads = selRows.filter(r => r.total_leads_count > 0);
  const runDelete = async () => {
    try {
      const r = await deleteCompaniesWithoutLeads(selected);
      toast.success(`${r.deleted} empresa(s) excluída(s)${r.skipped.length ? `; ${r.skipped.length} com negócios mantida(s)` : ''}`);
      invalidateLeadData(qc); setSelected([]);
    } catch (e: any) { toast.error(e?.message || 'Erro ao excluir'); }
    setDeleteOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden h-9 md:inline-flex" onClick={exportCsv} disabled={exporting}>
            <Download className="mr-1.5 h-4 w-4" /> {exporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCsv} disabled={exporting}>
                <Download className="mr-2 h-4 w-4" /> {exporting ? 'Exportando...' : 'Exportar CSV'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {!isViewer && <Button size="sm" className="hidden h-9 md:inline-flex" onClick={() => setCreating(true)}><Plus className="mr-1.5 h-4 w-4" /> Nova empresa</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa, CNPJ ou contato..." className={filterSearchClass} />
        </div>
        {/* Phones: one sideways-scrolling row; from sm up the wrapper dissolves into the wrapping toolbar */}
        <div className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 scrollbar-none sm:contents [&>*]:shrink-0">
          <FilterMultiSelect label="Segmento" options={segOptions} selected={filters.segment_ids || []} onChange={v => st.setFilter('segment_ids', v)} />
          <TriFilter label="Situação" value={filters.situation} onChange={v => st.setFilter('situation', v as any)}
            options={[{ value: 'open', label: 'com negócio aberto' }, { value: 'no_open', label: 'sem negócio aberto' }, { value: 'no_leads', label: 'sem nenhum negócio' }]} />
          <FilterMultiSelect label="Responsável" selected={filters.assigned_to || []} onChange={v => st.setFilter('assigned_to', v)}
            options={(members || []).map((m: any) => ({ value: m.user_id, label: m.profile?.full_name || m.profile?.email || 'Membro' }))} />
          <FilterMultiSelect label="Funil" selected={filters.funnel_ids || []} onChange={v => st.setFilter('funnel_ids', v)}
            options={(funnels || []).map(f => ({ value: f.id, label: f.name }))} />
          <FilterDateRange label="Criada em" from={filters.created_from} to={filters.created_to}
            onChangeFrom={v => st.setFilter('created_from', v)} onChangeTo={v => st.setFilter('created_to', v)} />
          <Button variant="outline" size="sm" aria-pressed={!!filters.no_contacts} className={filterPillClass(!!filters.no_contacts)}
            onClick={() => st.setFilter('no_contacts', filters.no_contacts ? undefined : true)}>
            {filters.no_contacts && <Check className="h-3 w-3" />} Sem contato
          </Button>
          {(st.activeCount > 0 || filters.q) && (
            <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => { setSearch(''); st.clearFilters(); }}><X className="h-3.5 w-3.5" /> Limpar</Button>
          )}
        </div>
        <div className="ml-auto hidden md:block"><ColumnsMenu columns={columns} visible={visible} onToggle={toggle} /></div>
      </div>

      {selected.length > 0 && !isViewer && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm">
          <span className="px-2 font-medium">{selected.length} selecionada(s)</span>
          <Button size="sm" variant="outline" onClick={() => { setBulkSegment(null); setSegmentOpen(true); }}><Tag className="mr-1.5 h-4 w-4" /> Alterar segmento</Button>
          {canManage && selected.length === 2 && (
            <Button size="sm" variant="outline" onClick={() => setMergeOpen(true)}><Merge className="mr-1.5 h-4 w-4" /> Mesclar</Button>
          )}
          {canManage && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-4 w-4" /> Excluir</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Limpar seleção</Button>
        </div>
      )}

      <DataTable
        columns={columns} visible={visible} rows={rows} loading={isLoading} sort={sort} dir={dir} onSort={st.setSort}
        selected={selected} onSelectedChange={isViewer ? undefined : setSelected}
        onRowClick={r => navigate(`/companies/${r.id}`)}
        page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onPage={st.setPage}
        empty="Nenhuma empresa encontrada com esses filtros."
        renderCard={r => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate flex-1">{r.trade_name}</span>
              {r.segment_label && <Badge variant="secondary" className="text-[10px]">{r.segment_label}</Badge>}
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>{r.open_leads_count}/{r.total_leads_count} negócios</span>
              <span>{r.contacts_count} contato(s)</span>
              <span>{formatCurrency(Number(r.open_value) || 0)}</span>
            </div>
          </div>
        )}
      />

      {!isViewer && <MobileFab label="Nova empresa" onClick={() => setCreating(true)} />}

      <CompanyFormDialog open={creating} onOpenChange={setCreating} onCreated={c => navigate(`/companies/${c.id}`)} />
      <MergeCompaniesDialog open={mergeOpen} onOpenChange={setMergeOpen} companies={selRows} onMerged={() => setSelected([])} />

      <Dialog open={segmentOpen} onOpenChange={setSegmentOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Alterar segmento de {selected.length} empresa(s)</DialogTitle></DialogHeader>
          <SegmentCombobox value={bulkSegment} onChange={setBulkSegment} placeholder="Sem segmento" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSegmentOpen(false)}>Cancelar</Button>
            <Button onClick={applySegment}>{bulkSegment ? 'Aplicar' : 'Remover segmento'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresas selecionadas?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Só empresas sem negócios são excluídas, junto com os contatos delas
                  ({selRows.filter(r => !r.total_leads_count).reduce((s, r) => s + r.contacts_count, 0)} contato(s)). Esta ação não pode ser desfeita.</p>
                {withLeads.length > 0 && (
                  <>
                    <p>Ficam de fora por terem negócios:</p>
                    <ul className="list-disc pl-5">{withLeads.map(r => <li key={r.id}>{r.trade_name} ({r.total_leads_count})</li>)}</ul>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={runDelete}
              disabled={withLeads.length === selected.length}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
