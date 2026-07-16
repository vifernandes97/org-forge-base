## Objetivo

Melhorar a experiência visual da **List View de Leads no mobile** (hoje uma tabela com 10+ colunas que ficam espremidas e exigem scroll horizontal desconfortável em 390px).

## O que muda

Ajustes puramente visuais em `src/components/leads/list/ListView.tsx`. Nenhuma mudança em dados, filtros, ordenação ou lógica.

### 1. Layout responsivo com breakpoint
- **Desktop (≥ md)**: mantém a tabela atual, sem alterações.
- **Mobile (< md)**: substitui a `<Table>` por uma **lista de cards verticais**, um por lead.

### 2. Card mobile do lead (design)
Cada card compacto exibe apenas o essencial, aproveitando os dados que já vêm do hook:

```text
┌─────────────────────────────────────┐
│ ☐  Nome/Razão Social      [Etapa]   │
│    Empresa · R$ 1.200               │
│    ─────────────────────────────    │
│    👤 Responsável   ⏱ há 2h         │
│    [Prioridade] [Status]            │
└─────────────────────────────────────┘
```

- Checkbox de seleção alinhado à esquerda.
- Título em `font-medium` (company_name || name), truncado.
- Badge da etapa à direita (mesma cor da coluna).
- Linha secundária: empresa + valor em `text-xs text-muted-foreground`.
- Rodapé: avatar do responsável, tempo relativo da última atividade, badges de prioridade e status.
- Clique no card abre o `LeadDetailSheet` (mesmo comportamento da linha).

### 3. Barra de topo no mobile
- Botão **Colunas** fica oculto no mobile (`hidden md:inline-flex`) — não faz sentido em layout de cards.
- `BulkActionsBar` continua funcionando (mesma lógica de `selectedIds`).

### 4. Paginação no mobile
- Empilha em duas linhas: contador + selector de page size em cima, botões de navegação embaixo, para não estourar a largura.
- Usa `flex-col gap-2 sm:flex-row sm:justify-between`.

### 5. Detalhes técnicos
- Sem novos componentes/arquivos; tudo dentro de `ListView.tsx` para manter escopo mínimo.
- Uso de `hidden md:block` / `md:hidden` para alternar entre tabela e lista de cards.
- Zero mudanças em: hooks (`useLeadsList`), tipos, filtros, `BulkActionsBar`, `LeadDetailSheet`.

## Arquivos alterados
- `src/components/leads/list/ListView.tsx`
