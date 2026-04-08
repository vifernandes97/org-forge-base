

# Métrica de Qualificação no Dashboard

## Resumo
Adicionar um card "Leads Qualificados" ao grid de summary cards do dashboard, exibindo a porcentagem de leads do período que possuem qualificação 4 ou 5.

## Mudanças

### 1. `src/services/dashboard.ts` — nova função `getQualifiedLeadsRate`
Consulta a tabela `leads` filtrando pelo período e funil, contando o total e os que têm `qualification IN (4, 5)`. Retorna `{ qualified: number, total: number, rate: number }`.

```ts
export async function getQualifiedLeadsRate(orgId, funnelId, dateFrom, dateTo) {
  // Query total leads no período
  // Query leads com qualification in (4,5) no mesmo período
  // Calcula rate = (qualified / total) * 100
}
```

### 2. `src/hooks/useDashboard.ts` — novo hook `useQualifiedRate`
Hook com `useQuery` chamando `getQualifiedLeadsRate`, habilitado quando `orgId` existe.

### 3. `src/components/dashboard/SummaryCards.tsx`
- Receber nova prop `qualifiedRate?: { qualified: number; total: number; rate: number }`.
- Adicionar card "Leads Qualificados" com ícone `Star`, exibindo `rate%` como valor principal e `qualified/total` como subtexto.

### 4. `src/pages/DashboardPage.tsx`
- Chamar `useQualifiedRate(period, funnelId)` e passar o resultado para `SummaryCards`.

| Arquivo | Ação |
|---------|------|
| `src/services/dashboard.ts` | Nova função `getQualifiedLeadsRate` |
| `src/hooks/useDashboard.ts` | Novo hook `useQualifiedRate` |
| `src/components/dashboard/SummaryCards.tsx` | Novo card com porcentagem |
| `src/pages/DashboardPage.tsx` | Integrar hook e passar prop |

