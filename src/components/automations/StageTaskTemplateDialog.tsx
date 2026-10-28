import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, CheckSquare, Globe, ArrowRightLeft, GitBranch } from 'lucide-react';
import { useFunnels } from '@/hooks/useFunnels';
import { useStages } from '@/hooks/useStages';
import { useTaskTypes } from '@/hooks/useTaskTypes';
import type { StageTaskTemplate } from '@/types';

const schema = z.object({
  trigger_type: z.enum(['stage_enter', 'status_change']),
  funnel_id: z.string().optional(),
  stage_id: z.string().optional(),
  trigger_status: z.string().optional(),
  action_type: z.enum(['create_task', 'send_webhook', 'move_lead']),
  title: z.string().min(1, 'Título obrigatório'),
  description: z.string().optional(),
  task_type: z.string().min(1),
  priority: z.string().min(1),
  due_hours: z.coerce.number().min(1, 'Mínimo 1 hora'),
  assign_to_lead_owner: z.boolean(),
  webhook_url: z.string().optional(),
  webhook_secret: z.string().optional(),
  target_funnel_id: z.string().optional(),
  target_stage_id: z.string().optional(),
}).refine((data) => {
  if (data.trigger_type === 'stage_enter') return !!data.funnel_id && !!data.stage_id;
  return true;
}, { message: 'Selecione um funil e etapa', path: ['funnel_id'] })
.refine((data) => {
  if (data.trigger_type === 'status_change') return !!data.trigger_status;
  return true;
}, { message: 'Selecione o status gatilho', path: ['trigger_status'] })
.refine((data) => {
  if (data.action_type === 'send_webhook') return !!data.webhook_url && data.webhook_url.startsWith('http');
  return true;
}, { message: 'URL do webhook é obrigatória', path: ['webhook_url'] })
.refine((data) => {
  if (data.action_type === 'move_lead') return !!data.target_funnel_id;
  return true;
}, { message: 'Selecione o funil destino', path: ['target_funnel_id'] });

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: FormValues) => void;
  template?: StageTaskTemplate | null;
  loading?: boolean;
  defaultFunnelId?: string;
}

const statusLabels: Record<string, string> = {
  open: 'Aberto',
  won: 'Ganho',
  inactive: 'Inativo',
};

