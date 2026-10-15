import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { SegmentCombobox } from './SegmentCombobox';
import { useCreateCompany, useSegments } from '@/hooks/useCompanies';
import { useOrganization } from '@/contexts/OrganizationContext';
import { findCompanyByCnpj } from '@/services/companies';
import { isValidCnpj, maskCnpj, onlyDigits } from '@/lib/cnpj';
import { normalizeKey } from '@/lib/leadDisplay';
import type { Company } from '@/types';

export const companySchema = z.object({
  trade_name: z.string().trim().min(1, 'Nome fantasia é obrigatório').max(200),
  legal_name: z.string().trim().max(200).optional(),
  cnpj: z
    .string()
    .optional()
    .refine(v => !onlyDigits(v) || isValidCnpj(v), 'CNPJ inválido'),
  instagram: z.string().trim().max(100).optional(),
  segment_id: z.string().nullable().optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onCreated: (company: Company) => void;
}

export function CompanyFormDialog({ open, onOpenChange, initialName, onCreated }: Props) {
  const { organization } = useOrganization();
  const { data: segments } = useSegments();
  const createCompany = useCreateCompany();
  const [tradeName, setTradeName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [instagram, setInstagram] = useState('');
  const [segment, setSegment] = useState<string | null>(null); // segment id
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Company | null>(null);

  useEffect(() => {
    if (open) {
      setTradeName(initialName || '');
      setLegalName(''); setCnpj(''); setInstagram(''); setSegment(null); setErrors({}); setExisting(null);
    }
  }, [open, initialName]);

  const looksLikeSegment = (segments || []).find(s => s.is_active && normalizeKey(tradeName) && normalizeKey(s.label) === normalizeKey(tradeName));

  useEffect(() => {
    let cancelled = false;
    if (organization && isValidCnpj(cnpj)) {
      findCompanyByCnpj(organization.id, cnpj).then(c => { if (!cancelled) setExisting(c); });
    } else {
      setExisting(null);
    }
    return () => { cancelled = true; };
  }, [cnpj, organization]);

  const handleSave = async () => {
    const parsed = companySchema.safeParse({ trade_name: tradeName, legal_name: legalName, cnpj, instagram, segment_id: segment });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach(i => { errs[String(i.path[0])] = i.message; });
      setErrors(errs);
      return;
    }
    if (existing) {
      toast.error('Já existe uma empresa com esse CNPJ. Use a empresa existente.');
      return;
    }
    try {
      const c = await createCompany.mutateAsync({
        trade_name: tradeName, legal_name: legalName, cnpj, instagram, segment_id: segment,
      });
      onCreated(c);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível criar a empresa');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova empresa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome fantasia *</Label>
            <Input value={tradeName} onChange={e => setTradeName(e.target.value)} placeholder="Nome da empresa" autoFocus />
            {errors.trade_name && <p className="text-xs text-destructive">{errors.trade_name}</p>}
            {looksLikeSegment && (
              <Alert className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs flex items-center justify-between gap-2">
                  <span>Isso parece um segmento, não o nome da empresa.</span>
                  <Button type="button" size="sm" variant="outline" className="h-7"
                    onClick={() => { setSegment(looksLikeSegment.id); setTradeName(''); }}>
                    Usar como segmento
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Segmento</Label>
            <SegmentCombobox value={segment} onChange={setSegment} />
          </div>
          <div className="space-y-1.5">
            <Label>Razão social</Label>
            <Input value={legalName} onChange={e => setLegalName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>CNPJ</Label>
            <Input value={cnpj} onChange={e => setCnpj(maskCnpj(e.target.value))} placeholder="00.000.000/0000-00" inputMode="numeric" />
            {errors.cnpj && <p className="text-xs text-destructive">{errors.cnpj}</p>}
            {existing && (
              <Alert className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs flex items-center justify-between gap-2">
                  <span>Já existe "{existing.trade_name}" com esse CNPJ.</span>
                  <Button type="button" size="sm" variant="outline" className="h-7"
                    onClick={() => { onCreated(existing); onOpenChange(false); }}>
                    Usar existente
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Instagram</Label>
            <Input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@empresa" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={createCompany.isPending}>
            {createCompany.isPending ? 'Salvando...' : 'Criar empresa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
