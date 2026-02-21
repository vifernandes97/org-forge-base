
# Sistema de Campos Personalizados

## Resumo
Adicionar o modulo de Campos Personalizados (Custom Fields) ao CRM, com duas tabelas no banco, pagina de gerenciamento com drag-and-drop, e componente reutilizavel de renderizacao dinamica para uso futuro nos formularios de leads.

## 1. Migration SQL

### Tabelas

**custom_field_definitions**
- id, organization_id (FK), field_name, field_label, field_type, options (jsonb), is_required, is_active, position, created_at, updated_at
- UNIQUE(organization_id, field_name) DEFERRABLE INITIALLY DEFERRED (para permitir reordenacao)
- Trigger update_updated_at_column
- Validacao de field_type via CHECK constraint (valores estaticos, sem problema de imutabilidade)

**custom_field_values**
- id, lead_id (uuid, sem FK por enquanto), field_definition_id (FK CASCADE), value (text), created_at, updated_at
- UNIQUE(lead_id, field_definition_id)
- Trigger update_updated_at_column

### RLS
Mesma logica multi-tenant usando `get_user_org_ids()` e `get_user_org_role()`:

**custom_field_definitions:**
- SELECT: `organization_id IN (SELECT get_user_org_ids())`
- INSERT/UPDATE/DELETE: `get_user_org_role(organization_id) IN ('owner','admin')`

**custom_field_values:**
- SELECT: acesso via join com field_definition (verificar org_id da definition)
- INSERT/UPDATE/DELETE: mesma logica owner/admin via subquery no field_definition

### Funcao SECURITY DEFINER
- `reorder_custom_fields(p_fields jsonb)` -- batch update de positions, mesmo padrao do `reorder_stages`

### SQL completo

```sql
-- custom_field_definitions
CREATE TABLE public.custom_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text','number','currency','date','select','multi_select','checkbox','url','email','phone')),
  options jsonb,
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_org_field_name UNIQUE(organization_id, field_name) DEFERRABLE INITIALLY DEFERRED
);

CREATE TRIGGER update_custom_field_definitions_updated_at
  BEFORE UPDATE ON public.custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view custom fields" ON public.custom_field_definitions
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin can insert custom fields" ON public.custom_field_definitions
  FOR INSERT WITH CHECK (get_user_org_role(organization_id) IN ('owner','admin'));

CREATE POLICY "Owner/admin can update custom fields" ON public.custom_field_definitions
  FOR UPDATE USING (get_user_org_role(organization_id) IN ('owner','admin'));

CREATE POLICY "Owner/admin can delete custom fields" ON public.custom_field_definitions
  FOR DELETE USING (get_user_org_role(organization_id) IN ('owner','admin'));

-- custom_field_values (lead_id sem FK por enquanto)
CREATE TABLE public.custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  field_definition_id uuid NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id, field_definition_id)
);

CREATE TRIGGER update_custom_field_values_updated_at
  BEFORE UPDATE ON public.custom_field_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view field values" ON public.custom_field_values
  FOR SELECT USING (
    field_definition_id IN (
      SELECT id FROM public.custom_field_definitions
      WHERE organization_id IN (SELECT get_user_org_ids())
    )
  );

CREATE POLICY "Owner/admin can insert field values" ON public.custom_field_values
  FOR INSERT WITH CHECK (
    field_definition_id IN (
      SELECT id FROM public.custom_field_definitions
      WHERE get_user_org_role(organization_id) IN ('owner','admin')
    )
  );

CREATE POLICY "Owner/admin can update field values" ON public.custom_field_values
  FOR UPDATE USING (
    field_definition_id IN (
      SELECT id FROM public.custom_field_definitions
      WHERE get_user_org_role(organization_id) IN ('owner','admin')
    )
  );

CREATE POLICY "Owner/admin can delete field values" ON public.custom_field_values
  FOR DELETE USING (
    field_definition_id IN (
      SELECT id FROM public.custom_field_definitions
      WHERE get_user_org_role(organization_id) IN ('owner','admin')
    )
  );

-- Reorder function
CREATE OR REPLACE FUNCTION public.reorder_custom_fields(p_fields jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_role text;
  v_item jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT organization_id INTO v_org_id
  FROM public.custom_field_definitions
  WHERE id = (p_fields->0->>'id')::uuid;

  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Field not found'; END IF;

  v_role := get_user_org_role(v_org_id);
  IF v_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_fields)
  LOOP
    UPDATE public.custom_field_definitions
    SET position = (v_item->>'position')::integer
    WHERE id = (v_item->>'id')::uuid
      AND organization_id = v_org_id;
  END LOOP;
END;
$$;
```

