import { useState } from 'react';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { Plus, Archive, ArchiveRestore, Trophy } from 'lucide-react';
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
import { useLead, useDeleteLead, useArchiveLead, useUnarchiveLead, useUpdateLead } from '@/hooks/useLeads';
import { useActiveArchiveReasons } from '@/hooks/useArchiveReasons';
import { useCustomFields } from '@/hooks/useCustomFields';
import { useTeamMembers } from '@/hooks/useTeam';
import { useStages } from '@/hooks/useStages';
import { InlineEditField } from './InlineEditField';
import { StagePipeline } from './StagePipeline';

import { LeadFormDialog } from './LeadFormDialog';
import { Pencil, Trash2, Clock, AlertTriangle, Building2, Mail, Tag, User, DollarSign, FileText, Instagram, FileBadge } from 'lucide-react';
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

export function LeadDetailSheet({ leadId, onClose }: LeadDetailSheetProps) {
  const { data: lead, isLoading } = useLead(leadId || undefined);
  const { data: customFields } = useCustomFields();
  const { data: archiveReasons } = useActiveArchiveReasons();
  const { data: teamMembers } = useTeamMembers();
  const typedLeadForStages = lead as LeadWithRelations | undefined;
  const { data: stages } = useStages(typedLeadForStages?.funnel_id);
  const deleteLead = useDeleteLead();
  const updateLeadMut = useUpdateLead();
  const archiveLeadMut = useArchiveLead();
  const unarchiveLeadMut = useUnarchiveLead();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [editOpen, setEditOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState<string>('');

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

  const handleDelete = async () => {
    if (!leadId) return;
    try {
      await deleteLead.mutateAsync(leadId);
      toast.success('Lead excluído!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const handleArchive = async () => {
    if (!leadId || !selectedReasonId || !user || !organization) return;
    try {
      const reason = archiveReasons?.find(r => r.id === selectedReasonId);
      await archiveLeadMut.mutateAsync({ leadId, reasonId: selectedReasonId });
      await createActivity({
        organization_id: organization.id,
        lead_id: leadId,
        user_id: user.id,
        activity_type: 'note',
        title: 'Lead arquivado',
        description: `Motivo: ${reason?.label || 'N/A'}`,
        metadata: { source: 'archive', reason_id: selectedReasonId, reason_label: reason?.label },
      });
      toast.success('Lead arquivado!');
      setArchiveDialogOpen(false);
      setSelectedReasonId('');
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
        title: 'Lead desarquivado',
      });
      toast.success('Lead desarquivado!');
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
          title: 'Lead marcado como Ganho',
        });
        toast.success('Lead marcado como Ganho!');
      } else {
        await createActivity({
          organization_id: organization.id,
          lead_id: leadId,
          user_id: user.id,
          activity_type: 'note',
          title: 'Lead reaberto',
        });
        toast.success('Lead reaberto!');
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

  return (
    <>
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
                    <span>Este lead está arquivado.</span>
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
                    <InlineEditField
                      type="text"
                      value={typedLead.company_name || typedLead.name}
                      icon={undefined}
                      placeholder="Nome do lead"
                      onSave={(v) => handleInlineSave('name', v)}
                      className="text-xl font-semibold leading-tight"
                    />
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
                      <Button variant="ghost" size="icon" onClick={() => setArchiveDialogOpen(true)} aria-label="Arquivar lead">
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} aria-label="Editar lead">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Excluir lead">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
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

              {/* Two-column Bitrix-style layout */}
              <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3">
                {/* Left panel - Lead info */}
                <div className="lg:col-span-1 border-r overflow-auto p-6 space-y-4">
                  {/* Contact info */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contato</p>
                    <InlineEditField
                      type="text"
                      label="Email"
                      value={typedLead.email || ''}
                      icon={<Mail className="h-4 w-4" />}
                      placeholder="Adicionar email..."
                      onSave={(v) => handleInlineSave('email', v)}
                    />
                    <InlineEditField
                      type="text"
                      label="Telefone (WhatsApp)"
                      value={typedLead.phone || ''}
                      icon={
                        typedLead.phone ? (
                          <a
                            href={`https://wa.me/${typedLead.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-green-500 hover:text-green-600 transition-colors"
                            title="Abrir conversa no WhatsApp"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </a>
                        ) : (
                          <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        )
                      }
                      placeholder="Adicionar telefone..."
                      onSave={(v) => handleInlineSave('phone', v)}
                    />
                    <InlineEditField
                      type="text"
                      label="Empresa"
                      value={typedLead.company || ''}
                      icon={<Building2 className="h-4 w-4" />}
                      placeholder="Adicionar empresa..."
                      onSave={(v) => handleInlineSave('company', v)}
                    />
                    <InlineEditField
                      type="text"
                      label="Razão Social"
                      value={(typedLead as any).company_name || ''}
                      icon={<FileBadge className="h-4 w-4" />}
                      placeholder="Adicionar razão social..."
                      onSave={(v) => handleInlineSave('company_name', v)}
                    />
                    <InlineEditField
                      type="text"
                      label="Instagram"
                      value={(typedLead as any).company_instagram || ''}
                      icon={<Instagram className="h-4 w-4" />}
                      placeholder="Adicionar Instagram..."
                      onSave={(v) => handleInlineSave('company_instagram', v)}
                    />
                    <InlineEditField
                      type="currency"
                      label="Valor"
                      value={Number(typedLead.value || 0)}
                      icon={<DollarSign className="h-4 w-4" />}
                      placeholder="Valor"
                      onSave={(v) => handleInlineSave('value', v)}
                    />
                  </div>

                  <Separator />

                  {/* Assignment & details */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detalhes</p>
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
                      <div className="flex items-center gap-3 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{typedLead.funnel.name}</span>
                      </div>
                    )}
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
                      icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
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
                  </div>

                  {/* Tags */}
                  {typedLead.tags?.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tags</p>
                        <div className="flex flex-wrap gap-1.5">
                          {typedLead.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Time in stage */}
                  <Separator />
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className={slaExceeded ? 'text-destructive font-medium' : ''}>
                      Na etapa há {formatDistanceToNow(new Date(typedLead.stage_entered_at), { locale: ptBR })}
                      {slaExceeded && ` (SLA: ${slaHours}h)`}
                    </span>
                  </div>

                  {/* Notes */}
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notas</p>
                    <InlineEditField
                      type="textarea"
                      value={typedLead.notes || ''}
                      placeholder="Adicionar notas..."
                      onSave={(v) => handleInlineSave('notes', v)}
                    />
                  </div>

                  {/* Custom fields */}
                  {typedLead.custom_field_values && typedLead.custom_field_values.length > 0 && customFields && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Campos Personalizados</p>
                        {typedLead.custom_field_values.map((cfv: any) => {
                          const def = customFields.find(d => d.id === cfv.field_definition_id);
                          if (!def || !cfv.value) return null;
                          return (
                            <div key={cfv.id} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{def.field_label}</span>
                              <span>{cfv.value}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Right panel - Activities & Tasks */}
                <div className="lg:col-span-2 overflow-hidden flex flex-col">
                  <Tabs defaultValue="activities" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="mx-6 mt-4 mb-2 justify-start shrink-0">
                      <TabsTrigger value="activities">Atividades</TabsTrigger>
                      <TabsTrigger value="tasks">Tarefas</TabsTrigger>
                    </TabsList>

                    <TabsContent value="activities" className="flex-1 overflow-auto px-6 py-4 space-y-4 m-0">
                      <QuickActivityForm leadId={typedLead.id} />
                      <ActivityTimeline leadId={typedLead.id} />
                    </TabsContent>

                    <TabsContent value="tasks" className="flex-1 overflow-auto px-6 py-4 space-y-4 m-0">
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => setTaskFormOpen(true)}>
                          <Plus className="h-4 w-4 mr-1" />Nova Tarefa
                        </Button>
                      </div>
                      <TaskList leadId={typedLead.id} />
                      <TaskFormDialog open={taskFormOpen} onOpenChange={setTaskFormOpen} leadId={typedLead.id} />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Archive dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={v => { setArchiveDialogOpen(v); if (!v) setSelectedReasonId(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar lead</AlertDialogTitle>
            <AlertDialogDescription>Selecione o motivo do arquivamento.</AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={selectedReasonId || '__placeholder__'} onValueChange={v => setSelectedReasonId(v === '__placeholder__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um motivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__placeholder__" disabled>Selecione um motivo</SelectItem>
              {(archiveReasons || []).map(r => (
                <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
    </>
  );
}
