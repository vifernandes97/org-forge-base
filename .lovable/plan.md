

# Sistema de Filtros Inteligentes

## Resumo
Criar a tabela `saved_filters` com RLS multi-tenant, implementar uma barra de filtros colapsavel na pagina de leads (funciona tanto no Kanban quanto na Lista), com filtros padrao e dinamicos para campos personalizados, filtros salvos com compartilhamento, e sincronizacao dos filtros com a URL via query params.

## 1. Migration SQL

### Tabela saved_filters

```sql
CREATE TABLE public.saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  name text NOT NULL,
  filters jsonb NOT NULL,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_filters_org_id ON public.saved_filters(organization_id);
CREATE INDEX idx_saved_filters_user_id ON public.saved_filters(user_id);

ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own and shared filters" ON public.saved_filters
  FOR SELECT USING (
    organization_id IN (SELECT get_user_org_ids())
    AND (user_id = auth.uid() OR is_shared = true)
  );

CREATE POLICY "Owner/admin/member can insert filters" ON public.saved_filters
  FOR INSERT WITH CHECK (
    get_user_org_role(organization_id) IN ('owner','admin','member')
    AND user_id = auth.uid()
  );

CREATE POLICY "Creator can delete own filters" ON public.saved_filters
  FOR DELETE USING (user_id = auth.uid());
```

## 2. Tipos TypeScript

### `src/types/index.ts`
Adicionar:

```text
SavedFilter {
  id, organization_id, user_id, name, filters (jsonb), is_shared, created_at
}

LeadFilters {
  search?: string
  stage_ids?: string[]
  assigned_to?: string[] (inclui '__none__' para "Sem responsavel")
  priorities?: LeadPriority[]
  tags?: string[]
  sources?: string[]
  value_min?: number
  value_max?: number
  created_at_from?: string
  created_at_to?: string
  last_activity_from?: string
  last_activity_to?: string
  stage_time?: 'less_24h' | '1_3_days' | '3_7_days' | 'more_7_days' | 'above_sla'
  custom_fields?: Record<string, any> (field_definition_id -> valor do filtro)
}
```

## 3. Services

### `src/services/savedFilters.ts` (criar)
- `getSavedFilters(orgId)` -- lista filtros do usuario + compartilhados da org
- `createSavedFilter(data)` -- insert
- `deleteSavedFilter(id)` -- delete

## 4. Hooks

### `src/hooks/useSavedFilters.ts` (criar)
- `useSavedFilters()` -- useQuery com queryKey `['saved-filters', orgId]`
- `useCreateSavedFilter()` -- useMutation + invalida
- `useDeleteSavedFilter()` -- useMutation + invalida

### `src/hooks/useLeadFilters.ts` (criar)
Hook central que gerencia o estado dos filtros:
- Inicializa filtros a partir dos query params da URL (useSearchParams)
- Serializa/deserializa filtros para/de query params
- Fornece `filters`, `setFilter(key, value)`, `clearFilters()`, `activeFilterCount`
- Debounce de 300ms no campo de busca por texto
- Retorna os filtros no formato `LeadFilters`

## 5. Modificacoes nos Services/Hooks de Leads

### `src/services/leads.ts` (editar)
- `getLeadsByFunnel(funnelId, filters?)` -- adicionar parametro opcional de filtros
  - Aplicar filtros na query Supabase: `.ilike('name', '%search%')`, `.in('stage_id', [...])`, `.in('priority', [...])`, `.gte('value', min)`, `.lte('value', max)`, `.gte('created_at', from)`, `.lte('created_at', to)`, `.contains('tags', [tag])`, etc.
  - Para busca por texto: combinar name, email, company, phone com `.or('name.ilike.%search%,email.ilike.%search%,company.ilike.%search%,phone.ilike.%search%')`
  - Para "Sem responsavel": `.is('assigned_to', null)`
  - Para campos personalizados: filtrar client-side apos fetch (evita joins complexos no Supabase client)
  - Para "tempo na etapa": calcular client-side baseado em `stage_entered_at`

- `getLeadsListPaginated(funnelId, page, pageSize, sortBy, sortOrder, filters?)` -- mesmo tratamento

### `src/hooks/useLeads.ts` (editar)
- `useLeadsByFunnel(funnelId, filters?)` -- adicionar filtros ao queryKey e passar para service
- `useLeadsList(funnelId, page, pageSize, sortBy, sortOrder, filters?)` -- idem

## 6. Componentes

### `src/components/leads/filters/LeadFilterBar.tsx` (criar)
Barra principal de filtros abaixo do header da LeadsPage:
- Estado colapsado: input de busca por texto + botao "Filtros" com badge de contagem + dropdown "Filtros salvos"
- Estado expandido: grid responsivo com todos os filtros
- Botao "Limpar filtros" quando ha filtros ativos
- Botao "Salvar filtro" (icone estrela) quando ha filtros ativos

### `src/components/leads/filters/FilterMultiSelect.tsx` (criar)
Componente reutilizavel de multi-select com popover para filtros de etapa, responsavel, prioridade, tags, fonte.

