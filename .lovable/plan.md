
# Correção: Qualificação na ListView + KPI do Dashboard

## Problemas identificados

1. **ListView sem coluna "Qualificação"**: O array `COLUMNS` não inclui `qualification`. O campo existe na tabela de leads (ex: "buffet 1000 risos" tem qualification=4) mas não é renderizado na lista — aparece "—" porque não há coluna para ele.

2. **KPI do Dashboard possivelmente incorreto**: A query `getQualifiedLeadsRate` não filtra `archived_at IS NULL`, então leads arquivados entram na contagem, distorcendo o resultado. Dados atuais: 5 leads qualificados (4 com nota 4, 1 com nota 5) de 144 total, mas 135 têm qualification NULL.

## Mudanças

### 1. `src/components/leads/list/ListView.tsx`
- Adicionar `{ key: 'qualification', label: 'Qualificação', defaultVisible: true, sortable: true }` ao array `COLUMNS`.
- Adicionar `TableHead` e `TableCell` condicionais para a coluna, renderizando o valor com os rótulos existentes (1=Muito Baixa, 2=Baixa, 3=Média, 4=Alta, 5=Muito Alta) ou "—" se null.

### 2. `src/services/dashboard.ts`
- Na função `getQualifiedLeadsRate`, adicionar `.is('archived_at', null)` em ambas as queries (total e qualified) para excluir leads arquivados da contagem.

| Arquivo | Ação |
|---------|------|
| `src/components/leads/list/ListView.tsx` | Adicionar coluna Qualificação |
| `src/services/dashboard.ts` | Filtrar leads arquivados no KPI |
