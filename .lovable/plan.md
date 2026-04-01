

# Filtro de Qualificação com Checkboxes (1–5)

## Mudanças

### 1. `src/types/index.ts`
Adicionar `qualifications?: number[]` ao `LeadFilters`.

### 2. `src/hooks/useLeadFilters.ts`
Adicionar `'qualifications'` ao `ARRAY_KEYS` para serializar/deserializar como array na URL.

### 3. `src/services/leads.ts` — `applyFilters`
Adicionar filtro:
```ts
if (filters.qualifications?.length) {
  query = query.in('qualification', filters.qualifications);
}
```

### 4. `src/components/leads/filters/LeadFilterBar.tsx`
Adicionar na área expandida um `FilterMultiSelect` com opções:
- `1 - Muito Baixa`, `2 - Baixa`, `3 - Média`, `4 - Alta`, `5 - Muito Alta`

Converter os valores selecionados (strings) para números ao chamar `setFilter('qualifications', ...)`.

### 5. `src/hooks/useLeadFilters.ts` — `activeFilterCount`
Incrementar contador quando `filters.qualifications?.length > 0`.

| Arquivo | Ação |
|---------|------|
| `src/types/index.ts` | Adicionar `qualifications` ao `LeadFilters` |
| `src/hooks/useLeadFilters.ts` | Serialização URL + contagem |
| `src/services/leads.ts` | Filtro server-side via `.in()` |
| `src/components/leads/filters/LeadFilterBar.tsx` | FilterMultiSelect de qualificação |

