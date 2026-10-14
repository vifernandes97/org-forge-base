import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompanyContacts } from '@/hooks/useCompanies';
import { ContactFormDialog } from './ContactFormDialog';

interface Props {
  companyId: string | null;
  selectedIds: string[];
  primaryId: string | null;
  onChange: (selectedIds: string[], primaryId: string | null) => void;
}

/** Pick which company contacts belong to the deal and which one is primary. */
export function ContactsPicker({ companyId, selectedIds, primaryId, onChange }: Props) {
  const { data: contacts, isLoading } = useCompanyContacts(companyId);
  const [creating, setCreating] = useState(false);

  if (!companyId) {
    return <p className="text-sm text-muted-foreground">Escolha a empresa para ver e adicionar contatos.</p>;
  }

  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      const next = [...selectedIds, id];
      onChange(next, primaryId && next.includes(primaryId) ? primaryId : next[0]);
    } else {
      const next = selectedIds.filter(x => x !== id);
      onChange(next, primaryId === id ? next[0] || null : primaryId);
    }
  };

  return (
    <div className="space-y-2">
      {isLoading && <p className="text-sm text-muted-foreground">Carregando contatos...</p>}
      {!isLoading && !contacts?.length && (
        <p className="text-sm text-muted-foreground">Esta empresa ainda não tem contatos.</p>
      )}
      {contacts?.map(c => {
        const checked = selectedIds.includes(c.id);
        const isPrimary = checked && primaryId === c.id;
        return (
          <div key={c.id} className={cn('flex items-center gap-3 rounded-md border px-3 py-2', checked && 'border-primary/40')}>
            <Checkbox checked={checked} onCheckedChange={v => toggle(c.id, !!v)} aria-label={`Incluir ${c.name}`} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{c.name || '(sem nome)'}</div>
              <div className="truncate text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(' · ')}</div>
            </div>
            {checked && (isPrimary ? (
              <Badge variant="secondary" className="text-[10px]">Principal</Badge>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
                onClick={() => onChange(selectedIds, c.id)}>
                <Star className="mr-1 h-3 w-3" /> Tornar principal
              </Button>
            ))}
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}>
        <Plus className="mr-1 h-4 w-4" /> Novo contato
      </Button>
      <ContactFormDialog
        open={creating}
        onOpenChange={setCreating}
        companyId={companyId}
        onSaved={c => {
          const next = [...selectedIds, c.id];
          onChange(next, primaryId && next.includes(primaryId) ? primaryId : next[0]);
        }}
      />
    </div>
  );
}
