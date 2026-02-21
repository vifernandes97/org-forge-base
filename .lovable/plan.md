

# Sistema de Historico de Atividades dos Leads

## Resumo
Criar a tabela `lead_activities` com RLS multi-tenant, timeline visual na aba "Atividades" do sheet do lead, formulario rapido para registrar atividades manuais (nota, ligacao, email, reuniao), e registro automatico de atividades ao mover etapa no Kanban e ao editar o lead.

## 1. Migration SQL

### Tabela lead_activities

```sql
CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  activity_type text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for activity_type
CREATE OR REPLACE FUNCTION public.validate_activity_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.activity_type NOT IN ('note','call','email','meeting','stage_change','field_update','task_created','task_completed') THEN
    RAISE EXCEPTION 'Invalid activity_type: %', NEW.activity_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_activity_type_trigger
  BEFORE INSERT OR UPDATE ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.validate_activity_type();

-- Indexes
CREATE INDEX idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX idx_lead_activities_created_at ON public.lead_activities(created_at DESC);

-- RLS
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view activities" ON public.lead_activities
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin/member can insert activities" ON public.lead_activities
  FOR INSERT WITH CHECK (
    get_user_org_role(organization_id) IN ('owner','admin','member')
  );

CREATE POLICY "Owner/admin can delete activities" ON public.lead_activities
  FOR DELETE USING (
    get_user_org_role(organization_id) IN ('owner','admin')
  );
```

## 2. Tipos TypeScript

### `src/types/index.ts`
Adicionar:

```text
ActivityType = 'note' | 'call' | 'email' | 'meeting' | 'stage_change' | 'field_update' | 'task_created' | 'task_completed'

LeadActivity {
  id, organization_id, lead_id, user_id, activity_type, title, description, metadata, created_at
}

LeadActivityWithUser extends LeadActivity {
  user?: Profile
}
```

## 3. Services

### `src/services/activities.ts` (criar)
- `getLeadActivities(leadId, page, pageSize)` -- lista atividades com join em profiles, paginada, order by created_at DESC
- `createActivity(data: { organization_id, lead_id, user_id, activity_type, title, description?, metadata? })` -- insert
- `createActivityAndUpdateLead(data)` -- insere atividade + update last_activity_at do lead (no mesmo fluxo)

## 4. Hooks

### `src/hooks/useActivities.ts` (criar)
- `useLeadActivities(leadId, page, pageSize)` -- useQuery com queryKey `['lead-activities', leadId, page]`
- `useCreateActivity()` -- useMutation que insere atividade + invalida queries de atividades e lead detail

## 5. Componentes

### `src/components/leads/activities/ActivityTimeline.tsx` (criar)
Timeline vertical com linha a esquerda conectando os itens:
- Cada item: icone colorido do tipo, titulo, descricao (expand/collapse se longa), avatar+nome do autor, data relativa
- Botao "Carregar mais" no final se houver mais paginas
- Icones por tipo:
  - note: MessageSquare (cinza)
  - call: Phone (verde)
  - email: Mail (azul)
  - meeting: Calendar (roxo)
  - stage_change: ArrowRight (amarelo)
  - field_update: Edit (cinza)
  - task_created: CheckSquare (laranja)
  - task_completed: CheckCircle (verde)

### `src/components/leads/activities/QuickActivityForm.tsx` (criar)
Card no topo da timeline com 4 botoes rapidos (Nota, Ligacao, Email, Reuniao). Ao clicar:
- Nota: textarea simples
- Ligacao: textarea + input de duracao (minutos)
- Email: textarea + input de assunto
- Reuniao: textarea + input de data/hora
Ao submeter: criar atividade + atualizar last_activity_at do lead.

### `src/components/leads/activities/ActivityIcon.tsx` (criar)
Componente que retorna o icone lucide + cor adequados para cada activity_type.

## 6. Integracoes com codigo existente

### `src/components/leads/LeadDetailSheet.tsx` (editar)
- Substituir placeholder "Em construcao - Sprint 5" pela timeline real:
  - Renderizar `<QuickActivityForm>` + `<ActivityTimeline>` na aba "Atividades"

### `src/hooks/useLeads.ts` (editar)
- No `useMoveLeadToStage`: apos mover o lead, criar atividade automatica de tipo `stage_change` com metadata contendo from/to stage names
  - Para obter os nomes das etapas, usar os dados do cache do TanStack Query (stages ja estao carregados)

### `src/components/leads/LeadFormDialog.tsx` (editar)
- No `onSubmit` de edicao: apos atualizar o lead, criar atividade automatica de tipo `field_update` com titulo "Atualizou informacoes do lead" e metadata com os campos alterados
  - Comparar valores antigos (do `lead` prop) com novos para determinar quais campos mudaram

## Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| supabase/migrations/xxx.sql | Criar |
| src/types/index.ts | Editar (ActivityType, LeadActivity) |
| src/services/activities.ts | Criar |
| src/hooks/useActivities.ts | Criar |
| src/components/leads/activities/ActivityIcon.tsx | Criar |
| src/components/leads/activities/ActivityTimeline.tsx | Criar |
| src/components/leads/activities/QuickActivityForm.tsx | Criar |
| src/components/leads/LeadDetailSheet.tsx | Editar (substituir placeholder) |
| src/hooks/useLeads.ts | Editar (auto-activity no move) |
| src/components/leads/LeadFormDialog.tsx | Editar (auto-activity no update) |

## Detalhes Tecnicos

### Atividade automatica no drag-and-drop
No `useMoveLeadToStage`, adicionar no `onSuccess`:
- Buscar nomes das etapas (from/to) do cache de stages
- Chamar `createActivity` com activity_type='stage_change', title="Moveu de {from} para {to}", metadata com IDs e nomes

### Atividade automatica na edicao
No `LeadFormDialog.onSubmit` (modo edicao), apos sucesso:
- Comparar lead original com valores novos
- Se houve mudancas, criar atividade com activity_type='field_update' e metadata listando os campos alterados

### Paginacao da timeline
Usar estado local `page` no componente, comecar em 0, incrementar ao clicar "Carregar mais". Cada pagina busca 20 atividades. Concatenar resultados anteriores com novos.

### Data relativa
Usar `formatDistanceToNow` do date-fns com locale ptBR para exibir "ha 5 min", "ha 2 horas", etc.

