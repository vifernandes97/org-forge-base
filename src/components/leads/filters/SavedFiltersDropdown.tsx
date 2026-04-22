import { useSavedFilters, useDeleteSavedFilter } from '@/hooks/useSavedFilters';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Star, Share2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LeadFilters } from '@/types';
import { toast } from 'sonner';

interface SavedFiltersDropdownProps {
  onApply: (filters: LeadFilters) => void;
}

export function SavedFiltersDropdown({ onApply }: SavedFiltersDropdownProps) {
  const { data: savedFilters, isLoading } = useSavedFilters();
  const deleteFilter = useDeleteSavedFilter();
  const { user } = useAuth();

  if (!savedFilters?.length && !isLoading) return null;

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteFilter.mutate(id, {
      onSuccess: () => toast.success('Filtro removido'),
      onError: () => toast.error('Erro ao remover filtro'),
    });
  };

  const hasFilters = savedFilters && savedFilters.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-9 w-9 rounded-full',
            hasFilters && 'text-primary hover:text-primary',
          )}
          aria-label="Filtros salvos"
          title="Filtros salvos"
        >
          <Star className={cn('h-4 w-4', hasFilters && 'fill-current')} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Filtros salvos
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading && <DropdownMenuItem disabled>Carregando...</DropdownMenuItem>}
        {savedFilters?.map((sf) => (
          <DropdownMenuItem
            key={sf.id}
            className="flex items-center justify-between gap-2 cursor-pointer"
            onClick={() => onApply(sf.filters)}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs truncate">{sf.name}</span>
              {sf.is_shared && (
                <Share2 className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
            </div>
            {sf.user_id === user?.id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={(e) => handleDelete(sf.id, e)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
