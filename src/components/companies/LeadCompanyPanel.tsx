import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, FileBadge, Hash, Instagram, Mail, MoreHorizontal, Plus, Star, Tag, Trash2, Pencil, Unlink, ArrowLeftRight, Merge, Phone, Users, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { InlineEditField } from '@/components/leads/InlineEditField';
import { CompanyCombobox } from './CompanyCombobox';
import { CompanyFormDialog } from './CompanyFormDialog';
import { ContactFormDialog } from './ContactFormDialog';
import { SegmentCombobox } from './SegmentCombobox';
import { StatusBadge } from '@/components/leads/StatusBadge';
import { DetailSection } from '@/components/leads/DetailSection';
import { cn } from '@/lib/utils';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useCompany, useCompanyCounts, useUpdateCompany, useMergeCompanies, useChangeLeadCompany,
  useLinkContact, useUnlinkContact, useSetPrimaryContact, useDeleteContact,
} from '@/hooks/useCompanies';
import { getContactLeads } from '@/services/contacts';
import { formatCnpj, isValidCnpj, maskCnpj, onlyDigits } from '@/lib/cnpj';
import { getLeadContacts } from '@/lib/leadDisplay';
import type { Company, Contact, LeadWithRelations } from '@/types';

const WhatsIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
);

interface Props {
  lead: LeadWithRelations;
  readOnly?: boolean;
  onOpenLead?: (leadId: string) => void;
  /** Root class; pass `contents` to lay the section cards out in the parent's grid. */
  className?: string;
}

