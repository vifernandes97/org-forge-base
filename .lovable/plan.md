

# Filtro de Leads Arquivados por Motivo de Arquivamento

## Resumo
Adicionar um filtro `FilterMultiSelect` de "Motivo de arquivamento" na barra de filtros, visível apenas quando a aba "Arquivados" estiver selecionada. Permite selecionar um ou mais motivos para filtrar os leads arquivados.

## Mudanças

### 1. `src/types/index.ts`
Adicionar `archive_reason_ids?: string[]` ao `LeadFilters`.

### 2. `src/hooks/useLeadFilters.ts`
Adicionar `'archive_reason_ids'` ao `ARRAY_KEYS` para serialização URL. Incrementar `activeFilterCount` quando preenchido.

### 3. `src/services/leads.ts` — `applyFilters`
Quando `filters.archive_reason_ids?.length`, adicionar:
```ts
query = query.in('archive_reason_id', filters.archive_reason_ids);
```

### 4. `src/components/leads/filters/LeadFilterBar.tsx`
- Importar `useActiveArchiveReasons` do hook existente.
- Adicionar um `FilterMultiSelect` com label "Motivo de arquivamento", renderizado condicionalmente apenas quando `filters.status_filter === 'archived'`.
- As opções vêm da query de archive reasons (id → label).

| Arquivo | Ação |
|---------|------|
| `src/types/index.ts` | Adicionar `archive_reason_ids` ao `LeadFilters` |
| `src/hooks/useLeadFilters.ts` | Serialização URL + contagem |
| `src/services/leads.ts` | Filtro server-side via `.in()` |
| `src/components/leads/filters/LeadFilterBar.tsx` | FilterMultiSelect condicional |