### `src/components/leads/filters/FilterDateRange.tsx` (criar)
Date range picker para filtros de data (criacao, ultima atividade).

### `src/components/leads/filters/FilterValueRange.tsx` (criar)
Dois inputs numericos para valor minimo e maximo.

### `src/components/leads/filters/CustomFieldFilters.tsx` (criar)
Renderiza filtros dinamicos baseados nos campos personalizados ativos:
- text/url/email/phone: input de texto
- number/currency: range (min/max)
- date: date range picker
- select: select com opcoes do campo
- multi_select: multi-select com opcoes do campo
- checkbox: toggle (sim/nao/qualquer)

### `src/components/leads/filters/SaveFilterDialog.tsx` (criar)
Modal para salvar filtro com nome e toggle "Compartilhar com a organizacao".

### `src/components/leads/filters/SavedFiltersDropdown.tsx` (criar)
Dropdown listando filtros salvos do usuario e compartilhados, com opcao de deletar os proprios.

## 7. Integracoes com codigo existente

### `src/pages/LeadsPage.tsx` (editar)
- Importar `useLeadFilters` e `LeadFilterBar`
- Renderizar `<LeadFilterBar>` entre o header e o conteudo (Kanban/Lista)
- Passar `filters` para `<KanbanView>` e `<ListView>`

### `src/components/leads/kanban/KanbanView.tsx` (editar)
- Receber `filters` como prop
- Passar para `useLeadsByFunnel(funnelId, filters)`
- Aplicar filtros client-side para campos personalizados e tempo na etapa (filtrar `leads` antes de agrupar por stage)

### `src/components/leads/list/ListView.tsx` (editar)
- Receber `filters` como prop
- Passar para `useLeadsList(funnelId, page, pageSize, sortBy, sortOrder, filters)`

## Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| supabase/migrations/xxx.sql | Criar (tabela saved_filters) |
| src/types/index.ts | Editar (SavedFilter, LeadFilters) |
| src/services/savedFilters.ts | Criar |
| src/hooks/useSavedFilters.ts | Criar |
| src/hooks/useLeadFilters.ts | Criar |
| src/services/leads.ts | Editar (adicionar filtros) |
| src/hooks/useLeads.ts | Editar (passar filtros) |
| src/components/leads/filters/LeadFilterBar.tsx | Criar |
| src/components/leads/filters/FilterMultiSelect.tsx | Criar |
| src/components/leads/filters/FilterDateRange.tsx | Criar |
| src/components/leads/filters/FilterValueRange.tsx | Criar |
| src/components/leads/filters/CustomFieldFilters.tsx | Criar |
| src/components/leads/filters/SaveFilterDialog.tsx | Criar |
| src/components/leads/filters/SavedFiltersDropdown.tsx | Criar |
| src/pages/LeadsPage.tsx | Editar (integrar barra de filtros) |
| src/components/leads/kanban/KanbanView.tsx | Editar (receber filtros) |
| src/components/leads/list/ListView.tsx | Editar (receber filtros) |

## Detalhes Tecnicos

### Estrategia de filtragem

Filtros aplicados **server-side** (na query Supabase):
- search (`.or` com ilike em name, email, company, phone)
- stage_ids (`.in('stage_id', [...])`)
- assigned_to (`.in('assigned_to', [...])` + caso especial `.is('assigned_to', null)`)
- priorities (`.in('priority', [...])`)
- sources (`.in('source', [...])`)
- value_min/max (`.gte('value', min)` / `.lte('value', max)`)
- created_at range (`.gte('created_at', from)` / `.lte('created_at', to)`)
- last_activity range (`.gte('last_activity_at', from)` / `.lte('last_activity_at', to)`)
- tags (multiplos `.contains('tags', [tag])` para cada tag selecionada)

Filtros aplicados **client-side** (apos fetch):
- stage_time: calcular `differenceInHours(now, stage_entered_at)` e filtrar
- custom_fields: buscar `custom_field_values` do lead e comparar com filtro
  - Para Kanban, os leads ja sao carregados completos, entao filtramos em memoria
  - Para Lista paginada, incluir custom_field_values no select e filtrar client-side dentro da pagina

### Sincronizacao com URL
O hook `useLeadFilters` usa `useSearchParams` do react-router-dom:
- Cada filtro vira um query param (ex: `?search=joao&priorities=high,urgent&value_min=1000`)
- Arrays sao serializados como comma-separated
- Ao alterar filtros, atualiza a URL sem navegacao (replace)
- Ao carregar a pagina, inicializa filtros a partir da URL

### Debounce na busca
O campo de busca por texto usa um estado local com debounce de 300ms antes de atualizar o filtro real (evita queries excessivas).

### Kanban com filtros
No Kanban, os filtros nao escondem colunas (etapas) -- todas as colunas continuam visiveis. Apenas os cards sao filtrados. As colunas vazias apos filtragem mostram contagem "0" e ficam com aspecto atenuado.

### Performance
- A query do Kanban ja carrega todos os leads do funil; os filtros server-side reduzem o volume
- A query da Lista ja e paginada; os filtros server-side se aplicam antes da paginacao
- Para orgs com muitos leads (>1000), os filtros server-side sao essenciais para performance

