

# Adicionar campo `company_name` à tabela de leads

## Objetivo
Adicionar uma nova coluna `company_name` (text, nullable) à tabela `leads`, mantendo o campo `company` existente.

## Mudanças

### 1. Migration SQL
```sql
ALTER TABLE leads ADD COLUMN company_name text;
```

### 2. `src/types/index.ts`
Adicionar `company_name: string | null` à interface `Lead`.

### 3. `src/services/leads.ts`
Incluir `company_name` nos parâmetros de `createLead`.

### 4. `src/components/leads/LeadFormDialog.tsx`
- Adicionar campo `company_name` ao schema zod e ao formulário (label: "Razão Social" ou similar)
- Incluir no `defaultValues`, no `form.reset` (edição), e no submit (create/update)

### 5. `src/components/leads/LeadDetailSheet.tsx`
Exibir `company_name` nas informações do lead (ao lado de company).

### 6. `src/components/leads/list/ListView.tsx`
Adicionar coluna `company_name` na tabela de listagem (opcional, se desejado).

### 7. `src/components/leads/kanban/KanbanCard.tsx` e `DragOverlayCard.tsx`
Exibir `company_name` se disponível.

### 8. `supabase/functions/inbound-webhook/index.ts`
Adicionar mapeamento para `company_name` (aliases: `company_name`, `razao_social`, `razao`, `nome_empresa`).

| Arquivo | Ação |
|---------|------|
| Migration SQL | `ALTER TABLE leads ADD COLUMN company_name text` |
| `src/types/index.ts` | Adicionar campo à interface Lead |
| `src/services/leads.ts` | Incluir no createLead |
| `LeadFormDialog.tsx` | Novo campo no formulário |
| `LeadDetailSheet.tsx` | Exibir na ficha do lead |
| `ListView.tsx` | Coluna na tabela |
| `KanbanCard.tsx` / `DragOverlayCard.tsx` | Exibir no card |
| `inbound-webhook/index.ts` | Mapeamento do campo |

