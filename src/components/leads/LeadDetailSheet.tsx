import { useState, useEffect } from 'react';
import { LeadCompanyPanel } from '@/components/companies/LeadCompanyPanel';
import { getLeadDisplay } from '@/lib/leadDisplay';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { Plus, Archive, ArchiveRestore, Trophy, Merge } from 'lucide-react';
import { QuickActivityForm } from './activities/QuickActivityForm';
import { ActivityTimeline } from './activities/ActivityTimeline';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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
import { Pencil, Trash2, Clock, AlertTriangle, Tag, User, DollarSign, FileText, GitBranch, Handshake, Star, StickyNote, ListChecks } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { differenceInHours, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { createActivity } from '@/services/activities';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { LeadWithRelations } from '@/types';

interface LeadDetailSheetProps {
  leadId: string | null;
  onClose: () => void;
}

export function LeadDetailSheet({ leadId: propLeadId, onClose }: LeadDetailSheetProps) {
  const [overrideLeadId, setOverrideLeadId] = useState<string | null>(null);
  useEffect(() => { setOverrideLeadId(null); }, [propLeadId]);
  const leadId = propLeadId ? overrideLeadId || propLeadId : null;
  const { data: lead, isLoading } = useLead(leadId || undefined);
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
  const slaHours = (typedLead as any)?.stage?.sla_hours;
  const slaExceeded = slaHours && hoursInStage > slaHours;

  const isArchived = !!typedLead?.archived_at;
  const activeCustomFields = (customFields || []).filter(d => d.is_active);

  return (
    <TooltipProvider>
      <Sheet open={!!leadId} onOpenChange={open => { if (!open) onClose(); }}>
        <SheetContent className="w-full sm:max-w-[90vw] p-0 flex flex-col overflow-hidden">
          {isLoading || !typedLead ? (
            <div className="px-6 pt-6 pb-4 space-y-4">
              <div className="flex items-start justify-between">
                <Skeleton className="h-7 w-48" />
                <div className="flex gap-1.5"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></div>
              </div>
              <div className="flex gap-2"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-20" /></div>
              <Separator />
              <div className="space-y-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-5 w-3/4" />)}
              </div>
            </div>
          ) : (
            <>
              {/* Archived banner */}
              {isArchived && (
                <div className="bg-muted border-b px-6 py-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Archive className="h-4 w-4" />
                    <span>Este negócio está arquivado.</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleUnarchive} disabled={unarchiveLeadMut.isPending}>
                    <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Desarquivar
                  </Button>
                </div>
              )}

              {/* Header */}
              <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3 shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold leading-tight truncate">{getLeadDisplay(typedLead).title}</h2>
                    {getLeadDisplay(typedLead).primaryContact?.name && (
                      <p className="text-sm text-muted-foreground truncate">{getLeadDisplay(typedLead).primaryContact!.name}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {!isArchived && typedLead.status !== 'won' && (
                      <Button variant="ghost" size="icon" onClick={handleToggleWon} aria-label="Marcar como ganho" className="text-green-600 hover:text-green-600">
                        <Trophy className="h-4 w-4" />
                      </Button>
                    )}
                    {typedLead.status === 'won' && (
                      <Button variant="ghost" size="sm" onClick={handleToggleWon} className="text-muted-foreground text-xs">
                        Reabrir
                      </Button>
                    )}
                    {!isArchived && (
                      <Button variant="ghost" size="icon" onClick={() => setMoveFunnelOpen(true)} aria-label="Mover para outro funil" title="Mover para outro funil">
                        <GitBranch className="h-4 w-4" />
                      </Button>
                    )}
                    {!isArchived && (
                      <Button variant="ghost" size="icon" onClick={() => setMergeOpen(true)} aria-label="Mesclar negócio">
                        <Merge className="h-4 w-4" />
                      </Button>
                    )}
                    {!isArchived && (
                      <Button variant="ghost" size="icon" onClick={() => setArchiveDialogOpen(true)} aria-label="Arquivar negócio">
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} aria-label="Editar negócio">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Excluir negócio">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
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
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={typedLead.status || 'open'} />
                  <PriorityBadge priority={typedLead.priority} />
                  {isArchived && (
                    <Badge variant="secondary" className="gap-1">
                      <Archive className="h-3 w-3" /> Arquivado
                    </Badge>
                  )}
                  {slaExceeded && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      SLA excedido
                    </Badge>
                  )}
                </div>
                {isArchived && ((typedLead as any).archive_reason?.label || (typedLead as any).archive_details) && (
                  <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                    {(typedLead as any).archive_reason?.label && (
                      <p><span className="text-muted-foreground">Motivo do arquivamento: </span>{(typedLead as any).archive_reason.label}</p>
                    )}
                    {(typedLead as any).archive_details && (
                      <p className="whitespace-pre-wrap text-muted-foreground">{(typedLead as any).archive_details}</p>
                    )}
                  </div>
                )}
              </SheetHeader>

              {/* Stage Pipeline - Bitrix style */}
              {stages && stages.length > 0 && (
                <div className="px-6 py-3 border-b shrink-0">
                  <StagePipeline
                    stages={stages}
                    currentStageId={typedLead.stage_id}
                    onStageChange={handleStageChange}
                    disabled={isArchived || updateLeadMut.isPending}
                  />
                </div>
              )}

              {/* Body: deal data cards (primary) + activity column (secondary) */}
              <div className="flex-1 min-h-0 grid grid-cols-1 overflow-auto lg:overflow-hidden lg:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_460px]">
                <div className="bg-muted/30 p-4 lg:overflow-auto lg:p-5">
                  <div className="grid items-start gap-4 xl:grid-cols-2">
                    <LeadCompanyPanel lead={typedLead} readOnly={isArchived} onOpenLead={setOverrideLeadId} className="contents" />

                    <DetailSection title="Negócio" icon={<Handshake className="h-3.5 w-3.5" />}>
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
                        options={(teamMembers || []).map((m: any) => ({
                          value: m.user_id,
                          label: m.profile?.full_name || m.profile?.email || 'Membro',
                        }))}
                        onSave={(v) => handleInlineSave('assigned_to', v)}
                      />
                      {typedLead.funnel && (
                        <div className="flex items-center gap-3 py-0.5 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">Funil</span>
                          <span className="truncate">{typedLead.funnel.name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 py-0.5 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">Na etapa há</span>
                        <span className={slaExceeded ? 'text-destructive font-medium' : ''}>
                          {formatDistanceToNow(new Date(typedLead.stage_entered_at), { locale: ptBR })}
                          {slaExceeded && ` (SLA: ${slaHours}h)`}
                        </span>
                      </div>
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

                    <DetailSection title="Notas" icon={<StickyNote className="h-3.5 w-3.5" />}>
                      <InlineEditField
                        type="textarea"
                        value={typedLead.notes || ''}
                        placeholder="Adicionar notas..."
                        onSave={(v) => handleInlineSave('notes', v)}
                      />
                    </DetailSection>

                    {activeCustomFields.length > 0 && (
                      <DetailSection title="Campos personalizados" icon={<ListChecks className="h-3.5 w-3.5" />} className="xl:col-span-2">
                        <div className="grid gap-x-8 gap-y-1.5 xl:grid-cols-2">
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
                <aside className="flex min-h-[480px] flex-col overflow-hidden border-t lg:min-h-0 lg:border-l lg:border-t-0">
                  <Tabs defaultValue="activities" className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex h-12 shrink-0 items-center border-b px-4">
                      <TabsList className="h-8">
                        <TabsTrigger value="activities" className="text-xs">Atividades</TabsTrigger>
                        <TabsTrigger value="tasks" className="text-xs">Tarefas</TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="activities" className="flex-1 overflow-auto p-4 space-y-4 m-0">
                      <QuickActivityForm leadId={typedLead.id} />
                      <ActivityTimeline leadId={typedLead.id} />
                    </TabsContent>

                    <TabsContent value="tasks" className="flex-1 overflow-auto p-4 space-y-4 m-0">
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => setTaskFormOpen(true)}>
                          <Plus className="h-4 w-4 mr-1" />Nova Tarefa
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
