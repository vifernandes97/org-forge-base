import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreateSavedFilter } from '@/hooks/useSavedFilters';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import type { LeadFilters } from '@/types';
import { toast } from 'sonner';

interface SaveFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: LeadFilters;
}

export function SaveFilterDialog({ open, onOpenChange, filters }: SaveFilterDialogProps) {
  const [name, setName] = useState('');
  const [isShared, setIsShared] = useState(false);
  const { organization } = useOrganization();
  const { user } = useAuth();
  const createFilter = useCreateSavedFilter();

  const handleSave = () => {
    if (!name.trim() || !organization || !user) return;
    createFilter.mutate(
      {
        organization_id: organization.id,
        user_id: user.id,
        name: name.trim(),
        filters,
        is_shared: isShared,
      },
      {
        onSuccess: () => {
          toast.success('Filtro salvo com sucesso');
          setName('');
          setIsShared(false);
          onOpenChange(false);
        },
        onError: () => toast.error('Erro ao salvar filtro'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Salvar filtro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="filter-name" className="text-xs">Nome do filtro</Label>
            <Input
              id="filter-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Leads quentes sem responsável"
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="filter-shared" className="text-xs">Compartilhar com a organização</Label>
            <Switch id="filter-shared" checked={isShared} onCheckedChange={setIsShared} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={!name.trim() || createFilter.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
