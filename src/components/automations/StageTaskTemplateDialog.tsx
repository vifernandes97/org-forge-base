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
import { ArrowRight, Zap, CheckSquare, Globe } from 'lucide-react';
import { useFunnels } from '@/hooks/useFunnels';
import { useStages } from '@/hooks/useStages';
import type { StageTaskTemplate } from '@/types';

const schema = z.object({
  funnel_id: z.string().min(1, 'Selecione um funil'),
  stage_id: z.string().min(1, 'Selecione uma etapa'),
  action_type: z.enum(['create_task', 'send_webhook']),
  title: z.string().min(1, 'Título obrigatório'),
  description: z.string().optional(),
  task_type: z.string().min(1),
  priority: z.string().min(1),
  due_hours: z.coerce.number().min(1, 'Mínimo 1 hora'),
  assign_to_lead_owner: z.boolean(),
  webhook_url: z.string().optional(),
  webhook_secret: z.string().optional(),
}).refine((data) => {
  if (data.action_type === 'send_webhook') {
    return !!data.webhook_url && data.webhook_url.startsWith('http');
  }
  return true;
}, { message: 'URL do webhook é obrigatória', path: ['webhook_url'] });

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: FormValues) => void;
  template?: StageTaskTemplate | null;
  loading?: boolean;
  defaultFunnelId?: string;
}

export function StageTaskTemplateDialog({ open, onOpenChange, onSubmit, template, loading, defaultFunnelId }: Props) {
  const { data: funnels } = useFunnels();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      funnel_id: '',
      stage_id: '',
      action_type: 'create_task',
      title: '',
      description: '',
      task_type: 'follow_up',
      priority: 'medium',
      due_hours: 24,
      assign_to_lead_owner: true,
      webhook_url: '',
      webhook_secret: '',
    },
  });

  const selectedFunnelId = form.watch('funnel_id');
  const actionType = form.watch('action_type');
  const { data: stages } = useStages(selectedFunnelId || undefined);

  useEffect(() => {
    if (template) {
      const stageObj = stages?.find(s => s.id === template.stage_id);
      form.reset({
        funnel_id: stageObj?.funnel_id || defaultFunnelId || '',
        stage_id: template.stage_id,
        action_type: template.action_type || 'create_task',
        title: template.title,
        description: template.description || '',
        task_type: template.task_type,
        priority: template.priority,
        due_hours: template.due_hours,
        assign_to_lead_owner: template.assign_to_lead_owner,
        webhook_url: template.webhook_url || '',
        webhook_secret: template.webhook_secret || '',
      });
    } else {
      form.reset({
        funnel_id: defaultFunnelId || '',
        stage_id: '',
        action_type: 'create_task',
        title: '',
        description: '',
        task_type: 'follow_up',
        priority: 'medium',
        due_hours: 24,
        assign_to_lead_owner: true,
        webhook_url: '',
        webhook_secret: '',
      });
    }
  }, [template, open, defaultFunnelId]);

  const isWebhook = actionType === 'send_webhook';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template ? 'Editar Automação' : 'Nova Automação'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Action type selector */}
            <FormField control={form.control} name="action_type" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Tipo de ação</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-9">
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
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            {/* Visual flow blocks */}
            <div className="flex items-stretch rounded-lg border overflow-hidden">
              {/* Trigger */}
              <div className="flex-1 p-3 space-y-3 bg-amber-500/5">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gatilho</span>
                </div>
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
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center w-10 bg-muted/30 shrink-0">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Action */}
              <div className={`flex-1 p-3 space-y-3 ${isWebhook ? 'bg-emerald-500/5' : 'bg-primary/5'}`}>
                <div className="flex items-center gap-2">
                  {isWebhook ? <Globe className="h-4 w-4 text-emerald-500" /> : <CheckSquare className="h-4 w-4 text-primary" />}
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {isWebhook ? 'Webhook' : 'Tarefa'}
                  </span>
                </div>

                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{isWebhook ? 'Nome da automação' : 'Título da tarefa'}</FormLabel>
                    <FormControl><Input className="h-8 text-xs" placeholder={isWebhook ? 'Ex: Notificar ERP' : 'Ex: Ligar para o lead'} {...field} /></FormControl>
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
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <FormField control={form.control} name="task_type" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Tipo</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="follow_up">Follow-up</SelectItem>
                            <SelectItem value="call">Ligação</SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="meeting">Reunião</SelectItem>
                            <SelectItem value="other">Outro</SelectItem>
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

            {/* Additional fields */}
            {!isWebhook && (
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
                      <FormLabel className="text-xs !mt-0">Atribuir ao responsável do lead</FormLabel>
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
