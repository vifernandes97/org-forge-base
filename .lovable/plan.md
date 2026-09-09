# Exportar apenas os negócios filtrados

## Situação atual (verificada no código)

O botão "Exportar CSV" já busca os negócios usando os filtros aplicados na tela (busca, etapa, responsável, prioridade, origem, tags, valor, datas, qualificação, motivo de arquivamento e status). Porém dois filtros ficam de fora:

- **Tempo na etapa** ("na etapa", acima do SLA etc.) — hoje é aplicado só na tela do funil, depois da busca, então a exportação ignora.
- **Campos personalizados** — no funil existe apenas um espaço reservado sem lógica; nenhuma tela filtra de fato por eles, e a exportação também não.

Além disso o CSV exporta um conjunto fixo de colunas e não inclui os campos personalizados da empresa.

## O que será feito

1. **Um único lugar decide o que é "resultado da busca"**: criar uma função de filtragem compartilhada (tempo na etapa + campos personalizados) usada pelo funil, pela lista e pela exportação, para que os três mostrem/exportem exatamente o mesmo conjunto.
2. **Exportação idêntica ao que está na tela**: ao exportar, buscar os negócios com os filtros do servidor, carregar os valores de campos personalizados desses negócios e aplicar a mesma filtragem final antes de gerar o CSV.
3. **Colunas dos campos personalizados no CSV**: acrescentar uma coluna por campo personalizado ativo da empresa, com valores legíveis (datas em dd/mm/aaaa, sim/não, múltipla escolha separada por "; ").
4. **Feedback claro**: o nome do arquivo passa a indicar o funil e a data, e a mensagem de sucesso informa quantos negócios foram exportados. Se o resultado filtrado for vazio, avisa e não baixa arquivo.

## Detalhes técnicos

- Novo `src/lib/leadClientFilters.ts` com `matchesStageTime` (movido de `KanbanView.tsx`) e `matchesCustomFields(lead, cfValuesByLead, filters.custom_fields)`; helper `applyClientFilters(leads, filters, stages, cfMap)`.
- `KanbanView.tsx` e `ListView.tsx` passam a usar o helper (Kanban já carrega leads completos; a lista aplica sobre a página atual).
- `LeadsPage.handleExportCSV`: `getLeadsByFunnel(...)` → `getCustomFieldValuesForLeads(ids)` → `applyClientFilters` → monta linhas → `downloadCSV`.
- Campos personalizados via `useCustomFields()` (somente `is_active`), colunas nomeadas pelo `field_label`.
- Sem mudanças no banco de dados.
