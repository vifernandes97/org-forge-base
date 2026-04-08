import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useFunnels } from '@/hooks/useFunnels';
import { useLeadFilters } from '@/hooks/useLeadFilters';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { KanbanView } from '@/components/leads/kanban/KanbanView';
import { ListView } from '@/components/leads/list/ListView';
import { LeadFilterBar } from '@/components/leads/filters/LeadFilterBar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LayoutGrid, List, Contact, Download, Loader2 } from 'lucide-react';
import { getLeadsByFunnel } from '@/services/leads';
import { downloadCSV } from '@/lib/exportCsv';
import { format } from 'date-fns';
import { toast } from 'sonner';

type ViewMode = 'kanban' | 'list';

const LS_VIEW_KEY = 'crm_leads_view_mode';
const LS_FUNNEL_KEY = 'crm_leads_funnel_id';

export default function LeadsPage() {
  const { isOwner, isAdmin, isMember } = useOrganization();
  const { data: funnels, isLoading: funnelsLoading } = useFunnels();
  const canCreate = isOwner || isAdmin || isMember;
  const { filters, searchInput, setFilter, clearFilters, applyFilters, activeFilterCount } = useLeadFilters();

  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem(LS_VIEW_KEY) as ViewMode) || 'kanban'
  );
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>(() =>
    localStorage.getItem(LS_FUNNEL_KEY) || ''
  );
  const [createOpen, setCreateOpen] = useState(false);

  const [exporting, setExporting] = useState(false);

  const currentStatusFilter = filters.status_filter || 'open';

  const handleExportCSV = async () => {
    if (!selectedFunnelId) return;
    setExporting(true);
    try {
      const leads = await getLeadsByFunnel(selectedFunnelId, filters);
      if (!leads.length) {
        toast.info('Nenhum lead encontrado para exportar.');
        return;
      }
      const rows = leads.map(l => ({
        Nome: l.name,
        Email: l.email || '',
        Telefone: l.phone || '',
        Empresa: l.company || '',
        Valor: l.value,
        Prioridade: l.priority,
        'Qualificação': l.qualification ?? '',
        Fonte: l.source || '',
        Tags: (l.tags || []).join('; '),
        Etapa: l.stage?.name || '',
        'Responsável': l.assigned_profile?.full_name || '',
        Status: l.status,
        'Criado em': format(new Date(l.created_at), 'dd/MM/yyyy HH:mm'),
      }));
      downloadCSV(rows, `leads_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      toast.success('CSV exportado com sucesso!');
    } catch {
      toast.error('Erro ao exportar CSV.');
    } finally {
      setExporting(false);
    }
  };
  useEffect(() => { localStorage.setItem(LS_VIEW_KEY, viewMode); }, [viewMode]);
  useEffect(() => {
    if (selectedFunnelId) localStorage.setItem(LS_FUNNEL_KEY, selectedFunnelId);
  }, [selectedFunnelId]);

  // Auto-select default funnel
  useEffect(() => {
    if (!funnels?.length) return;
    const stored = localStorage.getItem(LS_FUNNEL_KEY);
    if (stored && funnels.find(f => f.id === stored)) {
      setSelectedFunnelId(stored);
      return;
    }
    const defaultFunnel = funnels.find(f => f.is_default) || funnels[0];
    setSelectedFunnelId(defaultFunnel.id);
  }, [funnels]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Funnel selector */}
          {!funnelsLoading && funnels && funnels.length > 0 && (
            <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Selecionar funil" />
              </SelectTrigger>
              <SelectContent>
                {funnels.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* View mode toggle */}
          <div className="flex border rounded-md">
            <Toggle
              size="sm"
              pressed={viewMode === 'kanban'}
              onPressedChange={() => setViewMode('kanban')}
              className="rounded-r-none data-[state=on]:bg-accent"
              aria-label="Kanban"
            >
              <LayoutGrid className="h-4 w-4" />
            </Toggle>
            <Toggle
              size="sm"
              pressed={viewMode === 'list'}
              onPressedChange={() => setViewMode('list')}
              className="rounded-l-none data-[state=on]:bg-accent"
              aria-label="Lista"
            >
              <List className="h-4 w-4" />
            </Toggle>
          </div>

          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Lead
            </Button>
          )}
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs value={currentStatusFilter} onValueChange={(v) => setFilter('status_filter', v as 'open' | 'won' | 'archived')}>
        <TabsList>
          <TabsTrigger value="open">Ativos</TabsTrigger>
          <TabsTrigger value="won">Ganhos</TabsTrigger>
          <TabsTrigger value="archived">Arquivados</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filter Bar */}
      {selectedFunnelId && (
        <LeadFilterBar
          funnelId={selectedFunnelId}
          filters={filters}
          searchInput={searchInput}
          activeFilterCount={activeFilterCount}
          setFilter={setFilter}
          clearFilters={clearFilters}
          applyFilters={applyFilters}
        />
      )}

      {/* Content */}
      {selectedFunnelId ? (
        viewMode === 'kanban' ? (
          <KanbanView funnelId={selectedFunnelId} filters={filters} />
        ) : (
          <ListView funnelId={selectedFunnelId} filters={filters} />
        )
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center gap-4">
          <Contact className="h-12 w-12 text-muted-foreground/50" />
          <div className="space-y-1">
            <p className="font-medium">Nenhum funil configurado</p>
            <p className="text-sm text-muted-foreground">
              {funnelsLoading ? 'Carregando funis...' : 'Configure seu primeiro funil para começar a gerenciar seus leads.'}
            </p>
          </div>
          {!funnelsLoading && (
            <Button variant="outline" onClick={() => window.location.href = '/settings/funnels'}>
              Configurar funil
            </Button>
          )}
        </div>
      )}

      <LeadFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
