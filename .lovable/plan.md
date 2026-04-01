

# Adicionar abas de status: Ativos, Ganhos e Arquivados

## Resumo
Adicionar um conjunto de abas/tabs no topo da página de Leads para alternar entre leads "Ativos" (status=open, não arquivados), "Ganhos" (status=won) e "Arquivados" (archived_at != null). Substituir o checkbox "Mostrar arquivados" por essa navegação visual.

## Mudanças

### 1. `src/types/index.ts`
- Adicionar campo `status_filter?: 'open' | 'won' | 'archived'` ao `LeadFilters`

### 2. `src/services/leads.ts` — `applyFilters`
- Quando `status_filter === 'archived'`: remover filtro `archived_at is null`, manter apenas `archived_at is not null`
- Quando `status_filter === 'won'`: filtrar `status = 'won'` e `archived_at is null`
- Quando `status_filter === 'open'` (ou padrão): filtrar `status = 'open'` e `archived_at is null`
- Remover lógica antiga de `show_archived`

### 3. `src/pages/LeadsPage.tsx`
- Adicionar tabs (usando componente `Tabs` do shadcn) entre o header e o filter bar com 3 opções: **Ativos**, **Ganhos**, **Arquivados**
- Ao trocar a aba, chamar `setFilter('status_filter', value)`
- Valor padrão: `'open'`

### 4. `src/hooks/useLeadFilters.ts`
- Adicionar `'status_filter'` ao `STRING_KEYS` para sincronizar com URL

### 5. `src/components/leads/filters/LeadFilterBar.tsx`
- Remover o checkbox "Mostrar arquivados" (substituído pelas abas)

| Arquivo | Ação |
|---------|------|
| `src/types/index.ts` | Adicionar `status_filter` ao `LeadFilters` |
| `src/services/leads.ts` | Implementar filtragem por status/arquivamento |
| `src/pages/LeadsPage.tsx` | Adicionar Tabs de Ativos/Ganhos/Arquivados |
| `src/hooks/useLeadFilters.ts` | Sincronizar `status_filter` com URL |
| `src/components/leads/filters/LeadFilterBar.tsx` | Remover checkbox "Mostrar arquivados" |

