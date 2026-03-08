

# Automações de Tarefas por Etapa — UI Visual estilo n8n

## Contexto
Já existe uma tabela `automations` para mover leads entre funis/etapas. A nova feature precisa de uma tabela separada `stage_task_templates` para criar tarefas automaticamente quando um lead entra em uma etapa.

## Mudanças no Banco de Dados

### Nova tabela: `stage_task_templates`
- `id`, `organization_id`, `stage_id` (FK → stages), `title`, `description`, `task_type`, `priority`, `due_hours` (prazo em horas), `assign_to_lead_owner` (boolean), `is_active`, `created_at`, `updated_at`
- RLS: mesmas políticas das outras tabelas (select para members, insert/update/delete para owner/admin)
- Trigger `update_updated_at_column`

### Trigger na tabela `leads`: criar tarefas automaticamente
- Função `execute_stage_task_automations()` como trigger BEFORE UPDATE na tabela `leads`
- Quando `stage_id` muda, busca templates ativos para a nova stage e insere tarefas na tabela `tasks`

## Mudanças no Frontend

### 1. Sidebar: adicionar link "Automações" no grupo Configurações
- Ícone `Zap`, rota `/settings/automations`

### 2. Rota `/settings/automations` → `AutomationsPage.tsx`
- UI visual estilo n8n com cards de automação
- Cada automação mostra visualmente: **Quando** [lead entra na etapa X] **→ Fazer** [criar tarefa Y]
- Cards conectados por setas/linhas visuais
- Botão "Nova Automação"
- Toggle ativo/inativo em cada card
- Ações: editar, excluir

### 3. Dialog `StageTaskTemplateDialog.tsx`
- Formulário com layout visual de dois blocos conectados:
  - **Bloco Gatilho**: selecionar Funil → Etapa
  - **Bloco Ação**: título da tarefa, tipo, prioridade, prazo em horas, atribuir ao responsável do lead (switch)

### 4. Service + Hook
- `src/services/stageTaskTemplates.ts` — CRUD
- `src/hooks/useStageTaskTemplates.ts` — React Query hooks

## Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | Nova tabela + RLS + trigger |
| `src/types/index.ts` | Tipo `StageTaskTemplate` |
| `src/services/stageTaskTemplates.ts` | Novo — CRUD |
| `src/hooks/useStageTaskTemplates.ts` | Novo — hooks |
| `src/pages/AutomationsPage.tsx` | Novo — listagem visual estilo n8n |
| `src/components/automations/StageTaskTemplateDialog.tsx` | Novo — form dialog |
| `src/components/automations/AutomationCard.tsx` | Novo — card visual com blocos trigger→action |
| `src/components/layout/AppSidebar.tsx` | Adicionar link "Automações" |
| `src/App.tsx` | Adicionar rota `/settings/automations` |

