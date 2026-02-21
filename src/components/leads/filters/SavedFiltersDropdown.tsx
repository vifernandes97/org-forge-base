import { useSavedFilters, useDeleteSavedFilter } from '@/hooks/useSavedFilters';
import { useAuth } from '@/contexts/AuthContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { BookmarkIcon, Share2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
          <BookmarkIcon className="h-3 w-3" />
          Salvos
          {savedFilters && savedFilters.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{savedFilters.length}</Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {isLoading && <DropdownMenuItem disabled>Carregando...</DropdownMenuItem>}
        {savedFilters?.map((sf, idx) => (
          <DropdownMenuItem key={sf.id} className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => onApply(sf.filters)}>
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs truncate">{sf.name}</span>
              {sf.is_shared && <Share2 className="h-3 w-3 text-muted-foreground shrink-0" />}
            </div>
            {sf.user_id === user?.id && (
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={(e) => handleDelete(sf.id, e)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
