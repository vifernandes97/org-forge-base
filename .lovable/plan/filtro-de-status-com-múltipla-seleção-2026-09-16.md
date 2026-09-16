# Filtro de status com múltipla seleção

Hoje o campo "Status" nos filtros de Negócios é uma lista de escolha única: só dá para ver Ativos, ou Ganhos, ou Arquivados. Ele passará a permitir marcar várias opções ao mesmo tempo (ex.: Ativos + Ganhos + Arquivados).

Observação: hoje o sistema tem três situações — **Ativos** (em andamento), **Ganhos** e **Arquivados** (é onde ficam os perdidos, com o motivo do arquivamento). Não existe um status separado "Perdidos"; se quiser um status próprio para perdidos, isso é um ajuste adicional que posso planejar depois.

## O que muda

1. O campo "Status" passa a ser um seletor de múltipla escolha, no mesmo estilo dos filtros de Etapa, Responsável e Prioridade.
2. Ao abrir a tela, continua vindo marcado apenas **Ativos** (comportamento atual).
3. Marcando mais de uma opção, a lista e o kanban mostram os negócios de todas as situações escolhidas juntos.
4. Se nenhuma opção for marcada, o filtro volta ao padrão Ativos, para nunca ficar sem resultado por engano.
5. O filtro de "Motivo de arquivamento" e o painel resumo de arquivados aparecem sempre que **Arquivados** estiver entre as opções marcadas.
6. Filtros salvos e links compartilhados antigos (com um único status) continuam funcionando.
7. Exportação de CSV segue respeitando a nova seleção múltipla.

## Detalhes técnicos

- `src/types/index.ts`: trocar `status_filter?: 'open' | 'won' | 'archived'` por `status_filters?: LeadStatusFilter[]` (`'open' | 'won' | 'archived'`).
- `src/hooks/useLeadFilters.ts`: incluir `status_filters` nas chaves de array na sincronização de URL; default `['open']`; aceitar `status_filter` legado convertendo para array; contar como filtro ativo quando diferente de `['open']`.
- `src/services/leads.ts` (`applyFilters`): montar a condição a partir do array —
  - `open` → `status = 'open' and archived_at is null`
  - `won` → `status = 'won' and archived_at is null`
  - `archived` → `archived_at is not null`
  Combinar as selecionadas com `or(...)` numa única expressão PostgREST (usando `and(...)` interno em cada parte); com uma única opção, manter o comportamento atual.
- `src/components/leads/filters/AdvancedFiltersPopover.tsx`: substituir o `Select` por `FilterMultiSelect` com as três opções; ajustar contagem da seção, `handleApply` e `handleClear` para `status_filters`.
- `src/components/leads/filters/LeadFilterBar.tsx`: `showArchiveReason` passa a ser `status_filters?.includes('archived')`; chips refletem múltiplos status.
- `src/pages/LeadsPage.tsx`: `currentStatusFilter` vira derivação do array (painel de arquivados e demais condições usam `includes('archived')`).
- `src/lib/leadClientFilters.ts` e `src/hooks/useSavedFilters` não precisam de lógica nova além de tipagem, pois o status é filtrado no servidor.
- Sem mudanças no banco.
