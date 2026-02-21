
# Sistema de Funis e Etapas

## Resumo
Criar o modulo completo de Funis (Funnels) e Etapas (Stages) para o CRM multi-tenant, incluindo tabelas no banco, RLS, paginas de listagem e edicao, drag-and-drop para reordenar etapas, e integracao com a sidebar.

## 1. Migration SQL

Criar uma migration com:

### Tabelas
- `funnels` com colunas: id, organization_id (FK), name, description, is_default, created_at, updated_at
- `stages` com colunas: id, funnel_id (FK CASCADE), organization_id (FK), name, color, position, sla_hours, webhook_url, created_at, updated_at, UNIQUE(funnel_id, position)
- Trigger `update_updated_at_column` em ambas as tabelas

### RLS (PERMISSIVE, usando `get_user_org_ids()` e `get_user_org_role()`)

**funnels:**
- SELECT: `organization_id IN (SELECT get_user_org_ids())`
- INSERT: `get_user_org_role(organization_id) IN ('owner','admin')` AND `organization_id IN (SELECT get_user_org_ids())`
- UPDATE: `get_user_org_role(organization_id) IN ('owner','admin')`
- DELETE: `get_user_org_role(organization_id) IN ('owner','admin')`

**stages:**
- SELECT: `organization_id IN (SELECT get_user_org_ids())`
- INSERT: `get_user_org_role(organization_id) IN ('owner','admin')`
- UPDATE: `get_user_org_role(organization_id) IN ('owner','admin')`
- DELETE: `get_user_org_role(organization_id) IN ('owner','admin')`

### Funcao SECURITY DEFINER
- `create_funnel_with_default_stages(p_org_id uuid, p_name text, p_description text)` -- cria funil + 4 etapas padrao atomicamente, similar ao padrao ja usado para organizacoes.

## 2. Tipos TypeScript

### `src/types/index.ts`
Adicionar interfaces `Funnel` e `Stage`.

## 3. Services

### `src/services/funnels.ts`
- `getFunnels(orgId)` -- lista funis da org
- `getFunnel(id)` -- detalhe do funil
- `createFunnel(orgId, name, description)` -- via RPC `create_funnel_with_default_stages`
- `updateFunnel(id, data)` -- update name/description/is_default
- `deleteFunnel(id)` -- delete
- `setDefaultFunnel(orgId, funnelId)` -- desmarcar outros, marcar este

### `src/services/stages.ts`
- `getStages(funnelId)` -- lista stages ordenadas por position
- `createStage(data)` -- insert
- `updateStage(id, data)` -- update
- `deleteStage(id)` -- delete
- `reorderStages(stages: {id, position}[])` -- batch update positions

## 4. Hooks (TanStack Query)

### `src/hooks/useFunnels.ts`
- `useFunnels()` -- useQuery com orgId do contexto
- `useCreateFunnel()` -- useMutation + invalidate
- `useUpdateFunnel()` -- useMutation + invalidate
- `useDeleteFunnel()` -- useMutation + invalidate

### `src/hooks/useStages.ts`
- `useStages(funnelId)` -- useQuery
- `useCreateStage()` -- useMutation + invalidate
- `useUpdateStage()` -- useMutation + invalidate
- `useDeleteStage()` -- useMutation + invalidate
- `useReorderStages()` -- useMutation + invalidate

## 5. Paginas

### `src/pages/FunnelsPage.tsx` (rota `/settings/funnels`)
- Lista funis em cards com nome, descricao, badge "padrao", contagem de etapas
- Botao "Novo Funil" abre dialog com campos nome e descricao (validacao com zod)
- Clique no card navega para `/settings/funnels/:id`
- Owner/admin veem botoes de acao; member/viewer veem somente leitura

### `src/pages/FunnelEditPage.tsx` (rota `/settings/funnels/:id`)
- Header com nome e descricao editaveis inline
- Toggle "Funil Padrao"
- Lista de etapas com drag-and-drop (@dnd-kit/sortable)
- Cada etapa: color picker, nome editavel, SLA (input numerico), webhook URL, botao deletar
- Botao "Adicionar Etapa" no final
- Botao "Deletar Funil" com AlertDialog de confirmacao
- Impedir deletar ultima etapa

## 6. Componentes

### `src/components/funnels/FunnelCard.tsx`
Card com info do funil para a listagem.

### `src/components/funnels/CreateFunnelDialog.tsx`
Dialog modal com formulario de criacao.

### `src/components/funnels/StageItem.tsx`
Item individual de etapa com campos editaveis, usado dentro do sortable list.

### `src/components/funnels/StageList.tsx`
Container com DndContext + SortableContext para drag-and-drop das etapas.

## 7. Sidebar

