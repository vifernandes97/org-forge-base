
# Simplificar KanbanCard: exibir company_name, company e data de criação

## Mudanças em `src/components/leads/kanban/KanbanCard.tsx`

Reformular o card para exibir apenas 3 informações:

1. **Linha 1**: `company_name` (com priority dot e avatar mantidos)
2. **Linha 2**: `company` (nome fantasia/empresa)
3. **Linha 3**: data de criação relativa (`created_at`) usando `formatStageTime` (já existente, reutilizar a lógica mas passando `lead.created_at` em vez de `stage_entered_at`)

### Remover do card
- Valor (R$)
- Tags/badges de status
- Tempo na etapa (stage_entered_at)

### Reutilizar `formatStageTime`
A função `formatStageTime` já calcula "Xmin / Xh / Xd" a partir de uma data. Basta chamar `formatStageTime(lead.created_at)` para exibir há quanto tempo o lead foi criado.

### Layout final do card
```
● Company Name                    [Avatar]
  Company
                                      3d
```

Também atualizar `DragOverlayCard.tsx` para consistência.
