## Problema

Na tela `/leads` a página inteira rola horizontalmente em vez de apenas o quadro Kanban. Os botões do topo direito (visão, exportar, novo negócio) saem da área visível até o usuário arrastar tudo para o lado.

## Causa

O Kanban já usa `overflow-x-auto` (`src/components/leads/kanban/KanbanView.tsx`), mas o contêiner pai não limita a largura: em `src/components/layout/MainLayout.tsx` a coluna de conteúdo (`flex flex-1 flex-col` + `<main class="flex-1 p-4 sm:p-6">`) não tem `min-width: 0`. Por padrão, um item flex não encolhe abaixo do tamanho do conteúdo, então as colunas de 300px do Kanban esticam o layout inteiro, incluindo o cabeçalho.

## Solução

1. `src/components/layout/MainLayout.tsx`
   - Adicionar `min-w-0` (e `w-full`) na coluna de conteúdo e `min-w-0 overflow-x-hidden` no `<main>`, para que o conteúdo respeite a largura disponível ao lado da sidebar.
2. `src/pages/LeadsPage.tsx`
   - Garantir `min-w-0` no wrapper principal da página, para que header e board não sejam esticados pelo conteúdo largo.
3. `src/components/leads/kanban/KanbanView.tsx`
   - Manter/reforçar `overflow-x-auto` com `min-w-0 w-full` nos dois contêineres de colunas (linhas ~157 e ~191), garantindo que a barra de rolagem horizontal apareça dentro do board.

## Verificação

Abrir `/leads` no preview (desktop e mobile) via Playwright, conferir que:
- o cabeçalho e os botões ficam fixos e visíveis,
- a rolagem horizontal ocorre somente dentro do Kanban,
- a visão em lista continua correta.
