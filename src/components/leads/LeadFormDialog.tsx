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
import { CompanyCombobox } from '@/components/companies/CompanyCombobox';
import { CompanyFormDialog } from '@/components/companies/CompanyFormDialog';
import { ContactsPicker } from '@/components/companies/ContactsPicker';
import { setLeadContacts } from '@/services/leadContacts';
import { useQueryClient } from '@tanstack/react-query';
import { getLeadContacts } from '@/lib/leadDisplay';

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
  /** Funnel preselected when creating a new deal */
  defaultFunnelId?: string;
  /** Company preselected when creating a new deal */
  defaultCompanyId?: string;
}

export function LeadFormDialog({ open, onOpenChange, lead, defaultFunnelId, defaultCompanyId }: LeadFormDialogProps) {
  const { organization } = useOrganization();
  const { data: funnels } = useFunnels();
  const { data: customFields } = useCustomFields();
  const { data: members } = useOrgMembers();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const createActivityMut = useCreateActivity();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(null);
  const [creatingCompany, setCreatingCompany] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState(false);

  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const { data: stages } = useStages(selectedFunnelId || undefined);

  const isEditing = !!lead;

  // Set initial funnel
  useEffect(() => {
    if (open) {
      if (lead?.funnel_id) {
        setSelectedFunnelId(lead.funnel_id);
      } else {
        const fid = (defaultFunnelId && funnels?.some(f => f.id === defaultFunnelId)) ? defaultFunnelId : funnels?.[0]?.id;
        if (fid) {
          setSelectedFunnelId(fid);
          form.setValue('funnel_id', fid);
          form.setValue('stage_id', '');
        }
      }
    }
  }, [open, lead, funnels, defaultFunnelId]);

  const baseSchema = z.object({
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
      funnel_id: '',
      stage_id: '',
      assigned_to: '',
      value: '0',
      priority: 'medium' as LeadPriority,
      qualification: '',
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
          funnel_id: lead.funnel_id,
          stage_id: lead.stage_id,
          assigned_to: lead.assigned_to || '',
          value: String(lead.value || 0),
          priority: lead.priority,
          qualification: String((lead as any).qualification || ''),
          source: lead.source || '',
          tags: lead.tags || [],
          notes: lead.notes || '',
        });
        // Load custom field values
        const vals: Record<string, string> = {};
        lead.custom_field_values?.forEach(v => { vals[v.field_definition_id] = v.value || ''; });
        setCfValues(vals);
        setCompanyId(lead.company_id || null);
        const links = getLeadContacts(lead);
        setContactIds(links.map(l => l.contact!.id));
        setPrimaryContactId(links.find(l => l.is_primary)?.contact?.id || links[0]?.contact?.id || null);
      } else {
        form.reset();
        setCfValues({});
        setCompanyId(defaultCompanyId || null);
        setContactIds([]);
        setPrimaryContactId(null);
      }
      setCompanyError(false);
    }
  }, [open, lead, form, defaultCompanyId]);

  // Auto-select first stage when funnel changes
  useEffect(() => {
    if (stages?.length && !isEditing) {
      if (selectedFunnelId && form.getValues('funnel_id') !== selectedFunnelId) {
        form.setValue('funnel_id', selectedFunnelId);
      }
      const currentStageId = form.getValues('stage_id');
      const stageInFunnel = stages.find(s => s.id === currentStageId);
      if (!stageInFunnel) {
        form.setValue('stage_id', stages[0].id);
      }
    }
  }, [stages, isEditing, form, selectedFunnelId, open]);

  const onSubmit = async (data: z.infer<typeof baseSchema>) => {
    if (!organization) return;
    if (!companyId) {
      setCompanyError(true);
      toast.error('Escolha a empresa do negócio');
      return;
    }

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
            company_id: companyId,
            funnel_id: data.funnel_id,
            stage_id: data.stage_id,
            assigned_to: data.assigned_to || null,
            value: parseFloat(data.value || '0'),
            priority: data.priority,
            qualification: data.qualification ? parseInt(data.qualification, 10) : null,
            source: data.source || null,
            tags: data.tags,
            notes: data.notes || null,
          },
          customFields: customFieldsData,
        });
        await setLeadContacts(organization.id, lead.id, contactIds, primaryContactId);

        // Auto-register field_update activity
        if (user && organization) {
          const changes: { field: string; old_value: any; new_value: any }[] = [];
          const fields = ['priority', 'source', 'notes'] as const;
          fields.forEach(f => {
            const oldVal = lead[f] || '';
            const newVal = (data as any)[f] || '';
            if (oldVal !== newVal) changes.push({ field: f, old_value: oldVal, new_value: newVal });
          });
          const oldValue = String(lead.value || 0);
          const newValue = data.value || '0';
          if (oldValue !== newValue) changes.push({ field: 'value', old_value: oldValue, new_value: newValue });
          if ((lead.company_id || null) !== companyId) {
            changes.push({ field: 'company', old_value: lead.company?.trade_name || '', new_value: companyId });
          }

          if (changes.length > 0) {
            createActivityMut.mutate({
              organization_id: organization.id,
              lead_id: lead.id,
              user_id: user.id,
              activity_type: 'field_update',
              title: `Atualizou informações do negócio`,
              metadata: { changes },
            });
          }
        }

        toast.success('Negócio atualizado!');
      } else {
        const created = await createLead.mutateAsync({
          lead: {
            organization_id: organization.id,
            company_id: companyId,
            funnel_id: data.funnel_id,
            stage_id: data.stage_id,
            assigned_to: data.assigned_to || null,
            value: parseFloat(data.value || '0'),
            priority: data.priority,
            qualification: data.qualification ? parseInt(data.qualification, 10) : null,
            source: data.source || null,
            tags: data.tags,
            notes: data.notes || null,
          },
          customFields: customFieldsData,
        });
        await setLeadContacts(organization.id, created.id, contactIds, primaryContactId);
        toast.success('Negócio criado!');
      }
      qc.invalidateQueries({ queryKey: ['leads-kanban'] });
      qc.invalidateQueries({ queryKey: ['leads-list'] });
      qc.invalidateQueries({ queryKey: ['lead'] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar negócio');
    }
  };

  const isLoading = createLead.isPending || updateLead.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 max-sm:flex max-sm:flex-col max-sm:pb-[env(safe-area-inset-bottom)]">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{isEditing ? 'Editar Negócio' : 'Novo Negócio'}</DialogTitle>
        </DialogHeader>

        {/* !block: Radix's table wrapper would let wide rows push the form past the dialog width */}
        <ScrollArea className="max-h-[calc(90vh-140px)] px-6 max-sm:max-h-none max-sm:min-h-0 max-sm:flex-1 [&>[data-radix-scroll-area-viewport]>div]:!block">
          <form id="lead-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-4">
            {/* Empresa */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa *</h3>
              <CompanyCombobox
                value={companyId}
                onChange={c => {
                  if (c.id !== companyId) { setContactIds([]); setPrimaryContactId(null); }
                  setCompanyId(c.id);
                  setCompanyError(false);
                }}
                onCreate={name => setCreatingCompany(name)}
              />
              {companyError && <p className="text-xs text-destructive">Empresa é obrigatória</p>}
            </div>

            <Separator />

            {/* Contatos */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contatos</h3>
              <ContactsPicker
                companyId={companyId}
                selectedIds={contactIds}
                primaryId={primaryContactId}
                onChange={(ids, primary) => { setContactIds(ids); setPrimaryContactId(primary); }}
              />
            </div>

            <Separator />

            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Negócio</h3>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Qualificação</Label>
                <Controller
                  control={form.control}
                  name="qualification"
                  render={({ field }) => (
                    <Select value={field.value || '__none__'} onValueChange={v => field.onChange(v === '__none__' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhuma</SelectItem>
                        <SelectItem value="1">1 - Muito Baixa</SelectItem>
                        <SelectItem value="2">2 - Baixa</SelectItem>
                        <SelectItem value="3">3 - Média</SelectItem>
                        <SelectItem value="4">4 - Alta</SelectItem>
                        <SelectItem value="5">5 - Muito Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
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
              <Textarea {...form.register('notes')} placeholder="Observações sobre o negócio..." rows={3} />
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
            {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar negócio'}
          </Button>
        </DialogFooter>
      </DialogContent>
      <CompanyFormDialog
        open={creatingCompany !== null}
        onOpenChange={o => { if (!o) setCreatingCompany(null); }}
        initialName={creatingCompany || ''}
        onCreated={c => {
          if (c.id !== companyId) { setContactIds([]); setPrimaryContactId(null); }
          setCompanyId(c.id);
          setCompanyError(false);
        }}
      />
    </Dialog>
  );
}
