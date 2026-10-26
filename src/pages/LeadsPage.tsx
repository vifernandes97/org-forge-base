import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useFunnels } from '@/hooks/useFunnels';
import { useLeadFilters } from '@/hooks/useLeadFilters';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { KanbanView } from '@/components/leads/kanban/KanbanView';
import { ListView } from '@/components/leads/list/ListView';
import { LeadFilterBar } from '@/components/leads/filters/LeadFilterBar';
import { ArchivedSummaryPanel } from '@/components/leads/ArchivedSummaryPanel';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus,
  LayoutGrid,
  List,
  Contact,
  Download,
  Upload,
  Loader2,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
import { ImportLeadsDialog } from '@/components/leads/import/ImportLeadsDialog';
import { getLeadsForExport, getCustomFieldValuesForLeads } from '@/services/leads';
import { getActivitiesForLeads } from '@/services/activities';
import { useStages } from '@/hooks/useStages';
import { useCustomFields } from '@/hooks/useCustomFields';
import { applyClientFilters, buildCustomFieldValueMap } from '@/lib/leadClientFilters';
import { buildActivityRows, buildLeadRows } from '@/lib/leadsExport';
import { downloadCSV } from '@/lib/exportCsv';
import { format } from 'date-fns';
import { toast } from 'sonner';

type ViewMode = 'kanban' | 'list';

const LS_VIEW_KEY = 'crm_leads_view_mode';
const funnelKey = (orgId: string) => `crm_leads_funnel_id:${orgId}`;

export default function LeadsPage() {
  const { isOwner, isAdmin, isMember, organization } = useOrganization();
  const orgId = organization?.id;
  const { data: funnels, isLoading: funnelsLoading } = useFunnels();
  const canCreate = isOwner || isAdmin || isMember;
  const { filters, searchInput, setFilter, clearFilters, applyFilters, applyMany, activeFilterCount } = useLeadFilters();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(LS_VIEW_KEY) as ViewMode | null;
    if (stored) return stored;
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      return 'list';
    }
    return 'kanban';
  });

  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const showArchivedSummary = (filters.status_filters || ['open']).includes('archived');

  const { data: exportStages } = useStages(selectedFunnelId);
  const { data: customFieldDefs } = useCustomFields();

  const handleExportCSV = async () => {
    if (!selectedFunnelId) return;
    setExporting(true);
    try {
      const allLeads = await getLeadsForExport(selectedFunnelId, filters, orgId);
      const cfRows = await getCustomFieldValuesForLeads(allLeads.map(l => l.id));
      const cfMap = buildCustomFieldValueMap(cfRows as any);
      const leads = applyClientFilters(allLeads, filters, exportStages || [], cfMap);

      if (!leads.length) {
        toast.info('Nenhum negócio encontrado para exportar.');
        return;
      }

      const activities = await getActivitiesForLeads(leads.map(l => l.id));
      const activitiesByLead: Record<string, any[]> = {};
      activities.forEach(a => {
        if (!activitiesByLead[a.lead_id]) activitiesByLead[a.lead_id] = [];
        activitiesByLead[a.lead_id].push(a);
      });

      const activeCustomFields = (customFieldDefs || []).filter(f => f.is_active);
      const funnelName = (funnels || []).find(f => f.id === selectedFunnelId)?.name || 'funil';
      const slug = funnelName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const stamp = format(new Date(), 'yyyy-MM-dd');

      downloadCSV(
        buildLeadRows(leads, activitiesByLead, activeCustomFields, cfMap),
        `negocios_${slug}_${stamp}.csv`
      );

      const activityRows = buildActivityRows(leads, activities);
      if (activityRows.length) {
        downloadCSV(activityRows, `negocios_historico_${slug}_${stamp}.csv`);
      }

      toast.success(
        `${leads.length} negócio(s) e ${activityRows.length} registro(s) de histórico exportados.`
      );
    } catch {
      toast.error('Erro ao exportar CSV.');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => { localStorage.setItem(LS_VIEW_KEY, viewMode); }, [viewMode]);
  useEffect(() => {
    if (orgId && selectedFunnelId) localStorage.setItem(funnelKey(orgId), selectedFunnelId);
  }, [orgId, selectedFunnelId]);

  // Clear selection immediately when switching companies
  useEffect(() => { setSelectedFunnelId(''); }, [orgId]);

  // Auto-select funnel of the active organization
  useEffect(() => {
    if (!orgId || !funnels?.length) return;
    const stored = localStorage.getItem(funnelKey(orgId));
    if (stored && funnels.find(f => f.id === stored)) {
      setSelectedFunnelId(stored);
      return;
    }
    const defaultFunnel = funnels.find(f => f.is_default) || funnels[0];
    setSelectedFunnelId(defaultFunnel.id);
  }, [funnels, orgId]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4 min-w-0 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Title + funnel breadcrumb + counter */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Negócios</h1>
            {!funnelsLoading && funnels && funnels.length > 0 && (
              <>
                <span className="text-muted-foreground/50 mx-1">/</span>
                <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
                  <SelectTrigger
                    className="h-8 border-0 bg-transparent hover:bg-muted/60 px-2 text-sm font-medium gap-1 w-auto focus:ring-0 focus:ring-offset-0 [&>svg]:hidden"
                  >
                    <SelectValue placeholder="Selecionar funil" />
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {funnels.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as ViewMode)}
              className="bg-muted/60 rounded-md p-0.5 gap-0"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem
                    value="kanban"
                    size="sm"
                    aria-label="Kanban"
                    className="h-7 w-7 p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Kanban</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem
                    value="list"
                    size="sm"
                    aria-label="Lista"
                    className="h-7 w-7 p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
                  >
                    <List className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Lista</TooltipContent>
              </Tooltip>
            </ToggleGroup>

            {selectedFunnelId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mais ações">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCSV} disabled={exporting}>
                    {exporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Exportar CSV
                  </DropdownMenuItem>
                  {canCreate && (
                    <DropdownMenuItem onClick={() => setImportOpen(true)}>
                      <Upload className="mr-2 h-4 w-4" />
                      Importar planilha
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {canCreate && (
              <Button onClick={() => setCreateOpen(true)} size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Novo Negócio
              </Button>
            )}
          </div>
        </div>

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
            applyMany={applyMany}
          />
        )}

        {/* Archived summary */}
        {selectedFunnelId && showArchivedSummary && (
          <ArchivedSummaryPanel
            funnelId={selectedFunnelId}
            filters={filters}
            applyMany={applyMany}
          />
        )}

        {/* Content */}
        {selectedFunnelId ? (
          viewMode === 'kanban' ? (
            <KanbanView funnelId={selectedFunnelId} filters={filters} />
          ) : (
            <ListView funnelId={selectedFunnelId} filters={filters} />
          )
        ) : funnelsLoading || (funnels && funnels.length > 0) ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center gap-4">
            <Contact className="h-12 w-12 text-muted-foreground/50" />
            <div className="space-y-1">
              <p className="font-medium">Nenhum funil configurado</p>
              <p className="text-sm text-muted-foreground">
                Configure seu primeiro funil para começar a gerenciar seus negócios.
              </p>
            </div>
            {(
              <Button variant="outline" onClick={() => window.location.href = '/settings?tab=funnels'}>
                Configurar funil
              </Button>
            )}
          </div>
        )}

        <LeadFormDialog open={createOpen} onOpenChange={setCreateOpen} defaultFunnelId={selectedFunnelId} />
        <ImportLeadsDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          defaultFunnelId={selectedFunnelId}
        />
      </div>
    </TooltipProvider>
  );
}
