

# Exibir e editar todos os campos personalizados no drawer

## Diagnóstico

Hoje o drawer só renderiza campos personalizados que **já têm valor salvo** no banco — itera sobre `typedLead.custom_field_values`, não sobre as definições.

Consequência:
- **`dor_principal`** (criado agora, ainda sem valores) → não aparece em nenhum lead.
- **`media_de_festas`** → só aparece para leads que já têm o valor preenchido (via webhook). Para os demais, fica invisível e sem como adicionar.

Além disso, os valores hoje são **apenas leitura** (texto simples), enquanto os campos nativos são editáveis inline.

## Solução

Renderizar a seção iterando sobre **`customFields` (definições)** em vez de `custom_field_values`, e tornar cada linha editável inline — igual aos demais campos do painel.

### Arquivo: `src/components/leads/LeadDetailSheet.tsx`

- Substituir o bloco da seção "Campos Personalizados" (linhas 472–490).
- Para cada `def` ativa em `customFields`, buscar o valor atual em `typedLead.custom_field_values` (pode ser vazio).
- Renderizar com `<InlineEditField>` usando:
  - `label={def.field_label}` (mostra no tooltip ao hover)
  - `icon={<Tag className="h-4 w-4" />}` (genérico para todos os custom fields)
  - `type` mapeado a partir de `def.field_type`: `number` → `number`, `select` → `select` (com `def.options`), demais → `text` (futuro: date/textarea).
  - `placeholder="Adicionar..."` quando vazio.
  - `onSave` chama um novo handler `handleCustomFieldSave(defId, value)` que persiste em `custom_field_values`.
- Sempre exibir a seção "Campos Personalizados" se houver pelo menos uma definição ativa para a org.

### Arquivo: `src/services/leads.ts`

Adicionar função:
```ts
export async function upsertCustomFieldValue(
  leadId: string,
  fieldDefinitionId: string,
  value: string | null
)
```
Usa `upsert` em `custom_field_values` com `onConflict: 'lead_id,field_definition_id'`. Se `value` for vazio/`null`, fazer `delete` do registro existente.

### Arquivo: `src/hooks/useLeads.ts`

Adicionar `useUpsertCustomFieldValue()` que chama o serviço acima e invalida `['lead', leadId]` para refletir no drawer.

### Handler em `LeadDetailSheet.tsx`

```ts
const upsertCfv = useUpsertCustomFieldValue();
const handleCustomFieldSave = async (defId: string, value: string) => {
  if (!leadId) return;
  await upsertCfv.mutateAsync({ leadId, fieldDefinitionId: defId, value: value || null });
  toast.success('Atualizado!');
};
```

## Resultado

- Campo **`dor_principal`** aparecerá em todos os leads da org oniplataforma, vazio por padrão e editável inline.
- Campo **`media_de_festas`** aparecerá em todos os leads (mesmo sem valor), permitindo preencher manualmente.
- Tooltip com a label do campo no hover (igual aos campos nativos).
- Quando você excluir `media_de_festas` na página de Campos Personalizados, ele desaparece automaticamente do drawer.

## Tabela de mudanças

| Arquivo | Ação |
|---|---|
| `src/services/leads.ts` | Adicionar `upsertCustomFieldValue` (upsert ou delete se vazio) |
| `src/hooks/useLeads.ts` | Adicionar `useUpsertCustomFieldValue` |
| `src/components/leads/LeadDetailSheet.tsx` | Iterar sobre `customFields` em vez de `custom_field_values`; usar `InlineEditField` editável com tooltip |

