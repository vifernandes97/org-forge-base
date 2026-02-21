

# Sistema de Tarefas e Follow-up

## Resumo
Criar a tabela `tasks` com RLS multi-tenant, substituir o placeholder "Em construcao" na aba "Tarefas" do sheet do lead pela lista real de tarefas, criar a pagina `/tasks` com visao geral das tarefas do usuario, adicionar badge de contagem na sidebar, e auto-criar tarefas de follow-up quando um lead muda para uma etapa com SLA.

## 1. Migration SQL

### Tabela tasks

```sql
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'follow_up',
  due_date timestamptz NOT NULL,
  completed_at timestamptz,
  priority text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation triggers (not CHECK constraints)
CREATE OR REPLACE FUNCTION public.validate_task_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.task_type NOT IN ('follow_up','call','email','meeting','other') THEN
    RAISE EXCEPTION 'Invalid task_type: %', NEW.task_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_task_type_trigger
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_type();

CREATE OR REPLACE FUNCTION public.validate_task_priority()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.priority NOT IN ('low','medium','high','urgent') THEN
    RAISE EXCEPTION 'Invalid task priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_task_priority_trigger
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_priority();

-- Updated_at trigger
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_tasks_organization_id ON public.tasks(organization_id);
CREATE INDEX idx_tasks_lead_id ON public.tasks(lead_id);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_completed_at ON public.tasks(completed_at);

-- RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tasks" ON public.tasks
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin/member can insert tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    get_user_org_role(organization_id) IN ('owner','admin','member')
  );

CREATE POLICY "Owner/admin/member can update tasks" ON public.tasks
  FOR UPDATE USING (
    get_user_org_role(organization_id) IN ('owner','admin','member')
  );

CREATE POLICY "Owner/admin can delete tasks" ON public.tasks
  FOR DELETE USING (
    get_user_org_role(organization_id) IN ('owner','admin')
  );
```

## 2. Tipos TypeScript

### `src/types/index.ts`
Adicionar:

```text
TaskType = 'follow_up' | 'call' | 'email' | 'meeting' | 'other'

Task {
  id, organization_id, lead_id, assigned_to, title, description,
  task_type, due_date, completed_at, priority, created_at, updated_at
}

TaskWithRelations extends Task {
  lead?: Lead
  assigned_profile?: Profile
}
```

## 3. Services

### `src/services/tasks.ts` (criar)
- `getLeadTasks(leadId)` -- tarefas de um lead, pendentes primeiro (por due_date), depois concluidas
- `getMyTasks(userId, filters?)` -- tarefas do usuario logado em todas as orgs, com filtros opcionais (status, priority, task_type, date range), join com lead e profile
- `getOverdueTasksCount(userId)` -- count de tarefas atrasadas (due_date < now AND completed_at IS NULL)
- `getTodayTasksCount(userId)` -- count de tarefas para hoje pendentes
- `createTask(data)` -- insert
- `updateTask(id, updates)` -- update
- `completeTask(id)` -- update completed_at = now()
- `uncompleteTask(id)` -- update completed_at = null

## 4. Hooks

### `src/hooks/useTasks.ts` (criar)
- `useLeadTasks(leadId)` -- useQuery com queryKey `['lead-tasks', leadId]`
- `useMyTasks(filters)` -- useQuery com queryKey `['my-tasks', filters]`
- `useTaskBadgeCounts()` -- useQuery retornando { overdue, today } para o badge da sidebar
- `useCreateTask()` -- useMutation que cria tarefa + registra atividade `task_created` em lead_activities + invalida queries
- `useCompleteTask()` -- useMutation que marca concluida + registra atividade `task_completed` + invalida queries
- `useUpdateTask()` -- useMutation + invalida queries

## 5. Componentes

### `src/components/tasks/TaskList.tsx` (criar)
Lista de tarefas para a aba do lead:
- Pendentes primeiro (ordenadas por due_date), depois concluidas
- Cada item: checkbox para concluir, titulo, icone do tipo, avatar do responsavel, data relativa do prazo, badge de prioridade
- Tarefas atrasadas (due_date < now e nao concluidas): texto e borda em vermelho
- Tarefas concluidas: texto riscado, opacidade reduzida

### `src/components/tasks/TaskFormDialog.tsx` (criar)
Modal para criar/editar tarefa:
- Campos: titulo (obrigatorio), descricao, tipo (select), responsavel (select com membros da org), prazo (date/time picker), prioridade (select)
- Validacao com zod

### `src/components/tasks/TaskItem.tsx` (criar)
Componente individual de tarefa com checkbox, info e acoes.

### `src/components/tasks/TaskTypeIcon.tsx` (criar)
Icone por tipo de tarefa:
- follow_up: RefreshCw (azul)
- call: Phone (verde)
- email: Mail (azul)
- meeting: Calendar (roxo)
- other: Circle (cinza)

