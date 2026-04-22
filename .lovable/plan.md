

# Qualificação rápida via hover no card do Kanban

## Comportamento

No hover do card (Kanban), a linha de estrelas torna-se **interativa**, permitindo qualificar o lead diretamente sem abrir o drawer.

### Estados visuais

| Estado | O que aparece |
|---|---|
| **Sem qualificação + sem hover** | Linha vazia (apenas tempo à direita, como hoje) |
| **Sem qualificação + hover** | 5 estrelas vazias clicáveis |
| **Com qualificação + sem hover** | Estrelas preenchidas (como hoje) |
| **Com qualificação + hover** | Estrelas preenchidas + hover individual em cada estrela mostra preview da nota |

### Interações

- **Click em uma estrela** → salva `qualification = N` (1 a 5).
- **Click na estrela já selecionada** (mesma nota atual) → limpa qualificação (`qualification = 0` ou `null`).
- **Hover em uma estrela** → preview visual: estrelas até a posição do cursor ficam amarelas; restantes cinza.
- **stopPropagation** em todos os clicks para não abrir o drawer.

## Implementação

### 1. Novo componente `StarRating` reutilizável
`src/components/leads/kanban/StarRating.tsx`:
- Props: `value: number`, `onChange: (n: number) => void`, `size?: 'sm' | 'md'`.
- Estado local `hoverValue` para preview ao passar o mouse.
- Renderiza 5 botões `<button>` com `Star` do lucide-react.
- Cada estrela tem `onMouseEnter`, `onMouseLeave`, `onClick`.
- Lógica de toggle: se clicar na mesma nota atual, envia `0`.

### 2. Atualizar `KanbanCard.tsx`
- Import `StarRating` + hook `useUpdateLead` (já existe em `useLeads.ts`).
- Substituir o bloco atual de renderização das estrelas pelo `<StarRating>`.
- `onChange` chama `updateLead.mutate({ id: lead.id, qualification: newValue || null })`.
- **Sempre renderizar a linha das estrelas** (não condicionar a `qualification > 0`), para garantir que o usuário possa qualificar leads ainda sem nota — usar opacidade reduzida (`opacity-0 group-hover:opacity-100 transition-opacity`) quando `qualification === 0` para não poluir visualmente.
- O elemento pai do card já tem `group` implícito; adicionar a classe `group` se ainda não existir.

### 3. `DragOverlayCard.tsx`
- **Não alterar** comportamento — durante o arrasto não faz sentido editar. Mantém estrelas como display puro (sem hover/click).

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/leads/kanban/StarRating.tsx` | **Novo** componente interativo de 1–5 estrelas com hover preview e toggle |
| `src/components/leads/kanban/KanbanCard.tsx` | Trocar render estático por `StarRating`; sempre renderizar linha (com fade-in no hover quando vazio); chamar `useUpdateLead` |

## Detalhes técnicos

- O `useDraggable` do dnd-kit usa `listeners` no card inteiro. Os botões de estrela precisam de `e.stopPropagation()` no `onClick` **e** `onPointerDown` para evitar que o drag inicie ao clicar na estrela.
- Mesmo padrão já usado no botão de WhatsApp adicionado anteriormente — apenas estender para os botões de estrela.
- Toast de sucesso opcional; provavelmente desnecessário pois o feedback visual já é imediato. **Decisão: sem toast** para manter a interação fluida.

## Resultado

- Qualificar um lead vira ação de 1 clique direto no Kanban.
- Cards sem qualificação ganham UI de qualificação apenas no hover, mantendo o visual limpo no estado de repouso.
- Cards com qualificação permitem ajuste rápido (mudar nota ou limpar) sem abrir o drawer.

