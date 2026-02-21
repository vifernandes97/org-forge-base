

# Modulo de Leads

## Resumo
Criar o modulo completo de Leads para o CRM multi-tenant, incluindo tabela no banco com RLS, FK na custom_field_values, pagina de listagem, formulario de criacao/edicao com campos personalizados dinamicos, e sheet de detalhe do lead.

## 1. Migration SQL

### Tabela leads
- id, organization_id (FK), funnel_id (FK), stage_id (FK), name, email, phone, company, assigned_to (FK profiles), value (numeric 12,2), tags (text[]), source, priority (CHECK), notes, created_at, updated_at, last_activity_at, stage_entered_at
- Trigger update_updated_at_column
- Trigger para atualizar last_activity_at em qualquer UPDATE
- Trigger para atualizar stage_entered_at quando stage_id muda
- Indices em organization_id, funnel_id, stage_id, assigned_to, created_at, last_activity_at, priority

### FK na custom_field_values
- `ALTER TABLE custom_field_values ADD CONSTRAINT fk_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE`

### RLS (PERMISSIVE)
- SELECT: `organization_id IN (SELECT get_user_org_ids())`
- INSERT: `get_user_org_role(organization_id) IN ('owner','admin','member')`
- UPDATE: `get_user_org_role(organization_id) IN ('owner','admin','member')`
- DELETE: `get_user_org_role(organization_id) IN ('owner','admin')`

### Trigger para stage_entered_at e last_activity_at

```sql
CREATE OR REPLACE FUNCTION public.update_lead_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.last_activity_at = now();
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    NEW.stage_entered_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_lead_timestamps_trigger
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_lead_timestamps();
```

### SQL completo

```sql
-- Priority validation via trigger (not CHECK, for immutability safety)
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  funnel_id uuid NOT NULL REFERENCES public.funnels(id),
  stage_id uuid NOT NULL REFERENCES public.stages(id),
  name text NOT NULL,
  email text,
  phone text,
  company text,
  assigned_to uuid REFERENCES public.profiles(id),
  value numeric(12,2) NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  source text,
  priority text NOT NULL DEFAULT 'medium',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  stage_entered_at timestamptz NOT NULL DEFAULT now()
);

-- Priority validation trigger
CREATE OR REPLACE FUNCTION public.validate_lead_priority()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.priority NOT IN ('low','medium','high','urgent') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_lead_priority_trigger
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.validate_lead_priority();

-- Timestamp triggers
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_lead_timestamps()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.last_activity_at = now();
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    NEW.stage_entered_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_lead_timestamps_trigger
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_lead_timestamps();

-- Indexes
CREATE INDEX idx_leads_organization_id ON public.leads(organization_id);
CREATE INDEX idx_leads_funnel_id ON public.leads(funnel_id);
CREATE INDEX idx_leads_stage_id ON public.leads(stage_id);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_created_at ON public.leads(created_at);
CREATE INDEX idx_leads_last_activity_at ON public.leads(last_activity_at);
CREATE INDEX idx_leads_priority ON public.leads(priority);

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view leads" ON public.leads
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin/member can insert leads" ON public.leads
  FOR INSERT WITH CHECK (
    get_user_org_role(organization_id) IN ('owner','admin','member')
  );

CREATE POLICY "Owner/admin/member can update leads" ON public.leads
  FOR UPDATE USING (
    get_user_org_role(organization_id) IN ('owner','admin','member')
  );

CREATE POLICY "Owner/admin can delete leads" ON public.leads
  FOR DELETE USING (
    get_user_org_role(organization_id) IN ('owner','admin')
  );

-- Add FK to custom_field_values
ALTER TABLE public.custom_field_values
  ADD CONSTRAINT fk_lead
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;
```

## 2. Tipos TypeScript

### `src/types/index.ts`
Adicionar:

```text
LeadPriority = 'low' | 'medium' | 'high' | 'urgent'

Lead {
  id, organization_id, funnel_id, stage_id, name, email, phone, company,
  assigned_to, value, tags, source, priority, notes,
  created_at, updated_at, last_activity_at, stage_entered_at
}

LeadWithRelations extends Lead {
  stage?: Stage
  funnel?: Funnel
  assigned_profile?: Profile
  custom_field_values?: CustomFieldValue[]
}
```

## 3. Services

### `src/services/leads.ts`
- `getLeads(orgId, filters?)` -- lista leads com joins opcionais (stage, funnel, assigned_to profile)
- `getLead(id)` -- detalhe com joins: stage, funnel, profiles (assigned_to), custom_field_values
- `createLead(data)` -- insert lead
- `updateLead(id, data)` -- update lead
- `deleteLead(id)` -- delete
- `upsertCustomFieldValues(leadId, values: {field_definition_id, value}[])` -- upsert batch dos custom field values

## 4. Hooks