### `src/components/layout/AppSidebar.tsx`
Atualizar para ter "Configuracoes" como grupo com sub-item "Funis" apontando para `/settings/funnels`. Remover o item "Configuracoes" generico da lista principal.

## 8. Rotas

### `src/App.tsx`
Adicionar rotas:
- `/settings/funnels` -> `FunnelsPage` (dentro de PrivateRoute + MainLayout)
- `/settings/funnels/:id` -> `FunnelEditPage` (dentro de PrivateRoute + MainLayout)

## 9. Dependencia

Instalar `@dnd-kit/core` e `@dnd-kit/sortable` e `@dnd-kit/utilities` para drag-and-drop.

## Detalhes Tecnicos

### Migration SQL completa

```sql
-- funnels table
CREATE TABLE public.funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- stages table
CREATE TABLE public.stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  position integer NOT NULL,
  sla_hours integer,
  webhook_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(funnel_id, position)
);

-- Triggers
CREATE TRIGGER update_funnels_updated_at
  BEFORE UPDATE ON public.funnels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stages_updated_at
  BEFORE UPDATE ON public.stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

-- Funnels policies (PERMISSIVE)
CREATE POLICY "Members can view funnels" ON public.funnels
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin can insert funnels" ON public.funnels
  FOR INSERT WITH CHECK (
    get_user_org_role(organization_id) IN ('owner','admin')
  );

CREATE POLICY "Owner/admin can update funnels" ON public.funnels
  FOR UPDATE USING (
    get_user_org_role(organization_id) IN ('owner','admin')
  );

CREATE POLICY "Owner/admin can delete funnels" ON public.funnels
  FOR DELETE USING (
    get_user_org_role(organization_id) IN ('owner','admin')
  );

-- Stages policies (PERMISSIVE)
CREATE POLICY "Members can view stages" ON public.stages
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin can insert stages" ON public.stages
  FOR INSERT WITH CHECK (
    get_user_org_role(organization_id) IN ('owner','admin')
  );

CREATE POLICY "Owner/admin can update stages" ON public.stages
  FOR UPDATE USING (
    get_user_org_role(organization_id) IN ('owner','admin')
  );

CREATE POLICY "Owner/admin can delete stages" ON public.stages
  FOR DELETE USING (
    get_user_org_role(organization_id) IN ('owner','admin')
  );

-- SECURITY DEFINER function for atomic funnel creation
CREATE OR REPLACE FUNCTION public.create_funnel_with_default_stages(
  p_org_id uuid, p_name text, p_description text DEFAULT NULL
)
RETURNS public.funnels
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_funnel public.funnels;
  v_user_id uuid;
  v_role text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_role := get_user_org_role(p_org_id);
  IF v_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;

  INSERT INTO public.funnels (organization_id, name, description)
  VALUES (p_org_id, p_name, p_description)
  RETURNING * INTO v_funnel;

  INSERT INTO public.stages (funnel_id, organization_id, name, color, position) VALUES
    (v_funnel.id, p_org_id, 'Novo Lead',     '#6B7280', 0),
    (v_funnel.id, p_org_id, 'Qualificação',  '#3B82F6', 1),
    (v_funnel.id, p_org_id, 'Proposta',      '#EAB308', 2),
    (v_funnel.id, p_org_id, 'Fechamento',    '#22C55E', 3);

  RETURN v_funnel;
END;
$$;
```

### Reorder strategy
Para reordenar etapas, primeiro dropar a UNIQUE constraint temporariamente nao e viavel. Em vez disso, a funcao `reorderStages` fara updates individuais com position negativo temporario para evitar conflitos, ou usara uma funcao SECURITY DEFINER que faz o batch update em uma transacao desabilitando a constraint temporariamente. A abordagem mais simples: usar `DEFERRABLE INITIALLY IMMEDIATE` na constraint UNIQUE para permitir reordenacao dentro de uma transacao. A migration usara:

```sql
UNIQUE(funnel_id, position) DEFERRABLE INITIALLY DEFERRED
```

Isso permite que dentro de uma transacao os positions sejam atualizados sem conflito.

### Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/xxx.sql` | Criar |
| `src/types/index.ts` | Editar (adicionar Funnel, Stage) |
| `src/services/funnels.ts` | Criar |
| `src/services/stages.ts` | Criar |
| `src/hooks/useFunnels.ts` | Criar |
| `src/hooks/useStages.ts` | Criar |
| `src/pages/FunnelsPage.tsx` | Criar |
| `src/pages/FunnelEditPage.tsx` | Criar |
| `src/components/funnels/FunnelCard.tsx` | Criar |
| `src/components/funnels/CreateFunnelDialog.tsx` | Criar |
| `src/components/funnels/StageItem.tsx` | Criar |
| `src/components/funnels/StageList.tsx` | Criar |
| `src/components/layout/AppSidebar.tsx` | Editar |
| `src/App.tsx` | Editar |