## 6. Pagina /tasks

### `src/pages/TasksPage.tsx` (criar)
- Header: titulo "Tarefas", filtros (status, prioridade, tipo, periodo)
- Tarefas agrupadas por: "Atrasadas", "Hoje", "Amanha", "Esta semana", "Proxima semana", "Futuro"
- Cada grupo colapsavel, com contagem
- Cada tarefa mostra: titulo, lead vinculado (nome clicavel que abre LeadDetailSheet), tipo, prazo, prioridade
- Tarefas atrasadas com destaque vermelho

## 7. Integracoes com codigo existente

### `src/components/leads/LeadDetailSheet.tsx` (editar)
- Substituir placeholder "Em construcao - Sprint 6" por:
  - Botao "+ Nova Tarefa" no topo
  - `<TaskList>` com tarefas do lead
  - `<TaskFormDialog>` para criacao

### `src/components/leads/kanban/KanbanView.tsx` (editar)
- No `handleDragEnd`, apos mover lead e registrar atividade de stage_change:
  - Verificar se a nova etapa (toStage) tem `sla_hours` definido
  - Se sim, auto-criar tarefa de follow-up:
    - title: "Follow-up: {lead.name}"
    - task_type: 'follow_up'
    - assigned_to: lead.assigned_to || user.id
    - due_date: now() + sla_hours horas
    - priority: lead.priority

### `src/components/layout/AppSidebar.tsx` (editar)
- Adicionar item "Tarefas" no mainNav (entre Leads e Relatorios)
- Icone: CheckSquare
- Badge com contagem: vermelho para atrasadas, amarelo para hoje
- Usar `useTaskBadgeCounts()` para obter os numeros

### `src/App.tsx` (editar)
- Adicionar rota `/tasks` -> PrivateRoute + MainLayout + TasksPage

## Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| supabase/migrations/xxx.sql | Criar |
| src/types/index.ts | Editar (TaskType, Task, TaskWithRelations) |
| src/services/tasks.ts | Criar |
| src/hooks/useTasks.ts | Criar |
| src/components/tasks/TaskTypeIcon.tsx | Criar |
| src/components/tasks/TaskItem.tsx | Criar |
| src/components/tasks/TaskList.tsx | Criar |
| src/components/tasks/TaskFormDialog.tsx | Criar |
| src/pages/TasksPage.tsx | Criar |
| src/components/leads/LeadDetailSheet.tsx | Editar (substituir placeholder) |
| src/components/leads/kanban/KanbanView.tsx | Editar (auto-criar tarefa SLA) |
| src/components/layout/AppSidebar.tsx | Editar (item Tarefas + badge) |
| src/App.tsx | Editar (rota /tasks) |

## Detalhes Tecnicos

### Auto-criacao de tarefa por SLA no Kanban
No `handleDragEnd` do KanbanView, apos o bloco existente de criacao de atividade stage_change:

```text
if (toStage?.sla_hours) {
  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + toStage.sla_hours);
  createTask.mutate({
    organization_id: organization.id,
    lead_id: leadId,
    assigned_to: lead.assigned_to || user.id,
    title: `Follow-up: ${lead.name}`,
    task_type: 'follow_up',
    due_date: dueDate.toISOString(),
    priority: lead.priority,
  });
}
```

### Registro de atividades ao criar/completar tarefas
No `useCreateTask`, apos sucesso, chamar `createActivity` com activity_type='task_created'.
No `useCompleteTask`, apos sucesso, chamar `createActivity` com activity_type='task_completed'.

### Badge na sidebar
O `useTaskBadgeCounts()` faz duas queries count:
- Atrasadas: `due_date < now() AND completed_at IS NULL`
- Hoje: `due_date >= startOfToday AND due_date < endOfToday AND completed_at IS NULL`

O badge aparece ao lado do texto "Tarefas" com cores:
- Vermelho se ha atrasadas
- Amarelo se ha apenas pendentes para hoje
- Nenhum se tudo em dia

### Agrupamento na pagina /tasks
Funcao helper que classifica tarefas pendentes em grupos:
- "Atrasadas": due_date < now()
- "Hoje": due_date entre startOfToday e endOfToday
- "Amanha": due_date entre startOfTomorrow e endOfTomorrow
- "Esta semana": due_date entre agora e endOfWeek
- "Proxima semana": due_date entre startOfNextWeek e endOfNextWeek
- "Futuro": due_date > endOfNextWeek
- "Concluidas": completed_at IS NOT NULL (colapsado por padrao)

### Queries de tarefas do usuario
`getMyTasks` busca tarefas onde `assigned_to = userId` com join em leads e profiles, sem filtrar por organization_id (o RLS ja garante acesso apenas as orgs do usuario).

