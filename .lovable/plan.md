## Objetivo

Permitir escolher um **mês-alvo específico** no dashboard (ex.: Março/2026) e ver todos os KPIs e gráficos daquele mês isolado, com base na **data de criação** do negócio.

## Mudanças

### 1. `src/hooks/useDashboard.ts`
- Novo valor em `PeriodKey`: `'month'`.
- Novo estado `targetMonth` (string `YYYY-MM`), default = mês atual.
- Em `computePeriod`, o caso `'month'` retorna `startOfMonth(mês-alvo)` até `endOfMonth(mês-alvo)`, sempre em cima de `created_at` (mesmo campo já usado hoje pelos RPCs do dashboard).
- `targetMonth` entra na dependência do `useMemo`, então as queries já invalidam sozinhas pela mudança de `dateFrom`/`dateTo`.

### 2. `src/components/dashboard/DashboardFilters.tsx`
- Nova opção "Mês específico" na lista de períodos.
- Quando selecionada, aparece ao lado um segundo select com os meses disponíveis: os 12 meses do ano corrente + os 12 do ano anterior, rotulados em português (ex.: "Março 2026"), do mais recente para o mais antigo. Meses futuros do ano corrente ficam desabilitados.
- Novas props `targetMonth` e `onTargetMonthChange`.

### 3. `src/pages/DashboardPage.tsx`
- Repassa `targetMonth` / `onTargetMonthChange` do hook para o componente de filtros.
- Onde o período é exibido em texto (subtítulos de cards), o rótulo passa a mostrar o mês escolhido (ex.: "Março 2026") em vez de "Últimos 30 dias".

## Detalhes técnicos

- A comparação com período anterior já existente em `get_dashboard_summary` continua funcionando: com mês fechado, o período anterior passa a ser exatamente o mês anterior — comportamento correto e desejável.
- O intervalo do gráfico de negócios por período (`getInterval`) resolve para `day` num mês (< 30 dias) ou `week` (31 dias); vou forçar `day` quando o período for um mês-alvo, para o gráfico mostrar a evolução diária dentro do mês.
- Nenhuma mudança de banco de dados ou RPC é necessária — só datas diferentes nos parâmetros já existentes.
