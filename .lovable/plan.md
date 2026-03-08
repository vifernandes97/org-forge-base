

# Automação "Mover Lead" baseada em Status (não Etapa)

## Objetivo
Para a ação `move_lead`, o gatilho deve ser a mudança de **status** do lead (open, won, inactive) em vez da mudança de etapa. Assim, por exemplo: "Quando lead mudar para status Won → Mover para Funil Pós-venda".

## Mudanças no Banco de Dados

### Adicionar coluna `trigger_status` na tabela `stage_task_templates`
```sql
ALTER TABLE stage_task_templates
  ADD COLUMN trigger_status text;
```
- Quando `action_type = 'move_lead'`, o gatilho usa `trigger_status` (e `stage_id` se torna opcional)
- Valores válidos: `'open'`, `'won'`, `'inactive'`

### Tornar `stage_id` nullable
```sql
ALTER TABLE stage_task_templates ALTER COLUMN stage_id DROP NOT NULL;
```
Isso permite que automações de `move_lead` sejam baseadas em status sem exigir uma etapa.

### Atualizar trigger `execute_stage_task_automations()`
- Adicionar verificação de mudança de status (`OLD.status IS DISTINCT FROM NEW.status`)
- Buscar templates `move_lead` onde `trigger_status = NEW.status` e disparar a movimentação
- Manter a lógica atual de `stage_id` para `create_task` e `send_webhook`

## Mudanças no Frontend

### `StageTaskTemplateDialog.tsx`
- Quando `action_type = 'move_lead'`, trocar o bloco GATILHO:
  - Em vez de Funil + Etapa, mostrar select de **Status** (Aberto, Ganho, Inativo)
  - Remover obrigatoriedade de `funnel_id` e `stage_id` para `move_lead`
  - Adicionar campo `trigger_status` ao schema
- Manter funil+etapa como gatilho para `create_task` e `send_webhook`

### `AutomationCard.tsx`
- Para `move_lead`: exibir o status como gatilho (ex: badge "Ganho") em vez de funil/etapa

### `AutomationsPage.tsx`
- No `handleSubmit`, limpar `stage_id`/`funnel_id` trigger quando `move_lead`, e setar `trigger_status`

### `src/types/index.ts`
- Adicionar `trigger_status?: string | null` ao `StageTaskTemplate`

### `src/services/stageTaskTemplates.ts`
- Incluir `trigger_status` nos campos de create/update

| Arquivo | Ação |
|---------|------|
| Migration SQL | Coluna `trigger_status`, `stage_id` nullable, trigger atualizado |
| `src/types/index.ts` | Adicionar `trigger_status` |
| `src/services/stageTaskTemplates.ts` | Incluir novo campo |
| `src/components/automations/StageTaskTemplateDialog.tsx` | Gatilho por status para move_lead |
| `src/components/automations/AutomationCard.tsx` | Exibir status como gatilho |
| `src/pages/AutomationsPage.tsx` | Ajustar handleSubmit |

