import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Building2, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { InlineEditField } from '@/components/leads/InlineEditField';
import { StatusBadge } from '@/components/leads/StatusBadge';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUpdateContact } from '@/hooks/useCompanies';
import { getContactWithLeads } from '@/services/directory';
import { maskPhone } from '@/components/companies/ContactFormDialog';

export function ContactSheet({ contactId, onClose }: { contactId: string | null; onClose: () => void }) {
  const { isViewer } = useOrganization();
  const update = useUpdateContact();
  const [leadId, setLeadId] = useState<string | null>(null);
  const { data: c, isLoading } = useQuery({
    queryKey: ['contact-detail', contactId],
    queryFn: () => getContactWithLeads(contactId!),
    enabled: !!contactId,
  });

  const save = async (field: 'name' | 'email' | 'phone', v: string) => {
    if (field === 'email' && v && !/^\S+@\S+\.\S+$/.test(v.trim())) { toast.error('E-mail inválido'); return; }
    try { await update.mutateAsync({ id: contactId!, input: { [field]: field === 'phone' ? maskPhone(v) : v } as any }); }
    catch (e: any) { toast.error(e?.message || 'Erro ao salvar contato'); }
  };
  const links = (c?.links || []).filter((l: any) => l.lead && !l.lead.merged_into_lead_id);
  const digits = (c?.phone || '').replace(/\D/g, '');

  return (
    <>
      <Sheet open={!!contactId} onOpenChange={o => { if (!o) onClose(); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{c?.name || 'Contato'}</SheetTitle></SheetHeader>
          {isLoading || !c ? (
            <div className="mt-4 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : (
            <div className="mt-4 space-y-4">
              {c.company && (
                <Link to={`/companies/${c.company.id}`} onClick={onClose} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Building2 className="h-4 w-4" /> {c.company.trade_name}
                </Link>
              )}
              {isViewer ? (
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{c.name || '—'}</p>
                  <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{c.email || '—'}</p>
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{c.phone || '—'}</p>
                </div>
              ) : (
                <>
                  <InlineEditField type="text" label="Nome" value={c.name || ''} icon={<User className="h-4 w-4" />} onSave={v => save('name', v)} />
                  <InlineEditField type="text" label="E-mail" value={c.email || ''} icon={<Mail className="h-4 w-4" />} placeholder="Adicionar e-mail..." onSave={v => save('email', v)} />
                  <InlineEditField type="text" label="Telefone" value={c.phone || ''} icon={<Phone className="h-4 w-4" />} placeholder="Adicionar telefone..." onSave={v => save('phone', v)} />
                </>
              )}
              <div className="flex gap-2">
                {c.email && <Button asChild variant="outline" size="sm"><a href={`mailto:${c.email}`}>E-mail</a></Button>}
                {digits && <Button asChild variant="outline" size="sm"><a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></Button>}
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Negócios ({links.length})</p>
                {!links.length && <p className="text-sm text-muted-foreground">Não está em nenhum negócio.</p>}
                {links.map((l: any) => (
                  <button key={l.lead.id} type="button" onClick={() => setLeadId(l.lead.id)}
                    className="w-full rounded-md border p-2 text-left hover:bg-accent/50">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{l.lead.funnel?.name || 'Funil'}</span>
                      {l.is_primary && <Badge variant="secondary" className="text-[10px]">Principal</Badge>}
                      <StatusBadge status={l.lead.archived_at ? 'inactive' : l.lead.status} />
                    </div>
                    {l.lead.stage && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.lead.stage.color }} />{l.lead.stage.name}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <LeadDetailSheet leadId={leadId} onClose={() => setLeadId(null)} />
    </>
  );
}