## 2. Tipos TypeScript

### `src/types/index.ts`
Adicionar:

```text
CustomFieldType = 'text' | 'number' | 'currency' | 'date' | 'select' | 'multi_select' | 'checkbox' | 'url' | 'email' | 'phone'

CustomFieldDefinition {
  id, organization_id, field_name, field_label, field_type, options, is_required, is_active, position, created_at, updated_at
}

CustomFieldValue {
  id, lead_id, field_definition_id, value, created_at, updated_at
}
```

## 3. Services

### `src/services/customFields.ts`
Seguindo o padrao de `stages.ts`:
- `getCustomFields(orgId)` -- lista ordenada por position
- `createCustomField(data)` -- insert
- `updateCustomField(id, data)` -- update
- `deleteCustomField(id)` -- delete
- `reorderCustomFields(fields)` -- via RPC `reorder_custom_fields`

## 4. Hooks

### `src/hooks/useCustomFields.ts`
Seguindo o padrao de `useStages.ts`:
- `useCustomFields()` -- useQuery com orgId do OrganizationContext
- `useCreateCustomField()` -- useMutation + invalidate
- `useUpdateCustomField()` -- useMutation + invalidate
- `useDeleteCustomField()` -- useMutation + invalidate
- `useReorderCustomFields()` -- useMutation + invalidate

## 5. Componentes

### `src/components/custom-fields/CustomFieldItem.tsx`
Item na lista de campos, seguindo padrao de `StageItem.tsx`:
- Icone do tipo, label, badges (obrigatorio, inativo)
- Drag handle, botao editar, botao deletar
- Clique abre modal de edicao

### `src/components/custom-fields/CustomFieldList.tsx`
Container com DndContext + SortableContext, seguindo padrao de `StageList.tsx`.

### `src/components/custom-fields/CustomFieldDialog.tsx`
Modal de criacao/edicao:
- Campos: label, field_name (auto-gerado slug), tipo (select com icones), obrigatorio (switch), ativo (switch)
- Secao condicional de opcoes para select/multi_select com lista editavel
- Preview ao vivo do campo renderizado

### `src/components/custom-fields/CustomFieldRenderer.tsx`
Componente reutilizavel que recebe `CustomFieldDefinition` + value + onChange e renderiza o input correto:
- text -> Input
- number -> Input type=number
- currency -> Input com prefixo "R$" e formatacao
- date -> DatePicker (Popover + Calendar do shadcn)
- select -> Select com opcoes
- multi_select -> Lista de checkboxes com badges/tags
- checkbox -> Checkbox
- url -> Input com validacao de URL
- email -> Input type=email
- phone -> Input com mascara

### `src/components/custom-fields/FieldTypeIcon.tsx`
Componente que retorna o icone lucide adequado para cada field_type.

## 6. Pagina

### `src/pages/CustomFieldsPage.tsx` (rota `/settings/custom-fields`)
Seguindo o padrao de `FunnelsPage.tsx`:
- Header com titulo e botao "Novo Campo"
- Lista de campos com drag-and-drop
- Estados de loading e vazio
- Permissoes: owner/admin podem CRUD, member/viewer somente leitura

## 7. Sidebar

### `src/components/layout/AppSidebar.tsx`
Adicionar ao array `settingsNav`:
```text
{ title: 'Campos Personalizados', url: '/settings/custom-fields', icon: ListChecks }
```

## 8. Rotas

### `src/App.tsx`
Adicionar rota:
```text
/settings/custom-fields -> PrivateRoute + MainLayout + CustomFieldsPage
```

## Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/xxx.sql` | Criar |
| `src/types/index.ts` | Editar |
| `src/services/customFields.ts` | Criar |
| `src/hooks/useCustomFields.ts` | Criar |
| `src/components/custom-fields/CustomFieldItem.tsx` | Criar |
| `src/components/custom-fields/CustomFieldList.tsx` | Criar |
| `src/components/custom-fields/CustomFieldDialog.tsx` | Criar |
| `src/components/custom-fields/CustomFieldRenderer.tsx` | Criar |
| `src/components/custom-fields/FieldTypeIcon.tsx` | Criar |
| `src/pages/CustomFieldsPage.tsx` | Criar |
| `src/components/layout/AppSidebar.tsx` | Editar |
| `src/App.tsx` | Editar |
