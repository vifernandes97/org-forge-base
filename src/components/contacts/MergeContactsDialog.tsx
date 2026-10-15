import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { mergeContacts, type ContactOverview } from '@/services/directory';
import { invalidateLeadData } from '@/hooks/useCompanies';

export function MergeContactsDialog({ open, onOpenChange, contacts, onMerged }: {
  open: boolean; onOpenChange: (o: boolean) => void; contacts: ContactOverview[]; onMerged?: () => void;
}) {
  const qc = useQueryClient();
  const [keep, setKeep] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setKeep(contacts[0]?.id || ''); }, [open, contacts]);
  const sameCompany = contacts.length === 2 && contacts[0].company_id === contacts[1].company_id;

  const run = async () => {
    const remove = contacts.find(c => c.id !== keep);
    if (!remove) return;
    setBusy(true);
    try {
      const r = await mergeContacts(keep, remove.id);
      toast.success(`Contatos mesclados: ${r.moved + r.deduplicated} vínculo(s) com negócios ajustado(s)`);
      invalidateLeadData(qc); onOpenChange(false); onMerged?.();
    } catch (e: any) { toast.error(e?.message || 'Erro ao mesclar contatos'); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mesclar contatos</DialogTitle></DialogHeader>
        {!sameCompany ? (
          <p className="text-sm text-muted-foreground">Selecione exatamente 2 contatos da mesma empresa.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Escolha o contato que fica. O outro é excluído depois de passar os negócios e os dados que faltam.</p>
            <RadioGroup value={keep} onValueChange={setKeep}>
              {contacts.map(c => (
                <div key={c.id} className="flex items-center gap-2 rounded-md border p-2">
                  <RadioGroupItem value={c.id} id={`keepc-${c.id}`} />
                  <Label htmlFor={`keepc-${c.id}`} className="flex-1 cursor-pointer font-normal">
                    <span className="font-medium">{c.name || '(sem nome)'}</span>
                    <span className="block text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(' · ') || 'sem e-mail e telefone'} · {c.leads_count} negócio(s)</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">Vínculos repetidos são unidos; onde o excluído era principal, o que fica passa a ser.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={run} disabled={!sameCompany || !keep || busy}>{busy ? 'Mesclando...' : 'Mesclar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
