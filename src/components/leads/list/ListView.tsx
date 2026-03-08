import { useState, useMemo } from 'react';
import { useLeadsList } from '@/hooks/useLeads';
import { useStages } from '@/hooks/useStages';
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
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LeadFilters } from '@/types';

interface ListViewProps {
  funnelId: string;
  filters?: LeadFilters;
}

export function ListView({ funnelId, filters }: ListViewProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('last_activity_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const { data: stages } = useStages(funnelId);
  const { data: result, isLoading } = useLeadsList(funnelId, page, pageSize, sortBy, sortOrder, filters);

  const leads = result?.data || [];
  const totalCount = result?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

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

  return (
    <>
      {selectedIds.length > 0 && (
        <BulkActionsBar
          selectedIds={selectedIds}
          stages={stages || []}
          onClear={() => setSelectedIds([])}
        />
      )}

      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={leads.length > 0 && selectedIds.length === leads.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <SortHeader col="name">Nome</SortHeader>
              <SortHeader col="company">Empresa</SortHeader>
              <TableHead className="hidden md:table-cell">E-mail</TableHead>
              <TableHead className="hidden md:table-cell">Telefone</TableHead>
              <SortHeader col="stage_id">Etapa</SortHeader>
              <TableHead>Responsável</TableHead>
              <SortHeader col="value">Valor</SortHeader>
              <SortHeader col="priority">Prioridade</SortHeader>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Tags</TableHead>
              <SortHeader col="last_activity_at">Última atividade</SortHeader>
              <TableHead className="hidden lg:table-cell">Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                  Nenhum lead encontrado neste funil.
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
                  <TableCell className="font-medium max-w-[160px] truncate">{lead.name}</TableCell>
                  <TableCell className="max-w-[120px] truncate text-muted-foreground">{lead.company || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{lead.email || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{lead.phone || '—'}</TableCell>
                  <TableCell>
                    {lead.stage && (
                      <Badge variant="outline" className="text-xs" style={{ borderColor: lead.stage.color, color: lead.stage.color }}>
                        {lead.stage.name}
                      </Badge>
                    )}
                  </TableCell>
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
                  <TableCell className="text-right whitespace-nowrap">
                    {lead.value > 0
                      ? `R$ ${Number(lead.value).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                      : '—'}
                  </TableCell>
                  <TableCell><PriorityBadge priority={lead.priority} /></TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex gap-1">
                      {(lead.tags || []).slice(0, 2).map((t: string) => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                      ))}
                      {(lead.tags || []).length > 2 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{lead.tags.length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(lead.last_activity_at), { addSuffix: true, locale: ptBR })}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-2">
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
