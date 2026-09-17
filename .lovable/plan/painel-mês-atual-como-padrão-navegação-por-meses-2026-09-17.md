# Painel: mês atual como padrão + navegação por meses

## O que muda

1. Ao abrir o painel, ele já mostra os dados do **mês atual** (do dia 1 até hoje), em vez de "Últimos 30 dias".
2. No lugar do seletor de período aparece um **navegador de mês**: seta esquerda / nome do mês (ex. "Setembro 2026") / seta direita.
   - A seta direita fica desabilitada quando já se está no mês atual (não navega para o futuro).
   - Clicar no nome do mês abre a lista de meses (12 meses do ano corrente e anterior) para pular direto.
3. Ao lado, um **ícone de filtros** (deslizadores) abre um painel com as outras opções:
   - Períodos: Últimos 7 / 30 / 90 dias, Este ano, Personalizado (com as duas datas).
   - Seleção de funil ("Todos os funis" / funil específico).
   - Botão "Voltar para o mês atual".
4. Quando um período diferente de mês estiver ativo, o navegador de mês é substituído por um rótulo com o período escolhido (ex. "Últimos 90 dias") e um X para voltar ao mês atual. Assim fica sempre claro o que está aplicado.

Nenhum cálculo de indicador muda — apenas o período que alimenta os cartões e gráficos.

## Detalhes técnicos

- `src/hooks/useDashboard.ts`: `periodKey` inicial passa de `'30d'` para `'month'`, mantendo `targetMonth` = mês corrente. Adicionar helpers `goPrevMonth` / `goNextMonth` (ajustam `targetMonth`, bloqueiam futuro) e `isCurrentMonth`. Para `'month'`, quando o mês-alvo é o corrente, `dateTo` = agora (em vez de fim do mês) para não incluir dias futuros.
- `src/components/dashboard/DashboardFilters.tsx`: substituir o Select de período pelo navegador de mês (dois `Button` ícone `ChevronLeft`/`ChevronRight` + `Popover` com a lista de meses existente) e mover o Select de período, as datas personalizadas e o Select de funil para dentro de um `Popover` acionado por botão ícone `SlidersHorizontal`.
- `src/pages/DashboardPage.tsx`: repassar os novos handlers de navegação de mês para `DashboardFilters`.
- Sem mudanças no banco, nas RPCs ou em `src/services/dashboard.ts`.
