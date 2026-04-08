

# Campos Personalizados nas Colunas da ListView

## Resumo
Adicionar os campos personalizados (custom fields) como colunas opcionais na tabela de leads, disponíveis no toggle de colunas existente. Os valores serão carregados separadamente via query na tabela `custom_field_values`.

## Mudanças

### 1. `src/components/leads/list/ListView.tsx`

- Importar `useCustomFields` para obter as definições de campos personalizados ativos.
- Buscar os `custom_field_values` para os leads da página atual (query separada com os lead IDs).
- Mesclar as colunas fixas (`COLUMNS`) com as colunas dinâmicas dos custom fields (prefixo `cf_` no key, ex: `cf_{id}`).
- No Popover de colunas, adicionar uma seção "Campos personalizados" com os toggles dos custom fields.
- Renderizar `TableHead` e `TableCell` dinamicamente para os custom fields visíveis, exibindo o valor formatado conforme o `field_type` (texto, número, moeda, data, checkbox, etc.).
- Ajustar `loadVisibleColumns` para aceitar keys dinâmicas (`cf_*`) armazenadas no localStorage.
- Relaxar o tipo `ColumnKey` de union literal para `string` para acomodar keys dinâmicas.

### 2. `src/services/leads.ts` — nova função `getCustomFieldValuesForLeads`

```ts
export async function getCustomFieldValuesForLeads(leadIds: string[]) {
  const { data, error } = await supabase
    .from('custom_field_values')
    .select('*')
    .in('lead_id', leadIds);
  if (error) throw error;
  return data;
}
```

### Detalhes de renderização por tipo
- `text`, `email`, `url`, `phone`: texto direto
- `number`: `toLocaleString('pt-BR')`
- `currency`: `R$ ...`
- `date`: `toLocaleDateString('pt-BR')`
- `checkbox`: ícone check/x
- `select`, `multi_select`: badges

| Arquivo | Ação |
|---------|------|
| `src/services/leads.ts` | Nova função para buscar custom field values |
| `src/components/leads/list/ListView.tsx` | Integrar custom fields como colunas dinâmicas |