export function StageTaskTemplateDialog({ open, onOpenChange, onSubmit, template, loading, defaultFunnelId }: Props) {
  const { data: funnels } = useFunnels();
  const { data: taskTypes } = useTaskTypes();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      trigger_type: 'stage_enter',
      funnel_id: '',
      stage_id: '',
      trigger_status: '',
      action_type: 'create_task',
      title: '',
      description: '',
      task_type: 'follow_up',
      priority: 'medium',
      due_hours: 24,
      assign_to_lead_owner: true,
      webhook_url: '',
      webhook_secret: '',
      target_funnel_id: '',
      target_stage_id: '',
    },
  });

  const triggerType = form.watch('trigger_type');
  const selectedFunnelId = form.watch('funnel_id');
  const actionType = form.watch('action_type');
  const targetFunnelId = form.watch('target_funnel_id');
  const { data: stages } = useStages(selectedFunnelId || undefined);
  const { data: targetStages } = useStages(targetFunnelId || undefined);

  useEffect(() => {
    if (template) {
      const stageObj = stages?.find(s => s.id === template.stage_id);
      form.reset({
        trigger_type: (template.trigger_type as 'stage_enter' | 'status_change') || 'stage_enter',
        funnel_id: stageObj?.funnel_id || defaultFunnelId || '',
        stage_id: template.stage_id || '',
        trigger_status: template.trigger_status || '',
        action_type: template.action_type || 'create_task',
        title: template.title,
        description: template.description || '',
        task_type: template.task_type,
        priority: template.priority,
        due_hours: template.due_hours,
        assign_to_lead_owner: template.assign_to_lead_owner,
        webhook_url: template.webhook_url || '',
        webhook_secret: template.webhook_secret || '',
        target_funnel_id: template.target_funnel_id || '',
        target_stage_id: template.target_stage_id || '',
      });
    } else {
      form.reset({
        trigger_type: 'stage_enter',
        funnel_id: defaultFunnelId || '',
        stage_id: '',
        trigger_status: '',
        action_type: 'create_task',
        title: '',
        description: '',
        task_type: 'follow_up',
        priority: 'medium',
        due_hours: 24,
        assign_to_lead_owner: true,
        webhook_url: '',
        webhook_secret: '',
        target_funnel_id: '',
        target_stage_id: '',
      });
    }
  }, [template, open, defaultFunnelId]);

  const isWebhook = actionType === 'send_webhook';
  const isMoveLead = actionType === 'move_lead';
  const isStageEnter = triggerType === 'stage_enter';

  const actionIcon = isWebhook
    ? <Globe className="h-4 w-4 text-emerald-500" />
    : isMoveLead
    ? <ArrowRightLeft className="h-4 w-4 text-violet-500" />
    : <CheckSquare className="h-4 w-4 text-primary" />;

  const actionLabel = isWebhook ? 'Webhook' : isMoveLead ? 'Mover Negócio' : 'Tarefa';
  const actionBg = isWebhook ? 'bg-emerald-500/5' : isMoveLead ? 'bg-violet-500/5' : 'bg-primary/5';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template ? 'Editar Automação' : 'Nova Automação'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Visual flow blocks */}
            <div className="flex items-stretch rounded-lg border overflow-hidden">
              {/* TRIGGER block */}
              <div className="flex-1 p-3 space-y-3 bg-amber-500/5">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quando</span>
                </div>

                <FormField control={form.control} name="trigger_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Tipo de gatilho</FormLabel>
                    <Select value={field.value} onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue('funnel_id', '');
                      form.setValue('stage_id', '');
                      form.setValue('trigger_status', '');
                    }}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="stage_enter">
                          <span className="flex items-center gap-2">
                            <GitBranch className="h-3.5 w-3.5" /> Negócio entra em etapa
                          </span>
                        </SelectItem>
                        <SelectItem value="status_change">
                          <span className="flex items-center gap-2">
                            <ArrowRightLeft className="h-3.5 w-3.5" /> Negócio muda de status
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                {isStageEnter ? (
                  <>
                    <FormField control={form.control} name="funnel_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Funil</FormLabel>
                        <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue('stage_id', ''); }}>
                          <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {funnels?.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="stage_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Etapa</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={!selectedFunnelId}>
                          <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {stages?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </>
                ) : (
                  <FormField control={form.control} name="trigger_status" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Status do negócio</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="open">Aberto</SelectItem>
                          <SelectItem value="won">Ganho</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center w-10 bg-muted/30 shrink-0">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* ACTION block */}
              <div className={`flex-1 p-3 space-y-3 ${actionBg}`}>
                <div className="flex items-center gap-2">
                  {actionIcon}
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Então</span>
                </div>

                <FormField control={form.control} name="action_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Tipo de ação</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="create_task">
                          <span className="flex items-center gap-2">
                            <CheckSquare className="h-3.5 w-3.5" /> Criar Tarefa
                          </span>
                        </SelectItem>
                        <SelectItem value="send_webhook">
                          <span className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5" /> Disparar Webhook
                          </span>
                        </SelectItem>
                        <SelectItem value="move_lead">
                          <span className="flex items-center gap-2">
                            <ArrowRightLeft className="h-3.5 w-3.5" /> Mover Negócio de Funil
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      {isWebhook ? 'Nome da automação' : isMoveLead ? 'Nome da automação' : 'Título da tarefa'}
                    </FormLabel>
                    <FormControl>
                      <Input className="h-8 text-xs" placeholder={isWebhook ? 'Ex: Notificar ERP' : isMoveLead ? 'Ex: Mover para Pós-venda' : 'Ex: Ligar para o negócio'} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {isWebhook ? (
                  <>
                    <FormField control={form.control} name="webhook_url" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">URL do Webhook</FormLabel>
                        <FormControl><Input className="h-8 text-xs font-mono" placeholder="https://..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="webhook_secret" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Secret (opcional)</FormLabel>
                        <FormControl><Input className="h-8 text-xs font-mono" placeholder="Para assinatura HMAC" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </>
                ) : isMoveLead ? (
                  <>
                    <FormField control={form.control} name="target_funnel_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Funil destino</FormLabel>
                        <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue('target_stage_id', ''); }}>
                          <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {funnels?.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="target_stage_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Etapa destino (opcional)</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange} disabled={!targetFunnelId}>
                          <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Primeira etapa" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {targetStages?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <FormField control={form.control} name="task_type" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Tipo</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {taskTypes?.filter(t => t.is_active || t.code === field.value).map(t => (
                              <SelectItem key={t.id} value={t.code}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="priority" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Prioridade</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="medium">Média</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                            <SelectItem value="urgent">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                )}
              </div>
            </div>

            {/* Additional fields for create_task */}
            {!isWebhook && !isMoveLead && (
              <>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Descrição (opcional)</FormLabel>
                    <FormControl><Textarea className="text-xs min-h-[60px]" {...field} /></FormControl>
                  </FormItem>
                )} />

                <div className="flex items-center gap-4">
                  <FormField control={form.control} name="due_hours" render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-xs">Prazo (horas)</FormLabel>
                      <FormControl><Input type="number" min={1} className="h-8 text-xs" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="assign_to_lead_owner" render={({ field }) => (
                    <FormItem className="flex items-center gap-2 pt-5">
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="text-xs !mt-0">Atribuir ao responsável do negócio</FormLabel>
                    </FormItem>
                  )} />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{template ? 'Salvar' : 'Criar Automação'}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
