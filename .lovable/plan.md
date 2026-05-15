## Problema

No `LeadDetailSheet`, a renderização dos campos personalizados só trata os tipos `select` e `text` de forma específica. Todos os demais tipos (`multi_select`, `date`, `checkbox`, `number`, `currency`, `url`, `email`, `phone`) caem no fallback `InlineEditField type="text"`, mostrando um input de texto livre — por isso o campo "Objeção" aparece como string e as opções cadastradas não aparecem.

## Solução

Tratar todos os tipos de campos personalizados no painel de detalhes do lead, usando o `CustomFieldRenderer` já existente (que sabe renderizar `multi_select`, `date`, `checkbox`, etc.) para os tipos que o `InlineEditField` não cobre.

### Mudanças

**`src/components/leads/LeadDetailSheet.tsx`** (bloco "Campos Personalizados", ~linhas 496–538):

1. Manter `InlineEditField` para `text`, `number`, `currency`, `url`, `email`, `phone`, `select` (estendendo `InlineEditField` ou apenas mapeando para o tipo `text`/`select`/`currency` existente).
2. Para `multi_select`, `date` e `checkbox`, criar um pequeno wrapper de "campo editável via popover" que:
   - Mostra o valor formatado (badges para multi_select, data formatada, "Sim/Não" para checkbox) com o ícone `Tag` e label, no mesmo padrão visual do `InlineEditField`.
   - Ao clicar, abre um `Popover` contendo `<CustomFieldRenderer field={def} value={currentValue} onChange={...} />`.
   - Salva via `handleCustomFieldSave(def.id, value)` ao fechar o popover ou em um botão "Salvar" dentro dele.
3. Para `multi_select`, garantir parsing seguro: o valor é armazenado como JSON string (`"[...]"`); exibir como badges quando vazio ou inválido sem quebrar.

Não há mudanças de schema, hooks ou serviços — `useUpsertCustomFieldValue` e `CustomFieldRenderer` já suportam todos os tipos.

### Resultado

O campo "Objeção" (multi_select) passa a mostrar as opções cadastradas como badges selecionáveis, exatamente como no formulário de criação, e os demais tipos personalizados também ficam usáveis no drawer do lead.