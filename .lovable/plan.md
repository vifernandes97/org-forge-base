

# Correção: KPI Leads Qualificados — incluir todos os leads (ativos, ganhos e arquivados)

## Problema
A função `getQualifiedLeadsRate` filtra `.is('archived_at', null)` em ambas as queries, excluindo leads arquivados. O usuário quer que o total considere **todos** os leads do período (ativos, ganhos e arquivados).

## Mudança

### `src/services/dashboard.ts` — função `getQualifiedLeadsRate`
- **Remover** `.is('archived_at', null)` de ambas as queries (baseQuery e qualQuery).
- Assim o total será todos os leads criados no período, e os qualificados serão todos com qualification 4 ou 5, independente de status ou arquivamento.

| Arquivo | Ação |
|---------|------|
| `src/services/dashboard.ts` | Remover filtro `archived_at IS NULL` das duas queries |

