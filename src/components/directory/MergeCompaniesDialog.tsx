import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useMergeCompanies } from '@/hooks/useCompanies';
import { CompanyCombobox } from '@/components/companies/CompanyCombobox';

interface Item { id: string; trade_name: string; cnpj?: string | null; total_leads_count?: number; contacts_count?: number }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Two companies preselected (from the list), or one (from the detail: the other is chosen here). */
  companies: Item[];
  onMerged?: (keptId: string) => void;
}

export function MergeCompaniesDialog({ open, onOpenChange, companies, onMerged }: Props) {
  const merge = useMergeCompanies();
  const [other, setOther] = useState<Item | null>(null);
  const [keep, setKeep] = useState<string>('');
  const pair = companies.length >= 2 ? companies.slice(0, 2) : other && companies[0] ? [companies[0], other] : companies;

  useEffect(() => { if (open) { setOther(null); setKeep(companies[0]?.id || ''); } }, [open, companies]);

  const run = async () => {
    const source = pair.find(c => c.id !== keep);
    if (!source || !keep) return;
    try {
      const r = await merge.mutateAsync({ targetId: keep, sourceId: source.id });
      toast.success(`Empresas mescladas: ${r.leads_moved} negócio(s) e ${r.contacts_moved + r.contacts_merged} contato(s) movidos`);
      onOpenChange(false);
      onMerged?.(keep);
    } catch (e: any) { toast.error(e?.message || 'Erro ao mesclar empresas'); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mesclar empresas</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          {companies.length < 2 && (
            <CompanyCombobox value={other?.id || null} excludeId={companies[0]?.id} onChange={c => setOther(c as any)} placeholder="Empresa a mesclar" />
          )}
          {pair.length === 2 && (
            <>
              <p className="text-muted-foreground">Escolha a empresa que fica. A outra é absorvida e excluída.</p>
              <RadioGroup value={keep} onValueChange={setKeep}>
                {pair.map(c => (
                  <div key={c.id} className="flex items-center gap-2 rounded-md border p-2">
                    <RadioGroupItem value={c.id} id={`keep-${c.id}`} />
                    <Label htmlFor={`keep-${c.id}`} className="flex-1 cursor-pointer font-normal">
                      <span className="font-medium">{c.trade_name}</span>
                      {c.total_leads_count != null && <span className="text-muted-foreground"> · {c.total_leads_count} negócio(s), {c.contacts_count} contato(s)</span>}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">Negócios e contatos passam para a que fica; contatos repetidos são unidos e campos vazios são preenchidos. CNPJs diferentes impedem a mesclagem.</p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={run} disabled={pair.length !== 2 || !keep || merge.isPending}>{merge.isPending ? 'Mesclando...' : 'Mesclar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
