# Sincronizar resumo de arquivamento com os filtros da lista

## Problema
O card "Resumo de arquivamento" usa seu próprio seletor de período (default "Últimos 30 dias") e filtra pelo campo `archived_at`. Já a lista abaixo usa os filtros da página (`created_at_from/to` etc.) sobre `created_at`. Resultado: para "criados em maio/2026 arquivados" a lista mostra 22 e o card 103.

## Solução
Fazer o card refletir exatamente o mesmo recorte da lista:

1. **Remover o seletor de período próprio do painel.** O painel passa a herdar:
   - `created_at_from` / `created_at_to` dos filtros da página.
   - Demais filtros de escopo aplicáveis (assigned_to, tags, sources, priorities, qualifications, search) para coerência total com a lista.
2. **Trocar a base temporal de `archived_at` para `created_at`** no agrupamento, alinhando com o que a lista exibe (a lista filtra por data de criação, não de arquivamento).
3. **Fallback**: quando não há filtro de data na página, usar "todos os arquivados" (sem restrição de data) e mostrar isso no header ("103 arquivados").
4. **Cabeçalho do card** passa a descrever o recorte ativo:
   - Com data: "Resumo de arquivamento · 22 · 01/05–31/05"
   - Sem data: "Resumo de arquivamento · 103 (todos)"

## Implementação técnica

### Backend
Estender `get_archive_reasons_summary` para aceitar filtros adicionais e permitir `from/to` opcionais:
```
get_archive_reasons_summary(
  p_org_id uuid,
  p_funnel_id uuid,
  p_date_from timestamptz,   -- nullable
  p_date_to   timestamptz,   -- nullable
  p_assigned_to uuid[]       -- nullable
)
```
- Filtrar por `l.created_at` (não `archived_at`).
- Quando `p_date_from`/`p_date_to` são NULL, não aplicar restrição de data.
- Manter `status='inactive'` + LEFT JOIN em `archive_reasons`.

### Frontend
- `src/services/leads.ts`: aceitar `from?: string | null`, `to?: string | null`, `assignedTo?: string[]`.
- `src/components/leads/ArchivedSummaryPanel.tsx`:
  - Remover Select de preset e date picker próprios.
  - Receber `filters: LeadFilters` via prop.
  - Derivar `from/to` de `filters.created_at_from/to`.
  - Mostrar resumo do período ativo no header (ou "todos" se não houver).
- `src/pages/LeadsPage.tsx`: passar `filters` ao painel.

## Critérios de aceite
- Com filtro "criados em maio/2026" + aba Arquivados, o card mostra os mesmos 22 da lista, somando os motivos para 22.
- Sem filtro de data, o card mostra o total absoluto de arquivados.
- Mudar qualquer filtro de data atualiza o card imediatamente.
