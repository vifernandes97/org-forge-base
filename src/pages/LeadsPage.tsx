import { useState, useEffect, useMemo } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useFunnels } from '@/hooks/useFunnels';
import { useLeadFilters } from '@/hooks/useLeadFilters';
import { useLeadsByFunnel } from '@/hooks/useLeads';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { KanbanView } from '@/components/leads/kanban/KanbanView';
import { ListView } from '@/components/leads/list/ListView';
import { LeadFilterBar } from '@/components/leads/filters/LeadFilterBar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Loader2,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
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
  const { filters, searchInput, setFilter, clearFilters, applyFilters, applyMany, activeFilterCount } = useLeadFilters();

  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem(LS_VIEW_KEY) as ViewMode) || 'kanban'
  );
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>(() =>
    localStorage.getItem(LS_FUNNEL_KEY) || ''
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const currentStatusFilter = filters.status_filter || 'open';

  // Status counts (independent of status_filter to populate tabs)
  const filtersForCount = useMemo(() => {
    const { status_filter, ...rest } = filters;
    return rest;
  }, [filters]);
  const { data: allLeadsForCount } = useLeadsByFunnel(selectedFunnelId, filtersForCount);

  const statusCounts = useMemo(() => {
    const counts = { open: 0, won: 0, archived: 0 };
    (allLeadsForCount || []).forEach((l: any) => {
      if (l.archived_at) counts.archived++;
      else if (l.status === 'won') counts.won++;
      else counts.open++;
    });
    return counts;
  }, [allLeadsForCount]);

  const totalCount = statusCounts[currentStatusFilter as keyof typeof statusCounts] ?? 0;

  const handleExportCSV = async () => {
    if (!selectedFunnelId) return;
    setExporting(true);
    try {
      const leads = await getLeadsByFunnel(selectedFunnelId, filters);
      if (!leads.length) {
        toast.info('Nenhum negócio encontrado para exportar.');
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
      downloadCSV(rows, `negocios_${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Title + funnel breadcrumb + counter */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Negócios</h1>
            {selectedFunnelId && (
              <span className="text-sm text-muted-foreground">·&nbsp;{totalCount}</span>
            )}
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

        {/* Status Tabs - editorial style */}
        <Tabs
          value={currentStatusFilter}
          onValueChange={(v) => setFilter('status_filter', v as 'open' | 'won' | 'archived')}
        >
          <TabsList className="h-auto bg-transparent p-0 gap-6 border-b border-border rounded-none w-full justify-start">
            {[
              { value: 'open', label: 'Ativos', count: statusCounts.open },
              { value: 'won', label: 'Ganhos', count: statusCounts.won },
              { value: 'archived', label: 'Arquivados', count: statusCounts.archived },
            ].map(t => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="relative h-auto px-0 pb-2.5 pt-1 rounded-none bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-medium data-[state=active]:text-foreground text-muted-foreground after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:bg-primary after:opacity-0 data-[state=active]:after:opacity-100 transition-colors"
              >
                <span>{t.label}</span>
                <span className="ml-1.5 text-xs text-muted-foreground/80 tabular-nums">
                  {t.count}
                </span>
              </TabsTrigger>
            ))}
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
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center gap-4">
            <Contact className="h-12 w-12 text-muted-foreground/50" />
            <div className="space-y-1">
              <p className="font-medium">Nenhum funil configurado</p>
              <p className="text-sm text-muted-foreground">
                {funnelsLoading ? 'Carregando funis...' : 'Configure seu primeiro funil para começar a gerenciar seus negócios.'}
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
    </TooltipProvider>
  );
}
