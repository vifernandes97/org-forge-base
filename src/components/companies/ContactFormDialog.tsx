import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useCreateContact, useUpdateContact } from '@/hooks/useCompanies';
import type { Contact } from '@/types';

const schema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(200),
  email: z.string().trim().email('E-mail inválido').max(255).or(z.literal('')),
  phone: z.string().trim().max(30),
});

export function maskPhone(raw: string) {
  let v = raw.replace(/\D/g, '').slice(0, 13);
  if (v.length > 11) return v; // international / with country code: keep digits
  if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
  else if (v.length > 0) v = `(${v}`;
  return v;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  contact?: Contact | null;
  onSaved?: (contact: Contact) => void;
}

export function ContactFormDialog({ open, onOpenChange, companyId, contact, onSaved }: Props) {
  const create = useCreateContact();
  const update = useUpdateContact();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(contact?.name || ''); setEmail(contact?.email || ''); setPhone(contact?.phone || ''); setErrors({});
    }
  }, [open, contact]);

  const save = async () => {
    const parsed = schema.safeParse({ name, email, phone });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach(i => { errs[String(i.path[0])] = i.message; });
      setErrors(errs);
      return;
    }
    try {
      const saved = contact
        ? await update.mutateAsync({ id: contact.id, input: { name, email, phone } })
        : await create.mutateAsync({ companyId, input: { name, email, phone } });
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível salvar o contato');
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{contact ? 'Editar contato' : 'Novo contato'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={phone} onChange={e => setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={pending}>{pending ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
