

# Dashboard com Metricas

## Resumo
Substituir o placeholder do DashboardPage por um dashboard completo com cards de resumo, graficos interativos (recharts) e ranking de equipe. Criar RPC functions no banco para queries agregadas performaticas, hooks dedicados e componentes modulares com loading skeletons.

## 1. Migration SQL - RPC Functions

Criar 4 funcoes RPC para agregar dados no servidor:

### get_dashboard_summary(p_org_id, p_funnel_id, p_date_from, p_date_to)
Retorna JSON com:
- total_leads: count de leads ativos (filtrado por funnel se informado)
- new_leads: count de leads criados no periodo
- new_leads_previous: count de leads criados no periodo anterior (para calcular variacao %)
- pipeline_value: sum de value de todos leads ativos
- conversion_count: leads que estao na ultima etapa (max position) criados no periodo

### get_leads_by_period(p_org_id, p_funnel_id, p_date_from, p_date_to, p_interval)
Retorna tabela (period_start, lead_count) agrupando leads criados por dia/semana/mes.

### get_funnel_metrics(p_org_id, p_funnel_id)
Retorna tabela (stage_id, stage_name, stage_color, stage_position, lead_count, total_value) para cada etapa do funil.

### get_team_ranking(p_org_id, p_date_from, p_date_to, p_funnel_id)
Retorna tabela (user_id, full_name, avatar_url, leads_count, converted_count, total_value) agrupado por assigned_to, ordenado por total_value desc, limit 10.

Todas as funcoes usam SECURITY DEFINER com validacao de que o usuario autenticado pertence a organizacao.

## 2. Services

### `src/services/dashboard.ts` (criar)
- `getDashboardSummary(orgId, funnelId, dateFrom, dateTo)` -- chama rpc get_dashboard_summary
- `getLeadsByPeriod(orgId, funnelId, dateFrom, dateTo, interval)` -- chama rpc get_leads_by_period
- `getFunnelMetrics(orgId, funnelId)` -- chama rpc get_funnel_metrics
- `getLeadsBySource(orgId, funnelId, dateFrom, dateTo)` -- query simples: select source, count(*) from leads group by source (sem RPC, pois e leve)
- `getTeamRanking(orgId, dateFrom, dateTo, funnelId)` -- chama rpc get_team_ranking
- `getPendingTasksCount(userId)` -- count de tasks com completed_at null
- `getOverdueTasksCount(userId)` -- count de tasks atrasadas

## 3. Hooks

### `src/hooks/useDashboard.ts` (criar)
- `useDashboardSummary(period, funnelId)` -- useQuery
- `useLeadsByPeriod(period, funnelId)` -- useQuery, calcula interval automaticamente (day/week/month)
- `useFunnelMetrics(funnelId)` -- useQuery
- `useLeadsBySource(period, funnelId)` -- useQuery
- `useTeamRanking(period, funnelId)` -- useQuery

O hook recebe um objeto `period` com `{ dateFrom, dateTo, key }` e o converte em parametros para os services.

### Helper: `useDashboardPeriod()`
Gerencia o estado do periodo selecionado. Retorna `{ period, setPeriodKey, setCustomRange }` com:
- Calculo automatico de dateFrom/dateTo baseado na opcao selecionada
- Calculo do periodo anterior para comparacao de variacao %

## 4. Componentes

### `src/components/dashboard/DashboardFilters.tsx` (criar)
- Select de periodo: "Ultimos 7 dias", "Ultimos 30 dias", "Ultimos 90 dias", "Este mes", "Mes passado", "Este ano", "Personalizado"
- Quando "Personalizado": date range picker inline
- Select de funil: "Todos os funis" + lista de funis da org

### `src/components/dashboard/SummaryCards.tsx` (criar)
- Grid de 6 cards usando shadcn Card
- Cada card: icone, titulo, valor principal, variacao % (onde aplicavel)
- Loading skeleton individual por card
- Cards: Total Leads, Novos Leads (com variacao %), Valor Pipeline, Taxa Conversao, Tarefas Pendentes, Tarefas Atrasadas

