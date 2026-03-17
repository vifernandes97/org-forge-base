

# Adicionar campo `company_instagram` à tabela de leads

## Mudanças

### 1. Migration SQL
```sql
ALTER TABLE public.leads ADD COLUMN company_instagram text;
```

### 2. `src/types/index.ts`
Adicionar `company_instagram: string | null` à interface `Lead`.

### 3. `src/services/leads.ts`
Incluir `company_instagram?: string | null` nos parâmetros de `createLead`.

### 4. `src/components/leads/LeadFormDialog.tsx`
Adicionar campo "Instagram" ao formulário (schema zod, defaultValues, submit).

### 5. `src/components/leads/LeadDetailSheet.tsx`
Exibir e permitir edição inline do `company_instagram`.

### 6. `supabase/functions/inbound-webhook/index.ts`
Mapear aliases (`company_instagram`, `instagram`) para o novo campo.

