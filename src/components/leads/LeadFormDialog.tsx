import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useFunnels } from '@/hooks/useFunnels';
import { useStages } from '@/hooks/useStages';
import { useCustomFields } from '@/hooks/useCustomFields';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useCreateLead, useUpdateLead } from '@/hooks/useLeads';
import { useCreateActivity } from '@/hooks/useActivities';
import { useAuth } from '@/contexts/AuthContext';
import { CustomFieldRenderer } from '@/components/custom-fields/CustomFieldRenderer';
import { TagsInput } from './TagsInput';
import { toast } from 'sonner';
import type { LeadWithRelations, LeadPriority } from '@/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const priorities: { value: LeadPriority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: LeadWithRelations | null;
}

export function LeadFormDialog({ open, onOpenChange, lead }: LeadFormDialogProps) {
  const { organization } = useOrganization();
  const { data: funnels } = useFunnels();
  const { data: customFields } = useCustomFields();
  const { data: members } = useOrgMembers();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const createActivityMut = useCreateActivity();
  const { user } = useAuth();

  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const { data: stages } = useStages(selectedFunnelId || undefined);

  const isEditing = !!lead;

  // Set initial funnel
  useEffect(() => {
    if (open) {
      if (lead?.funnel_id) {
        setSelectedFunnelId(lead.funnel_id);
      } else if (funnels?.[0]) {
        setSelectedFunnelId(funnels[0].id);
      }
    }
  }, [open, lead, funnels]);

  const baseSchema = z.object({
    name: z.string().min(2, 'Nome é obrigatório'),
    email: z.string().email('Email inválido').or(z.literal('')).optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    company_name: z.string().optional(),
    company_instagram: z.string().optional(),
    funnel_id: z.string().min(1, 'Selecione um funil'),
    stage_id: z.string().min(1, 'Selecione uma etapa'),
    assigned_to: z.string().optional(),
    value: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    qualification: z.string().optional(),
    source: z.string().optional(),
    tags: z.array(z.string()),
    notes: z.string().optional(),
  });

  const activeFields = useMemo(() => customFields?.filter(f => f.is_active) || [], [customFields]);

  const form = useForm({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      company: '',
      company_name: '',
      company_instagram: '',
      funnel_id: '',
      stage_id: '',
      assigned_to: '',
      value: '0',
      priority: 'medium' as LeadPriority,
      source: '',
      tags: [] as string[],
      notes: '',
    },
  });

  const [cfValues, setCfValues] = useState<Record<string, string>>({});

  // Reset form when opening
  useEffect(() => {
    if (open) {
      if (lead) {
        form.reset({
          name: lead.name,
          email: lead.email || '',
          phone: lead.phone || '',
          company: lead.company || '',
          company_name: (lead as any).company_name || '',
          company_instagram: (lead as any).company_instagram || '',
          funnel_id: lead.funnel_id,
          stage_id: lead.stage_id,
          assigned_to: lead.assigned_to || '',
          value: String(lead.value || 0),
          priority: lead.priority,
          source: lead.source || '',
          tags: lead.tags || [],
          notes: lead.notes || '',
        });
        // Load custom field values
        const vals: Record<string, string> = {};
        lead.custom_field_values?.forEach(v => { vals[v.field_definition_id] = v.value || ''; });
        setCfValues(vals);
      } else {
        form.reset();
        setCfValues({});
      }
    }
  }, [open, lead, form]);

  // Auto-select first stage when funnel changes
  useEffect(() => {
    if (stages?.length && !isEditing) {
      const currentStageId = form.getValues('stage_id');
      const stageInFunnel = stages.find(s => s.id === currentStageId);
      if (!stageInFunnel) {
        form.setValue('stage_id', stages[0].id);
      }
    }
  }, [stages, isEditing, form]);

  const onSubmit = async (data: z.infer<typeof baseSchema>) => {
    if (!organization) return;

    // Validate required custom fields
    const missingRequired = activeFields.filter(f => f.is_required && !cfValues[f.id]?.trim());
    if (missingRequired.length > 0) {
      toast.error(`Preencha os campos obrigatórios: ${missingRequired.map(f => f.field_label).join(', ')}`);
      return;
    }

    const customFieldsData = activeFields
      .filter(f => cfValues[f.id] !== undefined)
      .map(f => ({ field_definition_id: f.id, value: cfValues[f.id] || null }));

    try {
      if (isEditing && lead) {
        await updateLead.mutateAsync({
          id: lead.id,
          updates: {
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            company: data.company || null,
            company_name: data.company_name || null,
            company_instagram: data.company_instagram || null,
            funnel_id: data.funnel_id,
            stage_id: data.stage_id,
            assigned_to: data.assigned_to || null,
            value: parseFloat(data.value || '0'),
            priority: data.priority,
            source: data.source || null,
            tags: data.tags,
            notes: data.notes || null,
          },
          customFields: customFieldsData,
        });

        // Auto-register field_update activity
        if (user && organization) {
          const changes: { field: string; old_value: any; new_value: any }[] = [];
          const fields = ['name', 'email', 'phone', 'company', 'company_name', 'company_instagram', 'priority', 'source', 'notes'] as const;
          fields.forEach(f => {
            const oldVal = lead[f] || '';
            const newVal = (data as any)[f] || '';
            if (oldVal !== newVal) changes.push({ field: f, old_value: oldVal, new_value: newVal });
          });
          const oldValue = String(lead.value || 0);
          const newValue = data.value || '0';
          if (oldValue !== newValue) changes.push({ field: 'value', old_value: oldValue, new_value: newValue });

          if (changes.length > 0) {
            createActivityMut.mutate({
              organization_id: organization.id,
              lead_id: lead.id,
              user_id: user.id,
              activity_type: 'field_update',
              title: `Atualizou informações do lead`,
              metadata: { changes },
            });
          }
        }

        toast.success('Lead atualizado!');
      } else {
        await createLead.mutateAsync({
          lead: {
            organization_id: organization.id,
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            company: data.company || null,
            company_name: data.company_name || null,
            company_instagram: data.company_instagram || null,
            funnel_id: data.funnel_id,
            stage_id: data.stage_id,
            assigned_to: data.assigned_to || null,
            value: parseFloat(data.value || '0'),
            priority: data.priority,
            source: data.source || null,
            tags: data.tags,
            notes: data.notes || null,
          },
          customFields: customFieldsData,
        });
        toast.success('Lead criado!');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar lead');
    }
  };

  const isLoading = createLead.isPending || updateLead.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{isEditing ? 'Editar Lead' : 'Novo Lead'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)] px-6">
          <form id="lead-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
            {/* Basic fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input {...form.register('name')} placeholder="Nome do lead" />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input {...form.register('email')} type="email" placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Controller
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <Input
                      value={field.value}
                      placeholder="(00) 00000-0000"
                      onChange={e => {
                        let v = e.target.value.replace(/\D/g, '').slice(0, 11);
                        if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
                        else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
                        else if (v.length > 0) v = `(${v}`;
                        field.onChange(v);
                      }}
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Input {...form.register('company')} placeholder="Nome da empresa" />
              </div>
              <div className="space-y-1.5">
                <Label>Razão Social</Label>
                <Input {...form.register('company_name')} placeholder="Razão social da empresa" />
              </div>
              <div className="space-y-1.5">
                <Label>Instagram</Label>
                <Input {...form.register('company_instagram')} placeholder="@empresa" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Funil *</Label>
                <Controller
                  control={form.control}
                  name="funnel_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={v => { field.onChange(v); setSelectedFunnelId(v); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {funnels?.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Etapa *</Label>
                <Controller
                  control={form.control}
                  name="stage_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {stages?.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                              {s.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Controller
                  control={form.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <Select value={field.value || "none"} onValueChange={v => field.onChange(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {members?.map(m => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            <span className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[10px]">{m.profile?.full_name?.[0] || '?'}</AvatarFallback>
                              </Avatar>
                              {m.profile?.full_name || m.profile?.email}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input className="pl-10" {...form.register('value')} placeholder="0,00" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fonte</Label>
                <Input {...form.register('source')} placeholder="Ex: manual, formulário, indicação" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tags</Label>
              <Controller
                control={form.control}
                name="tags"
                render={({ field }) => <TagsInput value={field.value} onChange={field.onChange} />}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea {...form.register('notes')} placeholder="Observações sobre o lead..." rows={3} />
            </div>

            {/* Custom Fields */}
            {activeFields.length > 0 && (
              <>
                <Separator />
                <h3 className="text-sm font-semibold text-muted-foreground">Campos Personalizados</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeFields.map(cf => (
                    <div key={cf.id} className="space-y-1.5">
                      <Label>{cf.field_label}{cf.is_required && ' *'}</Label>
                      <CustomFieldRenderer
                        field={cf}
                        value={cfValues[cf.id] || ''}
                        onChange={v => setCfValues(prev => ({ ...prev, [cf.id]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </form>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
          <Button type="submit" form="lead-form" disabled={isLoading}>
            {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
