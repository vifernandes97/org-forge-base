import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useFunnels } from '@/hooks/useFunnels';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { KanbanView } from '@/components/leads/kanban/KanbanView';
import { ListView } from '@/components/leads/list/ListView';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Plus, LayoutGrid, List } from 'lucide-react';

type ViewMode = 'kanban' | 'list';

const LS_VIEW_KEY = 'crm_leads_view_mode';
const LS_FUNNEL_KEY = 'crm_leads_funnel_id';

export default function LeadsPage() {
  const { isOwner, isAdmin, isMember } = useOrganization();
  const { data: funnels, isLoading: funnelsLoading } = useFunnels();
  const canCreate = isOwner || isAdmin || isMember;

  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem(LS_VIEW_KEY) as ViewMode) || 'kanban'
  );
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>(() =>
    localStorage.getItem(LS_FUNNEL_KEY) || ''
  );
  const [createOpen, setCreateOpen] = useState(false);

  // Persist view mode
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

      {/* Content */}
      {selectedFunnelId ? (
        viewMode === 'kanban' ? (
          <KanbanView funnelId={selectedFunnelId} />
        ) : (
          <ListView funnelId={selectedFunnelId} />
        )
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            {funnelsLoading ? 'Carregando funis...' : 'Crie um funil para começar a gerenciar seus leads.'}
          </p>
        </div>
      )}

      <LeadFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
