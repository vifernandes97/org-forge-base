

# Refinar card do Kanban

## Mudanças no card

Remover a bolinha colorida de prioridade e adicionar dois novos elementos: botão de WhatsApp e qualificação em estrelas.

### Novo layout do card

```text
┌─────────────────────────────────────────┐
│ Razão Social / Nome           [👤] [💬] │  ← Row 1: identificador + avatar + WhatsApp
│ Nome do contato                         │  ← Row 2: company (se existir)
│ ★★★★☆                          há 2h   │  ← Row 3: estrelas + tempo
└─────────────────────────────────────────┘
```

## Detalhes

### 1. Remover bolinha de prioridade
- Apagar o `<span>` com `priorityDotColor` da Row 1.
- Remover o objeto `priorityDotColor` (não é mais usado).
- Aplicar a mesma remoção no `DragOverlayCard.tsx` para manter consistência visual durante o arrasto.

### 2. Botão WhatsApp
- Ícone `MessageCircle` do `lucide-react` (ou `Phone`), tamanho `h-4 w-4`, dentro de um `<button>` com `onClick` que:
  - Faz `e.stopPropagation()` para não abrir o drawer.
  - Normaliza `lead.phone` removendo tudo exceto dígitos.
  - Abre `https://wa.me/{phone}` em nova aba via `window.open(..., '_blank')`.
- Renderizar **apenas se `lead.phone` existir**.
- Estilo: `text-muted-foreground hover:text-green-600 transition-colors` para indicar ação.
- Posicionado à direita do avatar na Row 1.

### 3. Qualificação em estrelas
- Adicionar nova Row entre o `company` e o `created_at`.
- Renderizar 5 estrelas usando `Star` do `lucide-react` (`h-3 w-3`).
- Estrelas preenchidas (`fill-yellow-400 text-yellow-400`) até `lead.qualification` (1-5); restantes vazias (`text-muted-foreground/30`).
- **Renderizar apenas se `lead.qualification && lead.qualification > 0`** — leads sem qualificação não mostram a linha.
- Posicionar à esquerda; o tempo relativo (`created_at`) fica alinhado à direita na mesma linha (`flex justify-between items-center`).

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/leads/kanban/KanbanCard.tsx` | Remover bolinha de prioridade; adicionar botão WhatsApp condicional; adicionar linha de estrelas + tempo lado a lado |
| `src/components/leads/kanban/DragOverlayCard.tsx` | Espelhar mudanças visuais (sem botão clicável, mas com estrelas) para o overlay durante drag |

## Resultado

- Cards mais informativos: identifica imediatamente a qualificação do lead sem precisar abrir o drawer.
- Ação rápida de contato via WhatsApp diretamente do Kanban (apenas para leads com telefone).
- Visual mais limpo sem a bolinha colorida que gerava dúvidas.

