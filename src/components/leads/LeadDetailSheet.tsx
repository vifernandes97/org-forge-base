import { useState, useEffect, useRef } from 'react';
import { LeadCompanyPanel } from '@/components/companies/LeadCompanyPanel';
import { getLeadDisplay } from '@/lib/leadDisplay';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { Plus, Archive, ArchiveRestore, Trophy, Merge, MoreHorizontal, X, Building2, History } from 'lucide-react';
import { QuickActivityForm } from './activities/QuickActivityForm';
import { ActivityTimeline } from './activities/ActivityTimeline';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';
import { useLead, useDeleteLead, useArchiveLead, useUnarchiveLead, useUpdateLead, useUpsertCustomFieldValue, useMoveLeadToFunnel } from '@/hooks/useLeads';
import { useActiveArchiveReasons } from '@/hooks/useArchiveReasons';
import { useCustomFields } from '@/hooks/useCustomFields';
import { useTeamMembers } from '@/hooks/useTeam';
import { useStages } from '@/hooks/useStages';
import { InlineEditField } from './InlineEditField';
import { CustomFieldInlineEdit } from './CustomFieldInlineEdit';
import { StagePipeline } from './StagePipeline';
import { DetailSection } from './DetailSection';

import { LeadFormDialog } from './LeadFormDialog';
import { MergeLeadsDialog } from './MergeLeadsDialog';
import { MoveToFunnelDialog } from './MoveToFunnelDialog';
import { ArchiveReasonCombobox } from './ArchiveReasonCombobox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, Clock, AlertTriangle, Tag, User, DollarSign, GitBranch, Handshake, Star, StickyNote, ListChecks } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { differenceInHours, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { createActivity } from '@/services/activities';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { LeadWithRelations } from '@/types';

const dealCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface LeadDetailSheetProps {
  leadId: string | null;
  onClose: () => void;
}

