
# Reestruturar Automações: Trigger primeiro, Ação depois

## Problema atual
O dialog começa pedindo "Tipo de ação" (o que fazer), mas o fluxo mental correto é: **primeiro definir o gatilho** (o que acontece), **depois a ação** (o que fazer quando acontecer).

## Nova estrutura do formulário

### 1. Novo campo: `trigger_type`
Tipo de gatilho que inicia a automação:
- `stage_enter` — "Lead entra em uma etapa"
- `status_change` — "Lead muda de status"

### 2. Fluxo do dialog reorganizado

```text
┌─────────────────────────────────────────┐
│  QUANDO (Gatilho)                       │
│  ┌─ Tipo de gatilho ─────────────────┐  │
│  │ [Lead entra em etapa ▾]           │  │
│  └───────────────────────────────────┘  │
│  ┌─ Funil ──────┐ ┌─ Etapa ─────────┐  │
│  │ [Vendas ▾]   │ │ [Proposta ▾]    │  │
│  └──────────────┘ └─────────────────┘  │
│                    ➜                    │
│  ENTÃO (Ação)                           │
│  ┌─ Tipo de ação ────────────────────┐  │
│  │ [Criar Tarefa ▾]                  │  │
│  └───────────────────────────────────┘  │
│  ... campos da ação selecionada ...     │
└─────────────────────────────────────────┘
```

- Quando `trigger_type = stage_enter`: mostra selects Funil + Etapa
- Quando `trigger_type = status_change`: mostra select de Status (open/won/inactive)
- Ações disponíveis: Criar Tarefa, Disparar Webhook, Mover Lead de Funil (todas disponíveis para qualquer gatilho)

### 3. Mudanças no banco de dados
Adicionar coluna `trigger_type` à tabela `stage_task_templates`:
```sql
ALTER TABLE stage_task_templates 
  ADD COLUMN trigger_type text NOT NULL DEFAULT 'stage_enter';
```
Atualizar trigger de validação para aceitar `stage_enter` e `status_change`.

Atualizar `execute_stage_task_automations()`:
- Para `trigger_type = 'stage_enter'`: verificar `OLD.stage_id IS DISTINCT FROM NEW.stage_id` e `stage_id = NEW.stage_id`
- Para `trigger_type = 'status_change'`: verificar `OLD.status IS DISTINCT FROM NEW.status` e `trigger_status = NEW.status`
- Ambos os gatilhos podem disparar qualquer `action_type`

### 4. Mudanças nos arquivos

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Coluna `trigger_type`, atualizar triggers de validação e execução |
| `src/types/index.ts` | Adicionar `trigger_type` ao `StageTaskTemplate` |
| `src/services/stageTaskTemplates.ts` | Incluir `trigger_type` nos campos |
| `StageTaskTemplateDialog.tsx` | Reorganizar: trigger_type primeiro → config gatilho → action_type → config ação |
| `AutomationCard.tsx` | Exibir gatilho baseado em `trigger_type` |
| `AutomationsPage.tsx` | Ajustar `handleSubmit` para limpar campos conforme `trigger_type` |

### 5. Validações
- `trigger_type = stage_enter` → `stage_id` obrigatório
- `trigger_type = status_change` → `trigger_status` obrigatório
- `action_type = move_lead` → `target_funnel_id` obrigatório
- `action_type = send_webhook` → `webhook_url` obrigatório
- `action_type = create_task` → campos de tarefa obrigatórios
