# Análise de motivos de arquivamento em /leads

## Objetivo
Permitir visualizar, em um período selecionado, quantos negócios foram arquivados por cada motivo (ex.: "5 por motivo X, 10 por motivo Y").

## Onde
Aba **Arquivados** em `/leads` (já existe via `useLeadFilters` com `status_filter`). Adicionar um painel resumo acima da lista/kanban quando a aba ativa for "Arquivados".

## UX

1. **Painel "Resumo de arquivamento"** (colapsável, aberto por padrão na aba Arquivados):
   - Seletor de período no topo: presets (Últimos 7d, 30d, 90d, Este mês, Mês passado, Personalizado) + date range custom.
   - Cards/linhas com cada motivo: label do motivo, contagem absoluta, % do total e barra de progresso proporcional.
   - Card extra "Sem motivo informado" para leads arquivados sem `archive_reason_id`.
   - Total geral de arquivados no período em destaque.
   - Botão "Aplicar como filtro" em cada motivo → seta `archive_reason_ids=[id]` no filtro atual e atualiza a listagem abaixo.

2. **Integração com filtros existentes**:
   - O período do painel é independente do filtro `created_at` da lista (arquivamento ≠ criação). Usa-se `archived_at`.
   - Respeita o funil selecionado (`funnel` no URL) e demais filtros de escopo (responsável, tags) se ativos — para coerência com a lista exibida.

## Implementação técnica

### Backend
- Nova função RPC `get_archive_reasons_summary(p_org_id uuid, p_funnel_id uuid, p_date_from timestamptz, p_date_to timestamptz)`:
  - `SECURITY DEFINER`, valida membership igual às outras RPCs de dashboard.
  - Retorna `(archive_reason_id uuid, label text, count bigint)` agrupando `leads` onde `status = 'inactive'` e `archived_at BETWEEN from AND to`.
  - Inclui linha com `archive_reason_id = NULL` / `label = 'Sem motivo'`.
  - `LEFT JOIN archive_reasons` para trazer o label atual.

### Frontend
- `src/services/leads.ts`: nova função `getArchiveReasonsSummary(orgId, { funnelId, from, to })` chamando o RPC.
- `src/hooks/useArchivedSummary.ts`: hook com React Query, key `['archived-summary', orgId, funnelId, from, to]`.
- `src/components/leads/ArchivedSummaryPanel.tsx`: novo componente
  - Date range picker (reaproveita `FilterDateRange`).
  - Lista de motivos com barras (componente leve, sem nova dep).
  - Botão "Aplicar como filtro" → usa `applyMany({ archive_reason_ids: [id] })` do `useLeadFilters`.
- `src/pages/LeadsPage.tsx`: renderizar `<ArchivedSummaryPanel>` somente quando `status_filter === 'inactive'` (aba Arquivados).

### Estado e URL
- Período do painel guardado em estado local + URL params próprios (`arch_from`, `arch_to`) para permitir compartilhar a visão.
- Default: últimos 30 dias.

## Fora do escopo
- Exportar resumo (pode ser feito depois reaproveitando `exportCsv`).
- Gráfico temporal (linha por dia) — somente totais por motivo nesta entrega.
- Alterar a aba "Ativos"/"Ganhos".

## Critérios de aceite
- Na aba Arquivados aparece o painel com contagem por motivo no período selecionado.
- Mudar o período recalcula sem recarregar a página.
- Clicar em "Aplicar como filtro" em um motivo filtra a lista abaixo por aquele motivo.
- Leads sem motivo aparecem em "Sem motivo".
- Respeita RLS / organização atual.