### `src/hooks/useLeads.ts`
- `useLeads(filters?)` -- useQuery com orgId do contexto
- `useLead(id)` -- useQuery com joins
- `useCreateLead()` -- useMutation + invalidate leads
- `useUpdateLead()` -- useMutation + invalidate leads + lead detail
- `useDeleteLead()` -- useMutation + invalidate leads

### `src/hooks/useOrgMembers.ts`
- `useOrgMembers()` -- lista membros da org com perfil (para select de responsavel)

## 5. Componentes

### `src/components/leads/LeadFormDialog.tsx`
Modal de criacao/edicao com duas secoes:
- Secao 1: campos fixos (nome, email, telefone, empresa, funil, etapa, responsavel, valor, prioridade, fonte, tags, notas)
- Secao 2: campos personalizados usando CustomFieldRenderer
- Validacao com zod (schema dinamico combinando fixos + personalizados)
- Ao mudar funil, recarregar etapas daquele funil e selecionar a primeira
- Tags como input com chips (Enter para adicionar, X para remover)
- Prioridade com cores: low=cinza, medium=azul, high=laranja, urgent=vermelho

### `src/components/leads/LeadDetailSheet.tsx`
Sheet lateral (Drawer) com:
- Header: nome editavel inline, badge prioridade, badge etapa, botoes editar/deletar
- Tabs: "Informacoes", "Atividades" (placeholder), "Tarefas" (placeholder)
- Aba Informacoes: todos os campos organizados, campos personalizados, avatar do responsavel, tempo na etapa (com alerta SLA)

### `src/components/leads/LeadCard.tsx`
Card compacto para a listagem de leads (nome, empresa, valor, prioridade badge, etapa badge, responsavel avatar).

### `src/components/leads/PriorityBadge.tsx`
Componente de badge de prioridade com cores.

### `src/components/leads/TagsInput.tsx`
Input de tags com chips.

## 6. Pagina

### `src/pages/LeadsPage.tsx` (rota `/leads`)
- Header com titulo e botao "Novo Lead"
- Listagem simples em tabela/cards dos leads da org
- Clique no lead abre LeadDetailSheet
- Filtros basicos (sera expandido em sprints futuros)

## 7. Sidebar

### `src/components/layout/AppSidebar.tsx`
Substituir "Contatos" por "Leads" no mainNav, apontando para `/leads`.

## 8. Rotas

### `src/App.tsx`
Adicionar rotas:
- `/leads` -> PrivateRoute + MainLayout + LeadsPage
- Remover ou redirecionar `/contacts` para `/leads`

## Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/xxx.sql` | Criar |
| `src/types/index.ts` | Editar (Lead, LeadPriority, LeadWithRelations) |
| `src/services/leads.ts` | Criar |
| `src/hooks/useLeads.ts` | Criar |
| `src/hooks/useOrgMembers.ts` | Criar |
| `src/components/leads/LeadFormDialog.tsx` | Criar |
| `src/components/leads/LeadDetailSheet.tsx` | Criar |
| `src/components/leads/LeadCard.tsx` | Criar |
| `src/components/leads/PriorityBadge.tsx` | Criar |
| `src/components/leads/TagsInput.tsx` | Criar |
| `src/pages/LeadsPage.tsx` | Criar |
| `src/components/layout/AppSidebar.tsx` | Editar (Contatos -> Leads) |
| `src/App.tsx` | Editar (adicionar rotas /leads) |

## Detalhes Tecnicos

### Formulario com schema zod dinamico
O schema do formulario sera gerado em runtime combinando campos fixos com campos personalizados ativos da org:

```text
baseSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  funnel_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  assigned_to: z.string().uuid().optional().or(z.literal('')),
  value: z.number().min(0).default(0),
  priority: z.enum(['low','medium','high','urgent']),
  source: z.string().optional(),
  tags: z.array(z.string()),
  notes: z.string().optional(),
})

Para cada custom field ativo:
- is_required + text/url/email/phone -> z.string().min(1)
- is_required + number/currency -> z.string().min(1) (armazenado como texto)
- is_required + select -> z.string().min(1)
- is_required + checkbox -> z.string() (sempre tem valor)
- nao obrigatorio -> z.string().optional()
```

### Upsert de custom field values
Ao salvar lead, apos o insert/update do lead, fazer upsert batch dos custom_field_values:

```text
supabase.from('custom_field_values')
  .upsert(values, { onConflict: 'lead_id,field_definition_id' })
```

### Calculo de SLA no detalhe
No LeadDetailSheet, calcular tempo na etapa:
- `hoursInStage = differenceInHours(now, lead.stage_entered_at)`
- Se stage.sla_hours e hoursInStage > sla_hours, mostrar alerta vermelho

### Listagem de membros para select de responsavel
Buscar organization_members com join em profiles para popular o select de "Responsavel" com avatar e nome.

