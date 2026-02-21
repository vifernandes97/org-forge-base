

# Visualizacoes Kanban e Lista para Leads

## Resumo
Reescrever a pagina `/leads` para suportar dois modos de visualizacao (Kanban e Lista) com seletor de funil, persistencia em localStorage, drag-and-drop no Kanban para mover leads entre etapas, e tabela com ordenacao, selecao multipla, acoes em lote e paginacao na Lista.

## 1. Novos Services

### `src/services/leads.ts` (editar)
Adicionar funcoes:
- `getLeadsByFunnel(funnelId)` -- busca leads de um funil especifico com joins (stage, funnel, assigned_profile), sem limite de 1000 (paginar se necessario)
- `getLeadsListPaginated(funnelId, page, pageSize, sortBy, sortOrder)` -- busca paginada com `.range()` e `.order()` dinamico, retorna `{ data, count }`
- `moveLeadToStage(leadId, stageId)` -- update apenas stage_id (triggers cuidam dos timestamps)
- `bulkMoveLeads(leadIds, stageId)` -- update batch de stage_id
- `bulkAssignLeads(leadIds, assignedTo)` -- update batch de assigned_to
- `bulkDeleteLeads(leadIds)` -- delete batch

## 2. Novos Hooks

### `src/hooks/useLeads.ts` (editar)
Adicionar:
- `useLeadsByFunnel(funnelId)` -- useQuery com queryKey `['leads-kanban', funnelId]`
- `useLeadsList(funnelId, page, pageSize, sortBy, sortOrder)` -- useQuery com queryKey `['leads-list', funnelId, page, pageSize, sortBy, sortOrder]`
- `useMoveLeadToStage()` -- useMutation com optimistic update (atualizar cache do kanban instantaneamente)
- `useBulkMoveLeads()`, `useBulkAssignLeads()`, `useBulkDeleteLeads()` -- useMutations

As mutations devem invalidar tanto `leads-kanban` quanto `leads-list`.

## 3. Pagina LeadsPage refatorada

### `src/pages/LeadsPage.tsx` (reescrever)
- Estado `viewMode` ('kanban' | 'list') persistido em localStorage
- Estado `selectedFunnelId` persistido em localStorage, default = primeiro funil ou funil padrao (is_default)
- Header: titulo, select de funil, toggle kanban/lista (icones LayoutGrid e List), botao Novo Lead
- Renderiza `<KanbanView>` ou `<ListView>` conforme modo
- Mantem LeadFormDialog e LeadDetailSheet existentes

## 4. Componentes Kanban

### `src/components/leads/kanban/KanbanView.tsx`
- Recebe funnelId
- Busca stages do funil + leads do funil
- Agrupa leads por stage_id em memo
- Layout: flex horizontal com overflow-x-auto
- DndContext com colisao customizada (closestCorners para multi-container)
- Ao dropar lead em nova coluna: optimistic update + mutacao `moveLeadToStage`
- Skeleton loading

### `src/components/leads/kanban/KanbanColumn.tsx`
- Recebe stage, leads[], onCardClick
- Header: borda colorida (border-top com cor da etapa), nome, contagem, soma de valores
- Corpo: lista vertical de KanbanCard com scroll vertical
- Usa useDroppable do @dnd-kit para receber cards

### `src/components/leads/kanban/KanbanCard.tsx`
- Recebe lead (LeadWithRelations)
- Usa useDraggable do @dnd-kit
- Layout compacto:
  - Nome (bold, truncado)
  - Empresa (secundario)
  - Valor em R$ (se > 0)
  - Avatar pequeno do responsavel
  - Dot colorido de prioridade (green/yellow/orange/red)
  - Tags (max 2 + "+N")
  - Tempo na etapa (formato curto: "3d", "12h", "45min") -- vermelho se acima do SLA
- Clique abre sheet de detalhe

### `src/components/leads/kanban/DragOverlayCard.tsx`
- Card renderizado durante o drag (dentro do DragOverlay do @dnd-kit)
- Visual elevado com sombra

## 5. Componentes Lista

### `src/components/leads/list/ListView.tsx`
- Recebe funnelId
- Busca leads paginados com sort
- Estado local: page, pageSize (25/50/100), sortBy, sortOrder
- Tabela com headers clicaveis para ordenar
- Checkbox no header para selecionar todos da pagina
- Barra de acoes em lote (aparece quando ha selecao)
- Paginacao no rodape
- Clique na linha abre sheet de detalhe

### `src/components/leads/list/BulkActionsBar.tsx`
- Mostra quando selectedIds.length > 0
- Botoes: "Mover para etapa" (dropdown com stages), "Atribuir" (dropdown com membros), "Deletar" (com AlertDialog)
- Contagem de selecionados

## 6. Sidebar e Rotas
Nenhuma alteracao necessaria -- a rota `/leads` e o item na sidebar ja existem.

## Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| `src/services/leads.ts` | Editar (adicionar funcoes) |
| `src/hooks/useLeads.ts` | Editar (adicionar hooks) |
| `src/pages/LeadsPage.tsx` | Reescrever |
| `src/components/leads/kanban/KanbanView.tsx` | Criar |
| `src/components/leads/kanban/KanbanColumn.tsx` | Criar |
| `src/components/leads/kanban/KanbanCard.tsx` | Criar |
| `src/components/leads/kanban/DragOverlayCard.tsx` | Criar |
| `src/components/leads/list/ListView.tsx` | Criar |
| `src/components/leads/list/BulkActionsBar.tsx` | Criar |

## Detalhes Tecnicos

### Drag and Drop no Kanban
Usar DndContext com `rectIntersection` collision detection. Cada coluna e um droppable com id = stage_id. Cada card e um draggable com id = lead_id. No onDragEnd:

```text
1. Identificar stage_id de destino (over.id ou container do over)
2. Se stage mudou:
   a. Optimistic update: atualizar cache do TanStack Query instantaneamente
   b. Chamar mutacao moveLeadToStage(leadId, newStageId)
   c. Em caso de erro, reverter cache
```

### Optimistic Update para Kanban
No useMoveLeadToStage, usar onMutate para atualizar o cache antes da resposta:

```text
onMutate: async ({ leadId, stageId }) => {
  await qc.cancelQueries(['leads-kanban', funnelId])
  const prev = qc.getQueryData(['leads-kanban', funnelId])
  // atualizar lead.stage_id no cache
  qc.setQueryData(['leads-kanban', funnelId], updated)
  return { prev }
}
onError: (_, __, ctx) => {
  qc.setQueryData(['leads-kanban', funnelId], ctx.prev)
}
onSettled: () => {
  qc.invalidateQueries(['leads-kanban', funnelId])
}
```

### Tempo na etapa (formato curto)
Funcao helper `formatStageTime(stageEnteredAt)`:
- < 1 hora: "Xmin"
- < 24 horas: "Xh"
- >= 24 horas: "Xd"

### Paginacao na Lista
Usar `.range(from, to)` do Supabase com `{ count: 'exact' }` para obter total de registros. Calcular paginas no componente.

### Responsividade
- Kanban: scroll horizontal natural funciona em mobile
- Lista: esconder colunas email, telefone, tags e data de criacao em telas < md usando classes `hidden md:table-cell`

### localStorage keys
- `crm_leads_view_mode` -> 'kanban' | 'list'
- `crm_leads_funnel_id` -> uuid string

