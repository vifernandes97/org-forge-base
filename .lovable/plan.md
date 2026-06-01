## Objetivo
Remover as abas de status (Ativos / Ganhos / Arquivados) e gerenciar o status do lead exclusivamente pelo modal de Filtros, mantendo "Ativos" como filtro padrão.

## Mudanças

### 1. `src/components/leads/filters/AdvancedFiltersPopover.tsx`
- Adicionar nova linha "Status" no topo da seção **Essenciais** (antes de "Etapa") usando um `Select` simples com opções:
  - Ativos (`open`) — default
  - Ganhos (`won`)
  - Arquivados (`archived`)
- Vincular ao `draft.status_filter`. Incluir no `handleApply` (acrescentar `status_filter` à lista `allKeys`).
- Atualizar `handleClear` para resetar `status_filter` ao default `'open'` (e não para `undefined`).
- Atualizar `sectionCounts.essentials` para contar +1 quando `status_filter` ≠ `'open'`.
- A prop `showArchiveReason` continua existindo, mas agora deve ser derivada pelo pai com base em `filters.status_filter === 'archived'`.

### 2. `src/hooks/useLeadFilters.ts`
- Garantir que o default seja `status_filter: 'open'` quando não houver na URL (em `deserialize`).
- Em `activeFilterCount`, contar `status_filter` somente quando ≠ `'open'`.
- Em `clearFilters`, manter `{ status_filter: 'open' }` em vez de objeto vazio.

### 3. `src/pages/LeadsPage.tsx`
- Remover totalmente o bloco `<Tabs>` de status (linhas ~230-253).
- Remover o cálculo de `statusCounts` e `filtersForCount` e o hook `useLeadsByFunnel(selectedFunnelId, filtersForCount)` que serve só para contar as tabs.
- Manter `totalCount` baseado nos leads do filtro atual (derivar do retorno de `useLeadsByFunnel` já usado no Kanban/List, ou reaproveitar uma contagem simples — preferível: passar o count para baixo ou exibir só o número da view ativa). Solução mínima: remover o `· {totalCount}` ao lado do título, já que não temos mais a contagem multi-status. (Confirma se OK; alternativa é manter contagem só do filtro atual via hook leve.)
- O `ArchivedSummaryPanel` continua sendo renderizado quando `filters.status_filter === 'archived'`.

### 4. Detalhe técnico
- O backend já filtra por `status_filter` (esse parâmetro existe e é usado por `getLeadsByFunnel`/Kanban/List), então nenhuma migração é necessária.
- O `LeadFilterBar` continua chamando `AdvancedFiltersPopover` — só passa `showArchiveReason = filters.status_filter === 'archived'`.

## Critérios de aceite
- Página `/leads` não mostra mais abas Ativos/Ganhos/Arquivados.
- Ao abrir, lista mostra leads ativos (`status_filter=open`) por padrão.
- O modal de Filtros tem um campo "Status" no topo de Essenciais que troca entre Ativos/Ganhos/Arquivados.
- O badge contador no botão "Filtros" só incrementa quando o status for diferente de Ativos.
- O painel "Resumo de arquivamento" continua aparecendo somente quando Status = Arquivados.