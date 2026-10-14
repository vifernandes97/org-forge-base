import { getLeadDisplay } from '@/lib/leadDisplay';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Merge, Search } from 'lucide-react';
import { getLeadsByIds, searchLeadsForMerge } from '@/services/leads';
import { useMergeLeads } from '@/hooks/useLeads';
import { useOrganization } from '@/contexts/OrganizationContext';
import { formatCurrency } from '@/lib/formatCurrency';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface MergeLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ids pré-selecionados (visão em lista) */
  leadIds?: string[];
  /** Quando aberto pelo detalhe do negócio: id do negócio atual */
  baseLeadId?: string;
  onMerged?: (primaryId: string) => void;
}

function leadLabel(l: any) {
  const d = getLeadDisplay(l);
  return d.primaryContact?.name && d.primaryContact.name !== d.title ? `${d.title} · ${d.primaryContact.name}` : d.title;
}

export function MergeLeadsDialog({
  open,
  onOpenChange,
  leadIds,
  baseLeadId,
  onMerged,
}: MergeLeadsDialogProps) {
  const { organization } = useOrganization();
  const merge = useMergeLeads();
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const initial = leadIds?.length ? leadIds : baseLeadId ? [baseLeadId] : [];
    setPickedIds(initial);
    setPrimaryId(baseLeadId || initial[0] || '');
    setSearch('');
  }, [open, leadIds, baseLeadId]);

  const { data: leads, isLoading } = useQuery({
    queryKey: ['merge-leads-detail', pickedIds],
    queryFn: () => getLeadsByIds(pickedIds),
    enabled: open && pickedIds.length > 0,
  });

  const needsSearch = pickedIds.length < 2;

  const { data: results, isFetching: searching } = useQuery({
    queryKey: ['merge-leads-search', organization?.id, debounced, baseLeadId],
    queryFn: () => searchLeadsForMerge(organization!.id, debounced, baseLeadId || ''),
    enabled: open && needsSearch && !!organization?.id && debounced.trim().length >= 2,
  });

  const handleMerge = async () => {
    const duplicates = pickedIds.filter(id => id !== primaryId);
    if (!primaryId || duplicates.length === 0) return;
    try {
      await merge.mutateAsync({ primaryId, duplicateIds: duplicates });
      toast.success(
        duplicates.length === 1
          ? 'Negócios mesclados com sucesso'
          : `${duplicates.length} negócios mesclados com sucesso`
      );
      onOpenChange(false);
      onMerged?.(primaryId);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao mesclar negócios');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mesclar negócios</DialogTitle>
          <DialogDescription>
            Escolha o negócio principal. Os demais serão arquivados como duplicados, e suas
            tarefas, histórico e dados em branco serão transferidos para o principal.
          </DialogDescription>
        </DialogHeader>

        {needsSearch && (
          <div className="space-y-2">
            <Label>Buscar negócio duplicado</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Nome, empresa, e-mail ou telefone"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {debounced.trim().length >= 2 && (
              <ScrollArea className="h-40 rounded-md border">
                <div className="p-1">
                  {searching && <p className="p-2 text-sm text-muted-foreground">Buscando...</p>}
                  {!searching && !results?.length && (
                    <p className="p-2 text-sm text-muted-foreground">Nenhum negócio encontrado.</p>
                  )}
                  {results?.map((r: any) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setPickedIds(prev => (prev.includes(r.id) ? prev : [...prev, r.id]));
                        setSearch('');
                      }}
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="font-medium">{leadLabel(r)}</span>
                      {r.name && r.name !== leadLabel(r) && (
                        <span className="text-muted-foreground"> · {r.name}</span>
                      )}
                      {r.stage?.name && (
                        <span className="block text-xs text-muted-foreground">{r.stage.name}</span>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Negócio principal</Label>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <RadioGroup value={primaryId} onValueChange={setPrimaryId} className="gap-2">
              {leads?.map((l: any) => (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                >
                  <RadioGroupItem value={l.id} className="mt-0.5" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{leadLabel(l)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[getLeadDisplay(l).segment, getLeadDisplay(l).primaryContact?.email, getLeadDisplay(l).primaryContact?.phone].filter(Boolean).join(' · ') || 'Sem contato'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {l.stage?.name ? `${l.stage.name} · ` : ''}
                      {formatCurrency(l.value || 0)} ·{' '}
                      {format(new Date(l.created_at), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          )}
          {pickedIds.length >= 2 && (
            <p className="text-xs text-muted-foreground">
              {pickedIds.length - 1} negócio(s) será(ão) arquivado(s) como duplicado.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleMerge}
            disabled={pickedIds.length < 2 || !primaryId || merge.isPending}
          >
            {merge.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Merge className="mr-1.5 h-4 w-4" />
            )}
            Mesclar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
