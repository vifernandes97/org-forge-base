

# Garantir que `media_de_festas` continue funcionando via webhook

## Problema
Após a migração de `media_de_festas` para custom field, a Edge Function `inbound-webhook` só vai gravá-lo automaticamente se o webhook da oniplataforma tiver `field_mapping.custom_fields.media_de_festas = "media_de_festas"`. Caso contrário, o valor cai em `notes` e o custom field fica vazio.

## Solução em duas frentes

### 1. Backfill imediato — atualizar webhook(s) existentes da oniplataforma
Migration SQL que faz `UPDATE inbound_webhooks` na org `ff7bbd31-e907-4a2e-8d9f-ad1d53a35aaa`, fazendo merge no JSON `field_mapping` para incluir:
```json
{ "custom_fields": { "media_de_festas": "media_de_festas" } }
```
Preserva qualquer outro mapeamento já existente via `jsonb_set` / `||`.

### 2. Fallback automático na Edge Function (defesa)
Em `supabase/functions/inbound-webhook/index.ts`, após montar `mappedCustomFields` (linha 187), adicionar uma etapa que:

- Busca todas as `custom_field_definitions` ativas da org (uma única query).
- Para cada definição, se ainda não estiver em `mappedCustomFields` **e** o payload tiver uma chave cujo `normalizeFieldName` bata com `normalizeFieldName(def.field_name)` ou `def.field_label`, atribui o valor.
- Adiciona essas chaves ao `allMappedFormKeys` para não duplicarem em `notes`.

Resultado: qualquer payload com `media_de_festas` (ou variações como `Media de Festas`, `media-de-festas`) populará o custom field automaticamente em **todas as orgs**, sem exigir configuração manual.

## Tabela de mudanças

| Arquivo | Ação |
|---|---|
| `supabase/migrations/<nova>.sql` | UPDATE em `inbound_webhooks` da oniplataforma para incluir `custom_fields.media_de_festas` no `field_mapping` |
| `supabase/functions/inbound-webhook/index.ts` | Carregar definições ativas da org e fazer auto-match de payload → custom field por nome normalizado |

## Resultado
- Webhooks já existentes da oniplataforma voltam a alimentar o campo sem trocar nada do lado do cliente.
- Novas orgs e novos custom fields ganham auto-detecção de graça (mesmo padrão dos campos nativos).
- Se houver conflito (mesmo nome em nativo e custom), o nativo continua tendo prioridade pois é processado antes.

