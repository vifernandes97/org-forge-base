import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Download, Merge, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSegments, useCompany, invalidateLeadData } from '@/hooks/useCompanies';
import { useUrlListState } from '@/hooks/useUrlListState';
import { DataTable, ColumnsMenu, useVisibleColumns, type Column } from '@/components/directory/DataTable';
import { TriFilter } from '@/components/directory/TriFilter';
import { FilterMultiSelect } from '@/components/leads/filters/FilterMultiSelect';
import { FilterDateRange } from '@/components/leads/filters/FilterDateRange';
import { CompanyCombobox } from '@/components/companies/CompanyCombobox';
import { ContactFormDialog } from '@/components/companies/ContactFormDialog';
import { ContactSheet } from '@/components/contacts/ContactSheet';
import { MergeContactsDialog } from '@/components/contacts/MergeContactsDialog';
import { listContacts, type ContactOverview, type ContactListFilters } from '@/services/directory';
import { deleteContact, getContactLeads } from '@/services/contacts';
import { downloadCSV } from '@/lib/exportCsv';

const PAGE_SIZE = 50;
const SCHEMA = {
  q: 'string', company_id: 'string', segment_ids: 'array', has_email: 'string', has_phone: 'string',
  in_active: 'string', created_from: 'string', created_to: 'string',
} as const;
const YESNO = [{ value: 'yes', label: 'sim' }, { value: 'no', label: 'não' }];
const fmtDate = (v: string | null) => (v ? format(new Date(v), 'dd/MM/yyyy') : '—');

