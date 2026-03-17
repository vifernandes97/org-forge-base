

# Adicionar campo `media_de_festas` ao lead

## Mudanças

### 1. Migration SQL
```sql
ALTER TABLE public.leads ADD COLUMN media_de_festas text;
```

### 2. `src/types/index.ts`
Adicionar `media_de_festas: string | null` à interface `Lead`.

### 3. `src/services/leads.ts`
Incluir `media_de_festas` nos parâmetros de `createLead`.

### 4. `supabase/functions/inbound-webhook/index.ts`
Adicionar aliases no `FIELD_ALIASES`:
```
media_de_festas: ["mediadefestas", "mediafestas", "mediafesta"]
```
E incluir no mapeamento do lead data.

### 5. `src/components/leads/LeadDetailSheet.tsx`
Adicionar `InlineEditField` para `media_de_festas` logo após o campo Instagram, com placeholder "Média de festas...".

| Arquivo | Ação |
|---------|------|
| Migration | `ALTER TABLE leads ADD COLUMN media_de_festas text` |
| `types/index.ts` | Novo campo na interface Lead |
| `services/leads.ts` | Incluir no createLead |
| `inbound-webhook/index.ts` | Aliases + mapeamento |
| `LeadDetailSheet.tsx` | InlineEditField no drawer |

