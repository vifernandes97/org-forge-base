import { useState } from 'react';
import { QuickActivityForm } from './activities/QuickActivityForm';
import { ActivityTimeline } from './activities/ActivityTimeline';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { PriorityBadge } from './PriorityBadge';
import { useLead, useDeleteLead } from '@/hooks/useLeads';
import { useCustomFields } from '@/hooks/useCustomFields';
import { LeadFormDialog } from './LeadFormDialog';
import { Pencil, Trash2, Clock, AlertTriangle, Building2, Mail, Phone, Tag, User, DollarSign, FileText } from 'lucide-react';
import { differenceInHours, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import type { LeadWithRelations } from '@/types';

interface LeadDetailSheetProps {
  leadId: string | null;
  onClose: () => void;
}

export function LeadDetailSheet({ leadId, onClose }: LeadDetailSheetProps) {
  const { data: lead, isLoading } = useLead(leadId || undefined);
  const { data: customFields } = useCustomFields();
  const deleteLead = useDeleteLead();
  const [editOpen, setEditOpen] = useState(false);

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

  const typedLead = lead as LeadWithRelations | undefined;

  // SLA calculation
  const hoursInStage = typedLead?.stage_entered_at
    ? differenceInHours(new Date(), new Date(typedLead.stage_entered_at))
    : 0;
  const slaHours = (typedLead as any)?.stage?.sla_hours;
  const slaExceeded = slaHours && hoursInStage > slaHours;

  return (
    <>
      <Sheet open={!!leadId} onOpenChange={open => { if (!open) onClose(); }}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
          {isLoading || !typedLead ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">Carregando...</div>
          ) : (
            <>
              {/* Header */}
              <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <SheetTitle className="text-xl leading-tight">{typedLead.name}</SheetTitle>
                  <div className="flex gap-1.5 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
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

                <TabsContent value="tasks" className="flex-1 flex items-center justify-center m-0">
                  <p className="text-muted-foreground text-sm">🚧 Em construção — Sprint 6</p>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {typedLead && (
        <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} lead={typedLead} />
      )}
    </>
  );
}
