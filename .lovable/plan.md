

# Adicionar ação "Mover Lead de Funil" nas Automações

## Objetivo
Permitir que uma automação mova o lead para outro funil/etapa quando ele entra em uma etapa específica. Terceiro tipo de ação além de "Criar Tarefa" e "Disparar Webhook".

## Mudanças no Banco de Dados

### Adicionar colunas na tabela `stage_task_templates`
```sql
ALTER TABLE stage_task_templates
  ADD COLUMN target_funnel_id uuid REFERENCES funnels(id) ON DELETE CASCADE,
  ADD COLUMN target_stage_id uuid REFERENCES stages(id) ON DELETE CASCADE;
```

### Atualizar validação de `action_type`
Adicionar `'move_lead'` como valor válido no trigger `validate_stage_task_template_action_type`.

### Atualizar trigger `execute_stage_task_automations()`
Adicionar bloco para `action_type = 'move_lead'`: quando ativado, altera `NEW.funnel_id` e `NEW.stage_id` para os valores de `target_funnel_id` / `target_stage_id` do template (similar ao que `execute_automations()` já faz na tabela `automations`).

## Mudanças no Frontend

### 1. `src/types/index.ts`
Adicionar `'move_lead'` ao tipo `AutomationActionType`.

### 2. `StageTaskTemplateDialog.tsx`
- Adicionar opção "Mover Lead de Funil" no select de tipo de ação (ícone `ArrowRightLeft`)
- Quando `action_type = 'move_lead'`, exibir selects de **Funil destino** e **Etapa destino** no bloco de ação (reutilizando `useFunnels` + `useStages`)
- Validação: funil e etapa destino obrigatórios quando `move_lead`

### 3. `AutomationCard.tsx`
- Exibir visualmente o funil/etapa destino com badges quando `action_type = 'move_lead'`
- Ícone e cor distintos (ex: `ArrowRightLeft`, roxo)

### 4. `AutomationsPage.tsx`
- No `handleSubmit`, limpar campos irrelevantes quando `action_type = 'move_lead'` (similar ao que já faz para webhook)
- Passar `funnels` e `allStages` para o card exibir nomes dos destinos

### 5. `services/stageTaskTemplates.ts`
- Incluir `target_funnel_id` e `target_stage_id` nos campos de create/update

| Arquivo | Ação |
|---------|------|
| Migration SQL | Colunas `target_funnel_id`, `target_stage_id` + atualizar triggers |
| `src/types/index.ts` | Adicionar `'move_lead'` ao `AutomationActionType` e campos ao `StageTaskTemplate` |
| `src/components/automations/StageTaskTemplateDialog.tsx` | Adicionar opção move_lead com selects de destino |
| `src/components/automations/AutomationCard.tsx` | Exibir funil/etapa destino |
| `src/pages/AutomationsPage.tsx` | Ajustar handleSubmit + passar dados de stages ao card |
| `src/services/stageTaskTemplates.ts` | Incluir novos campos |