export default function ContactsPage() {
  const qc = useQueryClient();
  const { organization, isOwner, isAdmin, isViewer } = useOrganization();
  const canManage = isOwner || isAdmin;
  const orgId = organization?.id;
  const st = useUrlListState<ContactListFilters>(SCHEMA as any, 'name');
  const { filters, sort, dir, page } = st;
  const openContactId = st.params.get('contact');
  const { data: segments } = useSegments();
  const { data: filterCompany } = useCompany(filters.company_id);
  const [search, setSearch] = useState(filters.q || '');
  const [selected, setSelected] = useState<string[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newCompany, setNewCompany] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; name: string; links: any[] }[] | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { document.title = `${organization?.name || 'CRM'} — Contatos`; }, [organization?.name]);
  useEffect(() => {
    const t = setTimeout(() => { if ((filters.q || '') !== search) st.setFilter('q', search || undefined); }, 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSelected([]); }, [orgId]);

  const { data, isLoading } = useQuery({
    queryKey: ['contacts-list', orgId, filters, sort, dir, page],
    queryFn: () => listContacts(orgId!, { filters, sort, dir, page, pageSize: PAGE_SIZE }),
    enabled: !!orgId,
    placeholderData: prev => prev,
  });
  const rows = data?.rows || [];
  const [selRowsMap, setSelRowsMap] = useState<Record<string, ContactOverview>>({});
  useEffect(() => {
    setSelRowsMap(prev => {
      const n: Record<string, ContactOverview> = {};
      for (const id of selected) n[id] = rows.find(r => r.id === id) || prev[id];
      return n;
    });
  }, [selected, rows]);
  const selRows = selected.map(id => selRowsMap[id]).filter(Boolean);

  const segOptions = useMemo(() => [
    { value: '__none__', label: 'Sem segmento' },
    ...(segments || []).map(s => ({ value: s.id, label: s.is_active ? s.label : `${s.label} (inativo)` })),
  ], [segments]);

  const columns: Column<ContactOverview>[] = [
    { key: 'name', label: 'Nome', sortKey: 'name', fixed: true, render: r => <span className="font-medium">{r.name || '(sem nome)'}</span> },
    {
      key: 'company', label: 'Empresa', sortKey: 'company', render: r => r.company_id
        ? <Link to={`/companies/${r.company_id}`} onClick={e => e.stopPropagation()} className="text-primary hover:underline">{r.company_trade_name}</Link> : '—',
    },
    { key: 'segment', label: 'Segmento da empresa', sortKey: 'segment', render: r => r.segment_label ? <Badge variant="secondary">{r.segment_label}</Badge> : <span className="text-muted-foreground">—</span> },
    { key: 'email', label: 'E-mail', sortKey: 'email', render: r => r.email ? <a href={`mailto:${r.email}`} onClick={e => e.stopPropagation()} className="text-primary hover:underline">{r.email}</a> : '—' },
    {
      key: 'phone', label: 'Telefone', sortKey: 'phone', className: 'whitespace-nowrap', render: r => {
        const d = (r.phone || '').replace(/\D/g, '');
        return d ? <a href={`https://wa.me/${d}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-primary hover:underline">{r.phone}</a> : '—';
      },
    },
    { key: 'leads', label: 'Negócios vinculados', sortKey: 'leads_count', className: 'text-right', render: r => r.leads_count },
    { key: 'primary', label: 'Principal em', sortKey: 'primary_count', className: 'text-right', render: r => r.primary_count },
    { key: 'created_at', label: 'Criado em', sortKey: 'created_at', className: 'whitespace-nowrap', render: r => fmtDate(r.created_at) },
  ];
  const { visible, toggle } = useVisibleColumns('contacts-columns', columns.map(c => c.key));

  const exportCsv = async () => {
    if (!orgId) return;
    setExporting(true);
    try {
      const all = await listContacts(orgId, { filters, sort, dir, page: 0, pageSize: null });
      if (!all.rows.length) { toast.info('Nada para exportar'); return; }
      downloadCSV(all.rows.map(r => ({
        Nome: r.name, Empresa: r.company_trade_name || '', 'Segmento da empresa': r.segment_label || '', 'E-mail': r.email || '',
        Telefone: r.phone || '', 'Negócios vinculados': r.leads_count, 'Principal em': r.primary_count,
        'Em negócio ativo': r.in_active_lead ? 'Sim' : 'Não', 'Criado em': fmtDate(r.created_at),
      })), `contatos-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    } catch (e: any) { toast.error(e?.message || 'Erro ao exportar'); } finally { setExporting(false); }
  };

  const askDelete = async () => {
    try {
      const list = await Promise.all(selRows.map(async r => ({ id: r.id, name: r.name || '(sem nome)', links: await getContactLeads(r.id) })));
      setDeleting(list);
    } catch (e: any) { toast.error(e?.message || 'Erro ao carregar vínculos'); }
  };
  const runDelete = async () => {
    if (!deleting) return;
    try {
      for (const d of deleting) await deleteContact(d.id);
      toast.success(`${deleting.length} contato(s) excluído(s)`);
      invalidateLeadData(qc); setSelected([]);
    } catch (e: any) { toast.error(e?.message || 'Erro ao excluir'); }
    setDeleting(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={exportCsv} disabled={exporting}>
            <Download className="mr-1.5 h-4 w-4" /> {exporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
          {!isViewer && <Button size="sm" className="h-9" onClick={() => { setNewCompany(null); setNewOpen(true); }}><Plus className="mr-1.5 h-4 w-4" /> Novo contato</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nome, e-mail ou telefone..." className="h-9 pl-8" />
        </div>
        <div className="w-full sm:w-56">
          {filters.company_id ? (
            <Button variant="outline" size="sm" className="h-9 w-full justify-between border-primary text-primary" onClick={() => st.setFilter('company_id', undefined)}>
              <span className="truncate">Empresa: {filterCompany?.trade_name || '...'}</span><X className="h-4 w-4" />
            </Button>
          ) : (
            <CompanyCombobox value={null} onChange={c => st.setFilter('company_id', c.id)} placeholder="Empresa" />
          )}
        </div>
        <FilterMultiSelect label="Segmento" options={segOptions} selected={filters.segment_ids || []} onChange={v => st.setFilter('segment_ids', v)} />
        <TriFilter label="Com e-mail" value={filters.has_email} options={YESNO} onChange={v => st.setFilter('has_email', v as any)} />
        <TriFilter label="Com telefone" value={filters.has_phone} options={YESNO} onChange={v => st.setFilter('has_phone', v as any)} />
        <TriFilter label="Em negócio ativo" value={filters.in_active} options={YESNO} onChange={v => st.setFilter('in_active', v as any)} />
        <FilterDateRange label="Criado em" from={filters.created_from} to={filters.created_to}
          onChangeFrom={v => st.setFilter('created_from', v)} onChangeTo={v => st.setFilter('created_to', v)} />
        {(st.activeCount > 0 || filters.q) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); st.clearFilters(); }}><X className="mr-1 h-4 w-4" /> Limpar</Button>
        )}
        <div className="ml-auto"><ColumnsMenu columns={columns} visible={visible} onToggle={toggle} /></div>
      </div>

      {selected.length > 0 && canManage && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm">
          <span className="px-2 font-medium">{selected.length} selecionado(s)</span>
          {selected.length === 2 && (
            <Button size="sm" variant="outline" onClick={() => setMergeOpen(true)}><Merge className="mr-1.5 h-4 w-4" /> Mesclar</Button>
          )}
          <Button size="sm" variant="outline" className="text-destructive" onClick={askDelete}><Trash2 className="mr-1.5 h-4 w-4" /> Excluir</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Limpar seleção</Button>
        </div>
      )}

      <DataTable
        columns={columns} visible={visible} rows={rows} loading={isLoading} sort={sort} dir={dir} onSort={st.setSort}
        selected={selected} onSelectedChange={canManage ? setSelected : undefined}
        onRowClick={r => st.setParam('contact', r.id)}
        page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onPage={st.setPage}
        empty="Nenhum contato encontrado com esses filtros."
        renderCard={r => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate flex-1">{r.name || '(sem nome)'}</span>
              <span className="text-xs text-muted-foreground">{r.leads_count} negócio(s)</span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{r.company_trade_name || '—'}{r.segment_label ? ` · ${r.segment_label}` : ''}</p>
            <p className="text-xs text-muted-foreground truncate">{[r.email, r.phone].filter(Boolean).join(' · ')}</p>
          </div>
        )}
      />

      <ContactSheet contactId={openContactId} onClose={() => st.setParam('contact', null)} />
      <MergeContactsDialog open={mergeOpen} onOpenChange={setMergeOpen} contacts={selRows} onMerged={() => setSelected([])} />

      {/* Novo contato: escolher a empresa (obrigatória) */}
      <Dialog open={newOpen && !newCompany} onOpenChange={o => { if (!o) setNewOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo contato: escolha a empresa</DialogTitle></DialogHeader>
          <CompanyCombobox value={null} onChange={c => setNewCompany(c.id)} />
        </DialogContent>
      </Dialog>
      {newCompany && (
        <ContactFormDialog open={newOpen} onOpenChange={o => { setNewOpen(o); if (!o) setNewCompany(null); }} companyId={newCompany}
          onSaved={c => { setNewOpen(false); setNewCompany(null); invalidateLeadData(qc); st.setParam('contact', c.id); }} />
      )}

      <AlertDialog open={!!deleting} onOpenChange={o => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleting?.length} contato(s)?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
                {deleting?.map(d => (
                  <div key={d.id}>
                    <p className="font-medium text-foreground">{d.name}</p>
                    {d.links.length ? (
                      <ul className="list-disc pl-5">
                        {d.links.map(l => (
                          <li key={l.lead_id}>{l.lead?.company?.trade_name || 'Negócio'}{l.lead?.stage?.name ? ` · ${l.lead.stage.name}` : ''}{l.is_primary ? ' (principal)' : ''}</li>
                        ))}
                      </ul>
                    ) : <p>Sem negócios vinculados.</p>}
                  </div>
                ))}
                <p>Onde o contato é o principal, o próximo contato vinculado passa a ser o principal. Esta ação não pode ser desfeita.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={runDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
