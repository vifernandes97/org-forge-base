import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowLeft, Building2, FileBadge, Hash, Instagram, Merge, MoreHorizontal, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCompany, useUpdateCompany, useDeleteContact, invalidateLeadData } from '@/hooks/useCompanies';
import { InlineEditField } from '@/components/leads/InlineEditField';
import { SegmentCombobox } from '@/components/companies/SegmentCombobox';
import { ContactFormDialog } from '@/components/companies/ContactFormDialog';
import { StatusBadge } from '@/components/leads/StatusBadge';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { ActivityIcon } from '@/components/leads/activities/ActivityIcon';
import { MergeCompaniesDialog } from '@/components/directory/MergeCompaniesDialog';
import { ContactSheet } from '@/components/contacts/ContactSheet';
import { getCompanyLeads, getCompanyActivities, deleteCompaniesWithoutLeads } from '@/services/directory';
import { getContactLeads } from '@/services/contacts';
import { formatCnpj, isValidCnpj, maskCnpj, onlyDigits } from '@/lib/cnpj';
import { formatCurrency } from '@/lib/formatCurrency';
import type { ActivityType, Company, Contact } from '@/types';

const ACT_PAGE = 30;

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { organization, isOwner, isAdmin, isViewer } = useOrganization();
  const canManage = isOwner || isAdmin;
  const { data: company, isLoading } = useCompany(id);
  const update = useUpdateCompany();
  const deleteContactMut = useDeleteContact();
  const { data: leads } = useQuery({ queryKey: ['company-leads', id], queryFn: () => getCompanyLeads(id!), enabled: !!id });
  const [actPage, setActPage] = useState(0);
  const { data: acts } = useQuery({ queryKey: ['company-activities', id, actPage], queryFn: () => getCompanyActivities(id!, actPage, ACT_PAGE), enabled: !!id });
  const [allActs, setAllActs] = useState<any[]>([]);
  useEffect(() => {
    if (!acts) return;
    setAllActs(prev => (actPage === 0 ? acts.data : [...prev.filter(a => !acts.data.some((n: any) => n.id === a.id)), ...acts.data]));
  }, [acts, actPage]);

  const [leadOpen, setLeadOpen] = useState<string | null>(null);
  const [newLead, setNewLead] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [contactDialog, setContactDialog] = useState<{ open: boolean; contact: Contact | null }>({ open: false, contact: null });
  const [contactView, setContactView] = useState<string | null>(null);
  const [deletingContact, setDeletingContact] = useState<{ contact: Contact; links: any[] } | null>(null);

  useEffect(() => { if (company) document.title = `${organization?.name || 'Org Connect'} — ${company.trade_name}`; }, [company, organization?.name]);
  // Switching workspace: this company is not in the new one
  useEffect(() => {
    if (company && organization && company.organization_id !== organization.id) navigate('/companies', { replace: true });
  }, [company, organization, navigate]);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-40" /></div>;
  if (!company) return <div className="space-y-3"><p className="text-muted-foreground">Empresa não encontrada.</p><Button variant="outline" asChild><Link to="/companies">Voltar</Link></Button></div>;

  const contacts: Contact[] = company.contacts || [];
  const leadList = leads || [];

  const save = async (field: keyof Company, value: string | null) => {
    if (field === 'trade_name' && !value?.trim()) { toast.error('Nome fantasia é obrigatório'); return; }
    if (field === 'cnpj' && onlyDigits(value) && !isValidCnpj(value)) { toast.error('CNPJ inválido'); return; }
    try { await update.mutateAsync({ id: company.id, input: { [field]: value } as any }); }
    catch (e: any) { toast.error(e?.message || 'Erro ao salvar empresa'); }
  };
  const runDelete = async () => {
    try {
      const r = await deleteCompaniesWithoutLeads([company.id]);
      if (r.deleted) { toast.success('Empresa excluída'); invalidateLeadData(qc); navigate('/companies'); }
      else toast.error('A empresa tem negócios e não pode ser excluída');
    } catch (e: any) { toast.error(e?.message || 'Erro ao excluir'); }
    setDeleteOpen(false);
  };
  const askDeleteContact = async (c: Contact) => {
    try { setDeletingContact({ contact: c, links: await getContactLeads(c.id) }); }
    catch (e: any) { toast.error(e?.message || 'Erro ao carregar vínculos'); }
  };
  const igHandle = (company.instagram || '').replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '');

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2"><Link to="/companies"><ArrowLeft className="mr-1 h-4 w-4" /> Empresas</Link></Button>

      <Card>
        <CardContent className="space-y-3 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight truncate">{company.trade_name}</h1>
              {company.segment_ref && <Badge variant="secondary" className="mt-1">{company.segment_ref.label}</Badge>}
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}><Merge className="mr-1.5 h-4 w-4" /> Mesclar</Button>
                {leadList.length === 0 && (company.leads || []).length === 0 && (
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-4 w-4" /> Excluir</Button>
                )}
              </div>
            )}
          </div>
          {isViewer ? (
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Razão social: </span>{company.legal_name || '—'}</p>
              <p><span className="text-muted-foreground">CNPJ: </span>{company.cnpj ? formatCnpj(company.cnpj) : '—'}</p>
              <p><span className="text-muted-foreground">Instagram: </span>{company.instagram || '—'}</p>
              <p><span className="text-muted-foreground">Segmento: </span>{company.segment_ref?.label || '—'}</p>
            </div>
          ) : (
            <div className="grid gap-x-6 sm:grid-cols-2">
              <InlineEditField type="text" label="Nome fantasia" value={company.trade_name} icon={<Building2 className="h-4 w-4" />} onSave={v => save('trade_name', v)} />
              <div className="flex items-start gap-3 py-1 text-sm">
                <Tag className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Segmento</p>
                  <SegmentCombobox value={company.segment_id} current={company.segment_ref} onChange={v => save('segment_id', v)} placeholder="Adicionar segmento..." />
                </div>
              </div>
              <InlineEditField type="text" label="Razão social" value={company.legal_name || ''} icon={<FileBadge className="h-4 w-4" />} placeholder="Adicionar razão social..." onSave={v => save('legal_name', v)} />
              <InlineEditField type="text" label="CNPJ" value={formatCnpj(company.cnpj)} icon={<Hash className="h-4 w-4" />} placeholder="Adicionar CNPJ..." onSave={v => save('cnpj', maskCnpj(v))} />
              <InlineEditField type="text" label="Instagram" value={company.instagram || ''} placeholder="Adicionar Instagram..." onSave={v => save('instagram', v)}
                icon={igHandle ? <a href={`https://instagram.com/${igHandle}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-primary"><Instagram className="h-4 w-4" /></a> : <Instagram className="h-4 w-4" />} />
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Negócios ({leadList.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contatos ({contacts.length})</TabsTrigger>
          <TabsTrigger value="activities">Atividades</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-2">
          {!isViewer && <div className="flex justify-end"><Button size="sm" onClick={() => setNewLead(true)}><Plus className="mr-1.5 h-4 w-4" /> Novo negócio</Button></div>}
          {!leadList.length && <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Nenhum negócio nesta empresa.</p>}
          {leadList.map(l => (
            <button key={l.id} type="button" onClick={() => setLeadOpen(l.id)}
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-card p-3 text-left text-sm hover:bg-accent/50">
              <span className="min-w-[140px] flex-1 font-medium">{l.funnel?.name || 'Funil'}</span>
              {l.stage && <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.stage.color }} />{l.stage.name}</span>}
              <StatusBadge status={l.archived_at ? 'inactive' : l.status} />
              <span className="tabular-nums">{formatCurrency(Number(l.value) || 0)}</span>
              <span className="text-muted-foreground">{l.assignee?.full_name || 'Sem responsável'}</span>
            </button>
          ))}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-2">
          {!isViewer && <div className="flex justify-end"><Button size="sm" onClick={() => setContactDialog({ open: true, contact: null })}><Plus className="mr-1.5 h-4 w-4" /> Novo contato</Button></div>}
          {!contacts.length && <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Nenhum contato.</p>}
          {contacts.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setContactView(c.id)}>
                <p className="font-medium truncate">{c.name || '(sem nome)'}</p>
                <p className="text-xs text-muted-foreground truncate">{[c.email, c.phone].filter(Boolean).join(' · ') || 'Sem e-mail e telefone'}</p>
              </button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setContactView(c.id)}>Ver negócios</Button>
              {!isViewer && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações do contato"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setContactDialog({ open: true, contact: c })}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                    {canManage && <DropdownMenuItem className="text-destructive" onClick={() => askDeleteContact(c)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="activities" className="space-y-3">
          {!allActs.length && <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Nenhuma atividade.</p>}
          {allActs.map(a => (
            <div key={a.id} className="flex gap-3">
              <ActivityIcon type={a.activity_type as ActivityType} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{a.title}</p>
                {a.description && <p className="whitespace-pre-wrap text-muted-foreground">{a.description}</p>}
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <button type="button" className="text-primary hover:underline" onClick={() => setLeadOpen(a.lead?.id)}>
                    {a.lead?.funnel?.name || 'Negócio'}{a.lead?.stage?.name ? ` · ${a.lead.stage.name}` : ''}
                  </button>
                  <span>{a.user?.full_name}</span>
                  <span title={format(new Date(a.created_at), 'dd/MM/yyyy HH:mm')}>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}</span>
                </div>
              </div>
            </div>
          ))}
          {acts && allActs.length < acts.count && (
            <Button variant="outline" size="sm" onClick={() => setActPage(p => p + 1)}>Carregar mais</Button>
          )}
        </TabsContent>
      </Tabs>

      <LeadDetailSheet leadId={leadOpen} onClose={() => setLeadOpen(null)} />
      <LeadFormDialog open={newLead} onOpenChange={setNewLead} defaultCompanyId={company.id} />
      <ContactSheet contactId={contactView} onClose={() => setContactView(null)} />
      <MergeCompaniesDialog open={mergeOpen} onOpenChange={setMergeOpen}
        companies={[{ id: company.id, trade_name: company.trade_name, cnpj: company.cnpj }]}
        onMerged={keptId => { if (keptId !== company.id) navigate(`/companies/${keptId}`, { replace: true }); }} />
      <ContactFormDialog open={contactDialog.open} onOpenChange={o => setContactDialog(s => ({ ...s, open: o }))}
        companyId={company.id} contact={contactDialog.contact} onSaved={() => invalidateLeadData(qc)} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {company.trade_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {contacts.length ? `Os ${contacts.length} contato(s) desta empresa também serão excluídos. ` : ''}Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={runDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingContact} onOpenChange={o => { if (!o) setDeletingContact(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deletingContact?.contact.name || 'contato'}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {deletingContact?.links.length ? (
                  <>
                    <p>Este contato está vinculado a {deletingContact.links.length} negócio(s):</p>
                    <ul className="list-disc pl-5">
                      {deletingContact.links.map(l => (
                        <li key={l.lead_id}>{l.lead?.company?.trade_name || 'Negócio'}{l.lead?.stage?.name ? ` · ${l.lead.stage.name}` : ''}{l.is_primary ? ' (principal)' : ''}</li>
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
              onClick={async () => {
                if (deletingContact) {
                  try { await deleteContactMut.mutateAsync(deletingContact.contact.id); toast.success('Contato excluído'); }
                  catch (e: any) { toast.error(e?.message || 'Erro ao excluir'); }
                }
                setDeletingContact(null);
              }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
