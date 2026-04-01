

# Adicionar campo de Qualificação (1–5) ao Lead

## Resumo
Adicionar uma coluna `qualification` (integer, 1–5, nullable) na tabela `leads` e exibi-la no painel de detalhes do lead (LeadDetailSheet) e no formulário de criação/edição (LeadFormDialog) como um seletor inline.

## Mudanças

### 1. Migration — nova coluna `qualification`
```sql
ALTER TABLE leads ADD COLUMN qualification integer DEFAULT NULL;
```

### 2. `src/types/index.ts`
Adicionar `qualification: number | null;` à interface `Lead`.

### 3. `src/components/leads/LeadDetailSheet.tsx`
Na seção "Detalhes" (após prioridade, ~linha 414), adicionar um `InlineEditField` tipo `select` com opções 1–5 (labels: "1 - Muito Baixa", "2 - Baixa", "3 - Média", "4 - Alta", "5 - Muito Alta"), salvando via `handleInlineSave('qualification', v)`. Ajustar `handleInlineSave` para converter o valor para integer.

### 4. `src/components/leads/LeadFormDialog.tsx`
Adicionar campo `qualification` ao schema e ao formulário (select com opções 1–5), na seção de Prioridade/Fonte.

### 5. `src/services/leads.ts`
Incluir `qualification` no `createLead` e `updateLead` (já aceito via `Partial<Lead>`).

| Arquivo | Ação |
|---------|------|
| Migration SQL | `ALTER TABLE leads ADD COLUMN qualification integer` |
| `src/types/index.ts` | Adicionar campo `qualification` |
| `src/components/leads/LeadDetailSheet.tsx` | Exibir qualificação inline editável |
| `src/components/leads/LeadFormDialog.tsx` | Campo de qualificação no formulário |
| `src/services/leads.ts` | Suportar `qualification` no create |