export function LeadCompanyPanel({ lead, readOnly, onOpenLead, className }: Props) {
  const { isOwner, isAdmin } = useOrganization() as any;
  const companyId = lead.company_id;
  const { data: company } = useCompany(companyId);
  const updateCompany = useUpdateCompany();
  const changeCompany = useChangeLeadCompany();
  const mergeCompanies = useMergeCompanies();
  const linkContact = useLinkContact();
  const unlinkContact = useUnlinkContact();
  const setPrimary = useSetPrimaryContact();
  const deleteContact = useDeleteContact();

  const [changeTarget, setChangeTarget] = useState<Company | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<Company | null>(null);
  const { data: sourceCounts } = useCompanyCounts(mergeSource?.id);
  const [contactDialog, setContactDialog] = useState<{ open: boolean; contact: Contact | null }>({ open: false, contact: null });
  const [deleting, setDeleting] = useState<{ contact: Contact; links: any[] } | null>(null);

  const links = getLeadContacts(lead);
  const linkedIds = new Set(links.map(l => l.contact!.id));
  const companyContacts: Contact[] = company?.contacts || [];
  const unlinked = companyContacts.filter(c => !linkedIds.has(c.id));
  const otherLeads = useMemo(() => (company?.leads || []).filter((l: any) => l.id !== lead.id), [company, lead.id]);
  const leadsCount = (company?.leads || []).length;

  const saveCompany = async (field: keyof Company, value: string | null) => {
    if (!companyId) return;
    if (field === 'trade_name' && !value?.trim()) { toast.error('Nome fantasia é obrigatório'); return; }
    if (field === 'cnpj' && onlyDigits(value) && !isValidCnpj(value)) { toast.error('CNPJ inválido'); return; }
    try {
      await updateCompany.mutateAsync({ id: companyId, input: { [field]: value } as any });
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar empresa');
    }
  };

  const confirmChange = async () => {
    if (!changeTarget) return;
    try {
      await changeCompany.mutateAsync({ leadId: lead.id, companyId: changeTarget.id });
      toast.success(`Empresa alterada para ${changeTarget.trade_name}`);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao trocar empresa');
    }
    setChangeTarget(null);
  };

  const confirmMerge = async () => {
    if (!mergeSource || !companyId) return;
    try {
      const r = await mergeCompanies.mutateAsync({ targetId: companyId, sourceId: mergeSource.id });
      toast.success(`Empresas mescladas: ${r.leads_moved} negócio(s) e ${r.contacts_moved + r.contacts_merged} contato(s) movidos`);
      setMergeOpen(false);
      setMergeSource(null);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao mesclar empresas');
    }
  };

  const askDelete = async (contact: Contact) => {
    try {
      const l = await getContactLeads(contact.id);
      setDeleting({ contact, links: l });
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao carregar vínculos do contato');
    }
  };

  const run = async (p: Promise<any>, ok?: string) => {
    try { await p; if (ok) toast.success(ok); } catch (err: any) { toast.error(err?.message || 'Erro'); }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Empresa */}
      <DetailSection
        title="Empresa"
        icon={<Building2 className="h-3.5 w-3.5" />}
        action={!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ações da empresa">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setChangeOpen(true)}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" /> Trocar empresa
                </DropdownMenuItem>
                {(isOwner || isAdmin) && company && (
                  <DropdownMenuItem onClick={() => setMergeOpen(true)}>
                    <Merge className="mr-2 h-4 w-4" /> Mesclar com outra empresa
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
        )}
      >
        {!company ? (
          <p className="text-sm text-muted-foreground">Sem empresa.</p>
        ) : (
          <>
            <InlineEditField type="text" label="Nome fantasia" value={company.trade_name}
              icon={<Building2 className="h-4 w-4" />} onSave={v => saveCompany('trade_name', v)} />
            <div className="flex items-center gap-3 text-sm">
              <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">Segmento</span>
              <div className="flex-1 min-w-0">
                {readOnly ? <span>{company.segment_ref?.label || '—'}{company.segment_ref && !company.segment_ref.is_active ? ' (inativo)' : ''}</span> : (
                  <SegmentCombobox compact value={company.segment_id} current={company.segment_ref} onChange={v => saveCompany('segment_id', v)} placeholder="Adicionar segmento..." />
                )}
              </div>
            </div>
            <InlineEditField type="text" label="Razão social" value={company.legal_name || ''}
              icon={<FileBadge className="h-4 w-4" />} placeholder="Adicionar razão social..."
              onSave={v => saveCompany('legal_name', v)} />
            <InlineEditField type="text" label="CNPJ" value={formatCnpj(company.cnpj)}
              icon={<Hash className="h-4 w-4" />} placeholder="Adicionar CNPJ..."
              onSave={v => saveCompany('cnpj', maskCnpj(v))} />
            <InlineEditField type="text" label="Instagram" value={company.instagram || ''}
                  icon={
                    company.instagram ? (
                      <a href={`https://instagram.com/${company.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}`}
                        target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="text-primary" title="Abrir Instagram">
                        <Instagram className="h-4 w-4" />
                      </a>
                    ) : <Instagram className="h-4 w-4" />
                  }
                  placeholder="Adicionar Instagram..." onSave={v => saveCompany('instagram', v)} />
            {leadsCount > 1 && (
              <p className="pt-1 text-[11px] text-muted-foreground">Alterações valem para os {leadsCount} negócios desta empresa.</p>
            )}
          </>
        )}
      </DetailSection>

      {/* Contatos */}
      <DetailSection
        title={links.length > 1 ? `Contatos (${links.length})` : 'Contatos'}
        icon={<Users className="h-3.5 w-3.5" />}
        action={!readOnly && company && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs"><Plus className="mr-1 h-3.5 w-3.5" /> Adicionar</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-[260px]">
                {unlinked.map(c => (
                  <DropdownMenuItem key={c.id}
                    onClick={() => run(linkContact.mutateAsync({ leadId: lead.id, contactId: c.id }), 'Contato adicionado')}>
                    <span className="truncate">{c.name || c.email || c.phone}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => setContactDialog({ open: true, contact: null })}>
                  <Plus className="mr-2 h-4 w-4" /> Novo contato
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        )}
      >
        {!links.length && <p className="text-sm text-muted-foreground">Nenhum contato neste negócio.</p>}
        {links.map(({ contact, is_primary }) => {
          const c = contact!;
          const digits = (c.phone || '').replace(/\D/g, '');
          return (
            <div key={c.id} className="rounded-md bg-muted/40 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate flex-1">{c.name || '(sem nome)'}</span>
                {is_primary && <Badge variant="secondary" className="text-[10px]">Principal</Badge>}
                {!readOnly && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Ações do contato">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!is_primary && (
                        <DropdownMenuItem onClick={() => run(setPrimary.mutateAsync({ leadId: lead.id, contactId: c.id }), 'Contato principal definido')}>
                          <Star className="mr-2 h-4 w-4" /> Definir como principal
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setContactDialog({ open: true, contact: c })}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => run(unlinkContact.mutateAsync({ leadId: lead.id, contactId: c.id }), 'Contato removido do negócio')}>
                        <Unlink className="mr-2 h-4 w-4" /> Remover do negócio
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => askDelete(c)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir contato
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {c.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{c.phone}</span>
                  {digits && (
                    <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-700" title="Abrir conversa no WhatsApp">
                      <WhatsIcon />
                    </a>
                  )}
                </div>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline min-w-0">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.email}</span>
                </a>
              )}
            </div>
          );
        })}
      </DetailSection>

      {otherLeads.length > 0 && (
        <DetailSection title="Outros negócios desta empresa" icon={<Briefcase className="h-3.5 w-3.5" />} className="order-last">
          <div className="grid gap-2 sm:grid-cols-2">
            {otherLeads.map((l: any) => (
              <button key={l.id} type="button" onClick={() => onOpenLead?.(l.id)}
                className="w-full text-left rounded-md border p-2 hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-2 text-sm">
                  <span className="truncate flex-1">{l.funnel?.name || 'Funil'}</span>
                  <StatusBadge status={l.archived_at ? 'inactive' : l.status} />
                </div>
                {l.stage && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.stage.color }} />
                    {l.stage.name}
                  </div>
                )}
              </button>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Trocar empresa */}
      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Trocar empresa</DialogTitle></DialogHeader>
          <CompanyCombobox value={null} excludeId={companyId || undefined}
            onChange={c => { setChangeOpen(false); setChangeTarget(c); }}
            onCreate={name => { setChangeOpen(false); setCreatingCompany(name); }} />
        </DialogContent>
      </Dialog>
      <CompanyFormDialog open={creatingCompany !== null} onOpenChange={o => { if (!o) setCreatingCompany(null); }}
        initialName={creatingCompany || ''} onCreated={c => setChangeTarget(c)} />
      <AlertDialog open={!!changeTarget} onOpenChange={o => { if (!o) setChangeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar para {changeTarget?.trade_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {links.length
                ? `Os contatos deste negócio que não pertencem a ${changeTarget?.trade_name} serão removidos do negócio (continuam cadastrados na empresa atual).`
                : 'O negócio passará a pertencer à nova empresa.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmChange}>Trocar empresa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mesclar empresas */}
      <Dialog open={mergeOpen} onOpenChange={o => { setMergeOpen(o); if (!o) setMergeSource(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Mesclar com outra empresa</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Escolha a empresa que será absorvida por <strong className="text-foreground">{company?.trade_name}</strong>.
            </p>
            <CompanyCombobox value={mergeSource?.id || null} excludeId={companyId || undefined} onChange={setMergeSource}
              placeholder="Empresa a ser absorvida" />
            {mergeSource && sourceCounts && (
              <div className="rounded-md bg-muted/50 p-3 space-y-1">
                <p>Serão movidos <strong>{sourceCounts.leads}</strong> negócio(s) e <strong>{sourceCounts.contacts}</strong> contato(s).</p>
                <p className="text-xs text-muted-foreground">Contatos repetidos são unidos. Campos vazios desta empresa são preenchidos com os da absorvida, que depois é excluída.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>Cancelar</Button>
            <Button onClick={confirmMerge} disabled={!mergeSource || mergeCompanies.isPending}>
              {mergeCompanies.isPending ? 'Mesclando...' : 'Mesclar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contato: criar/editar */}
      {companyId && (
        <ContactFormDialog open={contactDialog.open} onOpenChange={o => setContactDialog(s => ({ ...s, open: o }))}
          companyId={companyId} contact={contactDialog.contact}
          onSaved={c => { if (!contactDialog.contact) run(linkContact.mutateAsync({ leadId: lead.id, contactId: c.id }), 'Contato adicionado'); }} />
      )}

      {/* Contato: excluir */}
      <AlertDialog open={!!deleting} onOpenChange={o => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleting?.contact.name || 'contato'}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {deleting?.links.length ? (
                  <>
                    <p>Este contato está vinculado a {deleting.links.length} negócio(s):</p>
                    <ul className="list-disc pl-5 text-sm">
                      {deleting.links.map(l => (
                        <li key={l.lead_id}>
                          {l.lead?.company?.trade_name || 'Negócio'}{l.lead?.stage?.name ? ` · ${l.lead.stage.name}` : ''}
                          {l.is_primary ? ' (principal)' : ''}
                        </li>
                      ))}
                    </ul>
                    <p>Onde ele é o principal, o próximo contato vinculado passa a ser o principal.</p>
                  </>
                ) : <p>Esta ação não pode ser desfeita.</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleting) run(deleteContact.mutateAsync(deleting.contact.id), 'Contato excluído'); setDeleting(null); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
