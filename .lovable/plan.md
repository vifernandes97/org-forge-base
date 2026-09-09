# Exportação completa dos negócios (todos os campos + histórico)

## Situação atual (verificada no código)

O botão "Exportar CSV" busca os negócios com os filtros aplicados na tela, mas só grava 13 colunas fixas (nome, email, telefone, empresa, valor, prioridade, qualificação, fonte, tags, etapa, responsável, status, criado em). Ficam de fora: razão social/Instagram, notas, motivo de arquivamento, datas de atividade/etapa/arquivamento, dados do contato, campos personalizados da empresa e todo o histórico (timeline), incluindo as notas registradas.

Também ficam de fora dois filtros aplicados só na tela: tempo na etapa e campos personalizados.

## O que será feito

1. **Exportar exatamente o que está na tela**: unificar a filtragem de "tempo na etapa" e "campos personalizados" numa função compartilhada usada pelo funil, pela lista e pela exportação.
2. **Planilha principal com todos os campos** — um negócio por linha:
   - identificação: ID, Empresa, Razão social, Instagram, nome/email/telefone do contato
   - comercial: valor, prioridade, qualificação, fonte, tags, funil, etapa, responsável, status
   - notas do negócio (campo Notas)
   - arquivamento: motivo, data de arquivamento; mesclagem: mesclado em / negócio principal
   - datas: criado em, atualizado em, última atividade, entrou na etapa
   - uma coluna por campo personalizado ativo da empresa (datas em dd/mm/aaaa, sim/não, múltipla escolha separada por "; ")
   - resumo do histórico: total de registros e todas as notas concatenadas
3. **Segunda planilha com o histórico completo** — um registro da timeline por linha: ID do negócio, Empresa, contato, data/hora, tipo de registro, título, descrição/conteúdo da nota, autor. Cobre todos os negócios do resultado filtrado, ou seja, todas as notas ficam preservadas linha a linha.
4. **Feedback**: ao exportar, baixa os dois arquivos (`negocios_...csv` e `negocios_historico_...csv`) com funil e data no nome, e a mensagem final informa quantos negócios e quantos registros de histórico foram exportados. Resultado vazio: avisa e não baixa nada.

## Detalhes técnicos

- Novo `src/lib/leadClientFilters.ts`: `matchesStageTime` (movido de `KanbanView.tsx`) + `matchesCustomFields`, com helper `applyClientFilters(leads, filters, stages, cfMap)`. Usado por `KanbanView`, `ListView` e pela exportação.
- Nova função em `src/services/activities.ts`: `getActivitiesForLeads(leadIds)` — busca em lotes (chunks de ~200 ids) com join em `profiles` para o nome do autor, ordenado por lead e data.
- Nova função em `src/services/leads.ts`: `getLeadsForExport(funnelId, filters, orgId)` que retorna leads com `stage`, `funnel`, `assigned_profile`, `archive_reason`, `contacts` e valores de campos personalizados.
- Nova `src/lib/leadsExport.ts` com `buildLeadRows(...)` e `buildActivityRows(...)`; `LeadsPage.handleExportCSV` orquestra: buscar → filtrar no cliente → montar as duas listas → dois `downloadCSV`.
- Campos personalizados via `useCustomFields()` (apenas `is_active`), colunas nomeadas por `field_label`.
- Sem mudanças no banco de dados.
