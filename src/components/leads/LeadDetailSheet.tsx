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

import { LeadFormDialog } from './LeadFormDialog';
import { Pencil, Trash2, Clock, AlertTriangle, Building2, Mail, Phone, Tag, User, DollarSign, FileText } from 'lucide-react';
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
  const deleteLead = useDeleteLead();
  const archiveLeadMut = useArchiveLead();
  const unarchiveLeadMut = useUnarchiveLead();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [editOpen, setEditOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState<string>('');

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
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
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
              <Separator />
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-5 w-2/3" />)}
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
              <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <SheetTitle className="text-xl leading-tight">{typedLead.name}</SheetTitle>
                  <div className="flex gap-1.5 shrink-0">
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
                  <PriorityBadge priority={typedLead.priority} />
                  {typedLead.stage && (
                    <Badge variant="outline" style={{ borderColor: typedLead.stage.color, color: typedLead.stage.color }}>
                      {typedLead.stage.name}
                    </Badge>
                  )}
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

              {/* Tabs */}
              <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-6 mt-3 justify-start">
                  <TabsTrigger value="info">Informações</TabsTrigger>
                  <TabsTrigger value="activities">Atividades</TabsTrigger>
                  <TabsTrigger value="tasks">Tarefas</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="flex-1 overflow-auto px-6 py-4 space-y-4 m-0">
                  {/* Contact info */}
                  <div className="space-y-3">
                    {typedLead.email && (
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a href={`mailto:${typedLead.email}`} className="text-primary hover:underline">{typedLead.email}</a>
                      </div>
                    )}
                    {typedLead.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{typedLead.phone}</span>
                      </div>
                    )}
                    {typedLead.company && (
                      <div className="flex items-center gap-3 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{typedLead.company}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>R$ {Number(typedLead.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Assignment & funnel */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      {typedLead.assigned_profile ? (
                        <span className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px]">{typedLead.assigned_profile.full_name?.[0]}</AvatarFallback>
                          </Avatar>
                          {typedLead.assigned_profile.full_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sem responsável</span>
                      )}
                    </div>
                    {typedLead.funnel && (
                      <div className="flex items-center gap-3 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{typedLead.funnel.name}</span>
                      </div>
                    )}
                    {typedLead.source && (
                      <div className="flex items-center gap-3 text-sm">
                        <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>Fonte: {typedLead.source}</span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {typedLead.tags?.length > 0 && (
                    <>
                      <Separator />
                      <div className="flex flex-wrap gap-1.5">
                        {typedLead.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
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
                  {typedLead.notes && (
                    <>
                      <Separator />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Notas</p>
                        <p className="text-sm whitespace-pre-wrap">{typedLead.notes}</p>
                      </div>
                    </>
                  )}

                  {/* Custom fields */}
                  {typedLead.custom_field_values && typedLead.custom_field_values.length > 0 && customFields && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Campos Personalizados</p>
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
                </TabsContent>

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