### `src/components/dashboard/FunnelChart.tsx` (criar)
- Barras horizontais decrescentes mostrando leads por etapa
- Usar recharts BarChart horizontal
- Cor de cada barra = cor da etapa
- Label com contagem e %

### `src/components/dashboard/LeadsByPeriodChart.tsx` (criar)
- AreaChart com gradiente azul
- Eixo X: datas formatadas
- Tooltip com data e contagem
- Skeleton enquanto carrega

### `src/components/dashboard/ValueByStageChart.tsx` (criar)
- BarChart horizontal
- Cada barra = etapa, valor = soma de lead.value
- Formato monetario R$ no eixo
- Cor = cor da etapa

### `src/components/dashboard/LeadsBySourceChart.tsx` (criar)
- PieChart/DonutChart
- Cada fatia = source
- Legenda lateral com contagem e %

### `src/components/dashboard/TeamRankingTable.tsx` (criar)
- Tabela com colunas: Avatar, Nome, Leads, Convertidos, Valor Total, Taxa Conversao
- Ordenado por valor total desc
- Max 10 linhas
- Skeleton enquanto carrega

## 5. Pagina DashboardPage

### `src/pages/DashboardPage.tsx` (reescrever)
Layout:
- Header com titulo "Dashboard" + DashboardFilters
- Grid de 6 SummaryCards (3 por linha desktop, 2 mobile)
- Grid 2x2 de graficos (desktop), 1 coluna (mobile/tablet):
  - FunnelChart + LeadsByPeriodChart
  - ValueByStageChart + LeadsBySourceChart
- TeamRankingTable full-width

Cada secao com seu proprio loading skeleton independente.

## Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| supabase/migrations/xxx.sql | Criar (4 RPC functions) |
| src/services/dashboard.ts | Criar |
| src/hooks/useDashboard.ts | Criar |
| src/components/dashboard/DashboardFilters.tsx | Criar |
| src/components/dashboard/SummaryCards.tsx | Criar |
| src/components/dashboard/FunnelChart.tsx | Criar |
| src/components/dashboard/LeadsByPeriodChart.tsx | Criar |
| src/components/dashboard/ValueByStageChart.tsx | Criar |
| src/components/dashboard/LeadsBySourceChart.tsx | Criar |
| src/components/dashboard/TeamRankingTable.tsx | Criar |
| src/pages/DashboardPage.tsx | Reescrever |

## Detalhes Tecnicos

### Formato monetario
Helper `formatCurrency(value)` que formata como R$ com abreviacao:
- < 1000: R$ 500
- >= 1000 e < 1M: R$ 1,5K
- >= 1M: R$ 1,2M

### Calculo de periodo anterior
Para variacao % dos "Novos Leads":
- Se periodo = ultimos 7 dias, periodo anterior = 7 dias antes disso
- Mesma logica para 30, 90 dias
- "Este mes": mes anterior
- "Este ano": ano anterior

### Intervalo do grafico de leads por periodo
- Periodo < 30 dias: agrupar por dia
- Periodo < 90 dias: agrupar por semana
- Periodo >= 90 dias: agrupar por mes

### RPC get_dashboard_summary
```sql
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_org_id uuid, p_funnel_id uuid, p_date_from timestamptz, p_date_to timestamptz
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_result jsonb;
  v_period_length interval;
  v_prev_from timestamptz;
  v_prev_to timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_period_length := p_date_to - p_date_from;
  v_prev_from := p_date_from - v_period_length;
  v_prev_to := p_date_from;

  SELECT jsonb_build_object(
    'total_leads', (SELECT count(*) FROM leads WHERE organization_id = p_org_id AND (p_funnel_id IS NULL OR funnel_id = p_funnel_id)),
    'new_leads', (SELECT count(*) FROM leads WHERE organization_id = p_org_id AND (p_funnel_id IS NULL OR funnel_id = p_funnel_id) AND created_at >= p_date_from AND created_at <= p_date_to),
    'new_leads_previous', (SELECT count(*) FROM leads WHERE organization_id = p_org_id AND (p_funnel_id IS NULL OR funnel_id = p_funnel_id) AND created_at >= v_prev_from AND created_at <= v_prev_to),
    'pipeline_value', COALESCE((SELECT sum(value) FROM leads WHERE organization_id = p_org_id AND (p_funnel_id IS NULL OR funnel_id = p_funnel_id)), 0),
    'conversion_count', (
      SELECT count(*) FROM leads l
      JOIN stages s ON l.stage_id = s.id
      WHERE l.organization_id = p_org_id
        AND (p_funnel_id IS NULL OR l.funnel_id = p_funnel_id)
        AND l.created_at >= p_date_from AND l.created_at <= p_date_to
        AND s.position = (SELECT max(s2.position) FROM stages s2 WHERE s2.funnel_id = l.funnel_id)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;
```

