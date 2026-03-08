
# Expandir Drawer do Lead — Estilo Bitrix

## Problema
O `SheetContent` atual usa `sm:max-w-lg` (~512px), muito estreito para exibir informações do lead com conforto.

## Solução
Expandir o drawer para 90% do viewport e reorganizar o conteúdo em layout de 2 colunas (estilo Bitrix CRM): painel esquerdo com informações do lead e painel direito com atividades/tarefas.

### Mudanças

**`src/components/leads/LeadDetailSheet.tsx`**:
- Alterar classe do `SheetContent` de `sm:max-w-lg` para `sm:max-w-[90vw]`
- Reorganizar conteúdo interno: remover Tabs e usar layout de 2 colunas (`grid grid-cols-1 lg:grid-cols-3`)
  - **Coluna esquerda (1/3)**: Header com nome, status, badges + dados de contato, responsável, funil, tags, campos personalizados, notas
  - **Coluna direita (2/3)**: Tabs apenas de Atividades e Tarefas empilhadas, com timeline e formulário rápido visíveis

**`src/components/ui/sheet.tsx`**:
- Atualizar o variant `right` para permitir larguras maiores que `sm:max-w-sm` (remover ou ampliar o max-width padrão, deixando o controle via className)

### Arquivos alterados
| Arquivo | Mudança |
|---------|---------|
| `src/components/ui/sheet.tsx` | Permitir larguras customizadas no variant right |
| `src/components/leads/LeadDetailSheet.tsx` | Expandir para 90vw, layout 2 colunas estilo Bitrix |