export function LeadDetailSheet({ leadId: propLeadId, onClose }: LeadDetailSheetProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [overrideLeadId, setOverrideLeadId] = useState<string | null>(null);
  useEffect(() => { setOverrideLeadId(null); }, [propLeadId]);
  const leadId = propLeadId ? overrideLeadId || propLeadId : null;
  const { data: lead, isLoading, isError, isFetching, refetch } = useLead(leadId || undefined);
  const { data: customFields } = useCustomFields();
  const { data: archiveReasons } = useActiveArchiveReasons();
  const { data: teamMembers } = useTeamMembers();
  const typedLeadForStages = lead as LeadWithRelations | undefined;
  const { data: stages } = useStages(typedLeadForStages?.funnel_id);
  const deleteLead = useDeleteLead();
  const updateLeadMut = useUpdateLead();
  const upsertCfv = useUpsertCustomFieldValue();
  const archiveLeadMut = useArchiveLead();
  const unarchiveLeadMut = useUnarchiveLead();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [editOpen, setEditOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [moveFunnelOpen, setMoveFunnelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Below lg the body is one column: phones switch between panes instead of scrolling past every card.
  const [pane, setPane] = useState<'details' | 'activities' | 'tasks'>('details');
  useEffect(() => { setPane('details'); }, [leadId]);
  const [selectedReasonId, setSelectedReasonId] = useState<string>('');
  const [archiveDetails, setArchiveDetails] = useState('');
  const moveToFunnelMut = useMoveLeadToFunnel();

  const handleMoveToFunnel = async (funnelId: string, funnelName: string, stageId: string, stageName: string) => {
    if (!leadId || !user || !organization || !typedLead) return;
    const oldFunnel = typedLead.funnel?.name || '';
    try {
      await moveToFunnelMut.mutateAsync({ leadId, funnelId, stageId });
      await createActivity({
        organization_id: organization.id,
        lead_id: leadId,
        user_id: user.id,
        activity_type: 'stage_change',
        title: `Funil alterado: ${oldFunnel} → ${funnelName} (etapa: ${stageName})`,
        metadata: { from_funnel: oldFunnel, to_funnel: funnelName, to_stage: stageName },
      });
      toast.success(`Movido para ${funnelName}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao mover de funil');
    }
  };


  const handleStageChange = async (stageId: string) => {
    if (!leadId || !user || !organization || !typedLead) return;
    const oldStage = typedLead.stage?.name || '';
    const newStage = stages?.find(s => s.id === stageId)?.name || '';
    try {
      await updateLeadMut.mutateAsync({ id: leadId, updates: { stage_id: stageId } as any });
      await createActivity({
        organization_id: organization.id,
        lead_id: leadId,
        user_id: user.id,
        activity_type: 'stage_change',
        title: `Etapa alterada: ${oldStage} → ${newStage}`,
        metadata: { from_stage: oldStage, to_stage: newStage },
      });
      toast.success(`Movido para ${newStage}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao mover etapa');
    }
  };

  const handleInlineSave = async (field: string, value: string) => {
    if (!leadId) return;
    const updates: Record<string, any> = {};
    if (field === 'value') {
      updates[field] = parseFloat(value) || 0;
    } else if (field === 'qualification') {
      updates[field] = value ? parseInt(value, 10) : null;
    } else if (field === 'assigned_to') {
      updates[field] = value || null;
    } else {
      updates[field] = value || null;
    }
    try {
      await updateLeadMut.mutateAsync({ id: leadId, updates: updates as any });
      toast.success('Atualizado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar');
      throw err;
    }
  };

  const handleCustomFieldSave = async (defId: string, value: string) => {
    if (!leadId) return;
    try {
      await upsertCfv.mutateAsync({ leadId, fieldDefinitionId: defId, value: value || null });
      toast.success('Atualizado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar campo');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!leadId) return;
    try {
      await deleteLead.mutateAsync(leadId);
      toast.success('Negócio excluído!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const handleArchive = async () => {
    if (!leadId || !selectedReasonId || !user || !organization) return;
    try {
      const reason = archiveReasons?.find(r => r.id === selectedReasonId);
      const details = archiveDetails.trim();
      await archiveLeadMut.mutateAsync({ leadId, reasonId: selectedReasonId, details });
      await createActivity({
        organization_id: organization.id,
        lead_id: leadId,
        user_id: user.id,
        activity_type: 'note',
        title: 'Negócio arquivado',
        description: `Motivo: ${reason?.label || 'N/A'}${details ? `\nDetalhes: ${details}` : ''}`,
        metadata: { source: 'archive', reason_id: selectedReasonId, reason_label: reason?.label, details: details || null },
      });
      toast.success('Negócio arquivado!');
      setArchiveDialogOpen(false);
      setSelectedReasonId('');
      setArchiveDetails('');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao arquivar');
    }
  };

  const handleUnarchive = async () => {
    if (!leadId || !user || !organization) return;
    try {
      await unarchiveLeadMut.mutateAsync(leadId);
      await createActivity({
        organization_id: organization.id,
        lead_id: leadId,
        user_id: user.id,
        activity_type: 'note',
        title: 'Negócio desarquivado',
      });
      toast.success('Negócio desarquivado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao desarquivar');
    }
  };

  const handleToggleWon = async () => {
    if (!leadId || !user || !organization) return;
    const newStatus = typedLead?.status === 'won' ? 'open' : 'won';
    try {
      await updateLeadMut.mutateAsync({ id: leadId, updates: { status: newStatus } as any });
      if (newStatus === 'won') {
        await createActivity({
          organization_id: organization.id,
          lead_id: leadId,
          user_id: user.id,
          activity_type: 'note',
          title: 'Negócio marcado como Ganho',
        });
        toast.success('Negócio marcado como Ganho!');
      } else {
        await createActivity({
          organization_id: organization.id,
          lead_id: leadId,
          user_id: user.id,
          activity_type: 'note',
          title: 'Negócio reaberto',
        });
        toast.success('Negócio reaberto!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar status');
    }
  };

  const typedLead = lead as LeadWithRelations | undefined;

  // SLA calculation
  const hoursInStage = typedLead?.stage_entered_at
    ? differenceInHours(new Date(), new Date(typedLead.stage_entered_at))
    : 0;
  const slaHours = typedLead?.stage?.sla_hours;
  const slaExceeded = slaHours && hoursInStage > slaHours;

  const isArchived = !!typedLead?.archived_at;
  const isWon = typedLead?.status === 'won';
  const { title, primaryContact } = getLeadDisplay(typedLead);
  const assigneeOptions = (teamMembers || []).map(member => ({
    value: member.user_id,
    label: member.profile?.full_name || member.profile?.email || 'Membro da equipe',
  }));
  const assigneeId = typedLead?.assigned_to;
  if (assigneeId && !assigneeOptions.some(option => option.value === assigneeId)) {
    const profile = typedLead.assigned_profile;
    assigneeOptions.push({ value: assigneeId, label: profile?.full_name || profile?.email || 'Membro da equipe' });
  }
  const assignee = assigneeOptions.find(option => option.value === assigneeId);
  const stageAge = typedLead?.stage_entered_at
    ? formatDistanceToNow(new Date(typedLead.stage_entered_at), { locale: ptBR, addSuffix: true })
    : null;
  const archive = typedLead as (LeadWithRelations & {
    archive_reason?: { label: string } | null;
    archive_details?: string | null;
  }) | undefined;
  const activeCustomFields = (customFields || []).filter(d => d.is_active);

  return (
    <TooltipProvider>
      <Sheet open={!!leadId} onOpenChange={open => { if (!open) onClose(); }}>
        <SheetContent
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 lg:max-w-[94vw] lg:overflow-hidden 2xl:max-w-[1440px]"
          closeClassName="hidden"
          aria-describedby={undefined}
          onOpenAutoFocus={event => {
            event.preventDefault();
            titleRef.current?.focus();
          }}
        >
          <SheetHeader className="shrink-0 gap-4 space-y-0 border-b bg-card px-4 py-4 text-left sm:px-6">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary sm:flex">
                  <Building2 aria-hidden="true" className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <SheetTitle
                    ref={titleRef}
                    tabIndex={-1}
                    title={typedLead ? title : undefined}
                    className="line-clamp-2 break-words text-xl leading-tight tracking-tight outline-none sm:text-2xl"
                  >
                    {typedLead ? title : 'Detalhes do negócio'}
                  </SheetTitle>
                  {primaryContact?.name && primaryContact.name !== title && (
                    <p className="mt-1 break-words text-sm text-muted-foreground">{primaryContact.name}</p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {typedLead && (
                  <>
                    {(!isArchived || isWon) && (
                      <Button
                        variant={isWon ? 'outline' : 'default'}
                        size="sm"
                        className="hidden sm:inline-flex"
                        onClick={handleToggleWon}
                        disabled={updateLeadMut.isPending}
                      >
                        {isWon ? 'Reabrir' : <><Trophy className="mr-2 h-4 w-4" /> Marcar como ganho</>}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} aria-label="Editar negócio">
                      <Pencil className="h-4 w-4" /><span className="ml-2 hidden sm:inline">Editar</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="px-2.5" aria-label="Mais ações">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {(!isArchived || isWon) && (
                          <DropdownMenuItem className="sm:hidden" onSelect={handleToggleWon} disabled={updateLeadMut.isPending}>
                            <Trophy className="mr-2 h-4 w-4" /> {isWon ? 'Reabrir' : 'Marcar como ganho'}
                          </DropdownMenuItem>
                        )}
                        {!isArchived && (
                          <>
                            <DropdownMenuItem onSelect={() => setMoveFunnelOpen(true)}>
                              <GitBranch className="mr-2 h-4 w-4" /> Mover para outro funil
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setMergeOpen(true)}>
                              <Merge className="mr-2 h-4 w-4" /> Mesclar negócio
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setArchiveDialogOpen(true)}>
                              <Archive className="mr-2 h-4 w-4" /> Arquivar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Fechar negócio">
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
              </div>
            </div>

            {typedLead && (
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={typedLead.status || 'open'} />
                <PriorityBadge priority={typedLead.priority} />
                {isArchived && <Badge variant="secondary" className="gap-1"><Archive className="h-3 w-3" /> Arquivado</Badge>}
                {slaExceeded && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> SLA excedido · {slaHours}h
                  </Badge>
                )}
              </div>
            )}
          </SheetHeader>

          {isLoading ? (
            <div role="status" className="space-y-4 p-6">
              <span className="sr-only">Carregando negócio…</span>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : !typedLead ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground" role="status">
                {isError ? 'Não foi possível carregar o negócio.' : 'Negócio indisponível.'}
              </p>
              <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
                {isFetching ? 'Carregando…' : 'Tentar novamente'}
              </Button>
            </div>
          ) : (
            <>
              <section aria-label="Funil do negócio" className="shrink-0 space-y-2 border-b bg-card px-4 py-3 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                    <GitBranch aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="break-words">{typedLead.funnel?.name || 'Funil'}</span>
                  </h3>
                  {stageAge && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock aria-hidden="true" className="h-3.5 w-3.5" /> Nesta etapa {stageAge}
                    </span>
                  )}
                </div>
                {stages && stages.length > 0 ? (
                  <StagePipeline
                    stages={stages}
                    currentStageId={typedLead.stage_id}
                    onStageChange={handleStageChange}
                    disabled={isArchived || updateLeadMut.isPending}
                  />
                ) : typedLead.stage && <p className="text-sm text-muted-foreground">{typedLead.stage.name}</p>}
              </section>

              <nav className="sticky top-0 z-10 flex shrink-0 border-b bg-card px-3 lg:hidden" aria-label="Seções do negócio">
                {([
                  ['details', 'Detalhes', Handshake],
                  ['activities', 'Atividades', History],
                  ['tasks', 'Tarefas', ListChecks],
                ] as const).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={pane === value}
                    onClick={event => {
                      setPane(value);
                      const modal = event.currentTarget.closest('[role="dialog"]');
                      const funnel = event.currentTarget.parentElement?.previousElementSibling;
                      if (modal && funnel instanceof HTMLElement) {
                        modal.scrollTop = Math.min(modal.scrollTop, funnel.offsetTop + funnel.offsetHeight);
                      }
                    }}
                    className={cn(
                      '-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-sm font-medium transition-colors',
                      pane === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
                    )}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </nav>

              {/* Body: deal data cards (primary) + activity column (secondary) */}
              <div className="grid min-w-0 flex-1 grid-cols-1 items-start lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(320px,34%)] lg:items-stretch lg:overflow-hidden">
                <div className={cn('min-w-0 bg-muted/35 p-4 lg:block lg:overflow-y-auto lg:p-6', pane !== 'details' && 'hidden')}>
                  <div className="space-y-4">
                    {isArchived && (
                      <section className="rounded-xl border bg-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="flex items-center gap-2 text-sm font-semibold">
                            <Archive className="h-4 w-4 text-muted-foreground" /> Negócio arquivado
                          </h3>
                          <Button variant="outline" size="sm" onClick={handleUnarchive} disabled={unarchiveLeadMut.isPending}>
                            <ArchiveRestore className="mr-2 h-4 w-4" /> Desarquivar
                          </Button>
                        </div>
                        {archive?.archive_reason?.label && <p className="mt-2 break-words text-sm">{archive.archive_reason.label}</p>}
                        {archive?.archive_details && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{archive.archive_details}</p>}
                      </section>
                    )}

                    <dl className="grid grid-cols-1 divide-y rounded-xl border bg-card min-[380px]:grid-cols-2 min-[380px]:divide-x min-[380px]:divide-y-0">
                      <div className="min-w-0 px-4 py-3">
                        <dt className="text-xs font-medium text-muted-foreground">Valor do negócio</dt>
                        <dd className="mt-1 break-words text-lg font-semibold tracking-tight tabular-nums">
                          {dealCurrency.format(Number(typedLead.value) || 0)}
                        </dd>
                      </div>
                      <div className="min-w-0 px-4 py-3">
                        <dt className="text-xs font-medium text-muted-foreground">Responsável</dt>
                        <dd className="mt-1 break-words text-sm font-semibold leading-7">
                          {assignee?.label || 'Sem responsável'}
                        </dd>
                      </div>
                    </dl>

                    <LeadCompanyPanel
                      lead={typedLead}
                      readOnly={isArchived}
                      onOpenLead={setOverrideLeadId}
                      companyColumn={
                        <DetailSection title="Dados do negócio" icon={<Handshake className="h-3.5 w-3.5" />}>
                          <InlineEditField
                            type="currency"
                            label="Valor"
                            value={Number(typedLead.value || 0)}
                            icon={<DollarSign className="h-4 w-4" />}
                            placeholder="Valor"
                            onSave={(v) => handleInlineSave('value', v)}
                          />
                          <InlineEditField
                            type="select"
                            label="Responsável"
                            value={typedLead.assigned_to || ''}
                            icon={<User className="h-4 w-4" />}
                            placeholder="Sem responsável"
                            options={assigneeOptions}
                            onSave={(v) => handleInlineSave('assigned_to', v)}
                          />
                          <InlineEditField
                            type="text"
                            label="Fonte"
                            value={typedLead.source || ''}
                            icon={<Tag className="h-4 w-4" />}
                            placeholder="Adicionar fonte..."
                            onSave={(v) => handleInlineSave('source', v)}
                          />
                          <InlineEditField
                            type="select"
                            label="Prioridade"
                            value={typedLead.priority || 'medium'}
                            icon={<AlertTriangle className="h-4 w-4" />}
                            placeholder="Prioridade"
                            options={[
                              { value: 'low', label: 'Baixa' },
                              { value: 'medium', label: 'Média' },
                              { value: 'high', label: 'Alta' },
                              { value: 'urgent', label: 'Urgente' },
                            ]}
                            onSave={(v) => handleInlineSave('priority', v)}
                          />
                          <InlineEditField
                            type="select"
                            label="Qualificação"
                            value={String((typedLead as any).qualification || '')}
                            icon={<Star className="h-4 w-4" />}
                            placeholder="Qualificação"
                            options={[
                              { value: '1', label: '1 - Muito Baixa' },
                              { value: '2', label: '2 - Baixa' },
                              { value: '3', label: '3 - Média' },
                              { value: '4', label: '4 - Alta' },
                              { value: '5', label: '5 - Muito Alta' },
                            ]}
                            onSave={(v) => handleInlineSave('qualification', v)}
                          />
                          {typedLead.tags?.length > 0 && (
                            <div className="flex items-start gap-3 pt-1 text-sm">
                              <Tag className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">Tags</span>
                              <div className="flex flex-wrap gap-1.5">
                                {typedLead.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                              </div>
                            </div>
                          )}
                        </DetailSection>
                      }
                      contactsColumn={
                        <DetailSection title="Notas" icon={<StickyNote className="h-3.5 w-3.5" />}>
                          <InlineEditField
                            type="textarea"
                            value={typedLead.notes || ''}
                            placeholder="Adicionar notas..."
                            onSave={(v) => handleInlineSave('notes', v)}
                          />
                        </DetailSection>
                      }
                    />

                    {activeCustomFields.length > 0 && (
                      <DetailSection title="Campos personalizados" icon={<ListChecks className="h-3.5 w-3.5" />}>
                        <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 xl:grid-cols-2">
                          {activeCustomFields.map((def) => {
                            const cfv = (typedLead.custom_field_values || []).find((v: any) => v.field_definition_id === def.id);
                            const currentValue = cfv?.value || '';
                            const fieldType = def.field_type;

                            if (fieldType === 'select' && Array.isArray(def.options)) {
                              const opts = (def.options as any[]).map((o: any) =>
                                typeof o === 'string' ? { value: o, label: o } : { value: o.value ?? o.label, label: o.label ?? o.value }
                              );
                              return (
                                <InlineEditField
                                  key={def.id}
                                  type="select"
                                  label={def.field_label}
                                  value={currentValue}
                                  options={opts}
                                  icon={<Tag className="h-4 w-4" />}
                                  placeholder={`Adicionar ${def.field_label.toLowerCase()}...`}
                                  onSave={(v) => handleCustomFieldSave(def.id, v)}
                                />
                              );
                            }

                            if (fieldType === 'multi_select' || fieldType === 'date' || fieldType === 'checkbox') {
                              return (
                                <CustomFieldInlineEdit
                                  key={def.id}
                                  def={def}
                                  value={currentValue}
                                  onSave={(v) => handleCustomFieldSave(def.id, v)}
                                />
                              );
                            }

                            return (
                              <InlineEditField
                                key={def.id}
                                type="text"
                                label={def.field_label}
                                value={currentValue}
                                icon={<Tag className="h-4 w-4" />}
                                placeholder={`Adicionar ${def.field_label.toLowerCase()}...`}
                                onSave={(v) => handleCustomFieldSave(def.id, v)}
                              />
                            );
                          })}
                        </div>
                      </DetailSection>
                    )}
                  </div>
                </div>

                {/* Activities & Tasks */}
                <aside className={cn('min-w-0 flex-col bg-card lg:flex lg:min-h-0 lg:border-l', pane === 'details' && 'hidden')}>
                  <Tabs
                    value={pane === 'tasks' ? 'tasks' : 'activities'}
                    onValueChange={v => setPane(v as 'activities' | 'tasks')}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <div className="hidden shrink-0 items-center border-b p-3 lg:flex">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="activities" className="gap-2"><History className="h-4 w-4" /> Atividades</TabsTrigger>
                        <TabsTrigger value="tasks" className="gap-2"><ListChecks className="h-4 w-4" /> Tarefas</TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="activities" className="m-0 min-h-0 flex-1 space-y-4 p-4 lg:overflow-y-auto lg:p-5">
                      <QuickActivityForm leadId={typedLead.id} />
                      <h3 className="text-sm font-semibold">Histórico de atividades</h3>
                      <ActivityTimeline leadId={typedLead.id} />
                    </TabsContent>

                    <TabsContent value="tasks" className="m-0 min-h-0 flex-1 space-y-4 p-4 lg:overflow-y-auto lg:p-5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">Tarefas do negócio</h3>
                        <Button size="sm" onClick={() => setTaskFormOpen(true)}>
                          <Plus className="h-4 w-4 mr-1" />Nova tarefa
                        </Button>
                      </div>
                      <TaskList leadId={typedLead.id} />
                      <TaskFormDialog open={taskFormOpen} onOpenChange={setTaskFormOpen} leadId={typedLead.id} />
                    </TabsContent>
                  </Tabs>
                </aside>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {typedLead && (
        <MergeLeadsDialog
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          baseLeadId={typedLead.id}
        />
      )}

      {typedLead && (
        <MoveToFunnelDialog
          open={moveFunnelOpen}
          onOpenChange={setMoveFunnelOpen}
          currentFunnelId={typedLead.funnel_id}
          isPending={moveToFunnelMut.isPending}
          onConfirm={handleMoveToFunnel}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir negócio?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={v => { setArchiveDialogOpen(v); if (!v) { setSelectedReasonId(''); setArchiveDetails(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar negócio</AlertDialogTitle>
            <AlertDialogDescription>Selecione o motivo do arquivamento ou crie um novo.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <ArchiveReasonCombobox value={selectedReasonId} onChange={setSelectedReasonId} />
            <div className="space-y-1.5">
              <Label htmlFor="archive-details" className="text-xs font-medium text-muted-foreground">
                Detalhes (opcional)
              </Label>
              <Textarea
                id="archive-details"
                rows={3}
                placeholder="Adicione detalhes sobre o arquivamento..."
                value={archiveDetails}
                onChange={e => setArchiveDetails(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={!selectedReasonId || archiveLeadMut.isPending}>
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {typedLead && (
        <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} lead={typedLead} />
      )}
    </TooltipProvider>
  );
}
