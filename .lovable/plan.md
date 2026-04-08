

# Seletor de Colunas Visíveis na ListView

## Resumo
Adicionar um dropdown com toggles (checkboxes) acima da tabela de leads no modo lista, permitindo ao usuário escolher quais colunas exibir. A preferência será salva no localStorage.

## Mudanças

### `src/components/leads/list/ListView.tsx`

1. **Definir mapa de colunas** com array de objetos `{ key, label, defaultVisible }` para as 13 colunas existentes (Nome, Empresa, Razão Social, E-mail, Telefone, Etapa, Responsável, Valor, Prioridade, Status, Tags, Última atividade, Criado em).

2. **Estado `visibleColumns`** inicializado a partir do `localStorage` (chave `crm_leads_visible_cols`), com fallback para as colunas visíveis por padrão. Salvar no localStorage a cada mudança.

3. **Dropdown de colunas** usando `Popover` + lista de `Checkbox` com o label de cada coluna. Botão trigger com ícone `SlidersHorizontal` e texto "Colunas", posicionado acima da tabela (ao lado da barra de ações em massa ou no topo).

4. **Renderização condicional** das `TableHead` e `TableCell` — cada coluna só renderiza se `visibleColumns.includes(key)`. Remover as classes `hidden md:table-cell` / `hidden lg:table-cell` fixas, já que a visibilidade será controlada pelo estado.

5. **Atualizar `colSpan`** da linha vazia para usar `visibleColumns.length + 1` (checkbox sempre visível).

| Arquivo | Ação |
|---------|------|
| `src/components/leads/list/ListView.tsx` | Seletor de colunas + renderização condicional |

