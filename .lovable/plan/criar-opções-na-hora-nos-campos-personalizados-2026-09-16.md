# Criar opções na hora nos campos personalizados

Hoje, nos campos personalizados do tipo "seleção" e "múltipla escolha", só é possível escolher entre as opções já cadastradas nas configurações. A proposta é permitir digitar uma opção nova direto no negócio, salvando-a imediatamente na lista da empresa para todos usarem depois.

## Como vai funcionar

- No campo de seleção e no de múltipla escolha aparece um campo de busca com a lista de opções.
- Ao digitar algo que ainda não existe, aparece a linha "Criar «texto digitado»".
- Ao confirmar, a opção é salva na lista do campo (fica disponível para todos os negócios) e já é aplicada ao negócio aberto.
- Qualquer membro da empresa pode criar opções, conforme escolhido.
- Opção repetida (diferindo só por maiúsculas ou espaços) não duplica: reaproveita a existente.
- Vale nos dois lugares onde o campo aparece: no formulário de novo negócio e na edição rápida dentro do negócio.
- Não muda nada nos filtros nem na tela de configurações de campos personalizados (lá a lista continua editável como hoje).

## Detalhes técnicos

- Migração: função `add_custom_field_option(p_field_id uuid, p_option text)` em `SECURITY DEFINER`, com `EXECUTE` apenas para `authenticated`. Ela valida que o campo pertence a uma organização do usuário (`get_user_org_ids()`), que o tipo é `select`/`multi_select`, faz o append em `options` de forma idempotente (comparação case-insensitive, `trim`) e retorna o array final de opções. Isso evita afrouxar as policies de `UPDATE` de `custom_field_definitions`, que continuam restritas a owner/admin.
- `src/services/customFields.ts`: `addCustomFieldOption(fieldId, option)` chamando a RPC.
- `src/hooks/useCustomFields.ts`: `useAddCustomFieldOption` invalidando `['custom-fields', orgId]`.
- `src/components/custom-fields/CustomFieldRenderer.tsx`: substituir o `Select` do tipo `select` e a lista de badges do `multi_select` por um `Command`/`Popover` (combobox shadcn) com input de busca e item "Criar …"; ao criar, chamar a mutação, aplicar o valor via `onChange` e tratar erro com toast.
- `src/components/leads/CustomFieldInlineEdit.tsx`: continua usando o renderer; garantir que a criação não feche o popover antes de salvar o valor.
- Verificação: `bunx tsgo --noEmit -p tsconfig.app.json` e teste no navegador criando uma opção nova em um campo de múltipla escolha.