### RPC get_leads_by_period
```sql
CREATE OR REPLACE FUNCTION public.get_leads_by_period(
  p_org_id uuid, p_funnel_id uuid, p_date_from timestamptz, p_date_to timestamptz, p_interval text
) RETURNS TABLE(period_start timestamptz, lead_count bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
    SELECT date_trunc(p_interval, l.created_at) as period_start, count(*) as lead_count
    FROM leads l
    WHERE l.organization_id = p_org_id
      AND (p_funnel_id IS NULL OR l.funnel_id = p_funnel_id)
      AND l.created_at >= p_date_from AND l.created_at <= p_date_to
    GROUP BY 1 ORDER BY 1;
END;
$$;
```

### RPC get_funnel_metrics
```sql
CREATE OR REPLACE FUNCTION public.get_funnel_metrics(p_org_id uuid, p_funnel_id uuid)
RETURNS TABLE(stage_id uuid, stage_name text, stage_color text, stage_position int, lead_count bigint, total_value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
    SELECT s.id, s.name, s.color, s.position, count(l.id), COALESCE(sum(l.value), 0)
    FROM stages s
    LEFT JOIN leads l ON l.stage_id = s.id AND l.organization_id = p_org_id
    WHERE s.funnel_id = p_funnel_id AND s.organization_id = p_org_id
    GROUP BY s.id, s.name, s.color, s.position
    ORDER BY s.position;
END;
$$;
```

### RPC get_team_ranking
```sql
CREATE OR REPLACE FUNCTION public.get_team_ranking(
  p_org_id uuid, p_date_from timestamptz, p_date_to timestamptz, p_funnel_id uuid
) RETURNS TABLE(user_id uuid, full_name text, avatar_url text, leads_count bigint, converted_count bigint, total_value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
    SELECT l.assigned_to, p.full_name, p.avatar_url,
      count(*),
      count(*) FILTER (WHERE s.position = (SELECT max(s2.position) FROM stages s2 WHERE s2.funnel_id = l.funnel_id)),
      COALESCE(sum(l.value), 0)
    FROM leads l
    JOIN profiles p ON p.id = l.assigned_to
    JOIN stages s ON s.id = l.stage_id
    WHERE l.organization_id = p_org_id
      AND (p_funnel_id IS NULL OR l.funnel_id = p_funnel_id)
      AND l.created_at >= p_date_from AND l.created_at <= p_date_to
    GROUP BY l.assigned_to, p.full_name, p.avatar_url
    ORDER BY sum(l.value) DESC
    LIMIT 10;
END;
$$;
```

### Leads por fonte (sem RPC)
Query simples via supabase client:
```text
supabase.from('leads')
  .select('source')
  .eq('organization_id', orgId)
  .gte('created_at', dateFrom)
  .lte('created_at', dateTo)
```
Agrupar client-side por source e contar.

### Recharts
Usar componentes do recharts ja instalado:
- AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
- BarChart, Bar
- PieChart, Pie, Cell, Legend

### Cores dos graficos
- Pie chart: paleta de cores pre-definida para sources
- Barras: usar cor da etapa (stage.color)
- Area: gradiente azul (#3B82F6 -> transparent)

