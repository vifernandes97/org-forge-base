

# Automações — Configuração manual em /settings

## Objetivo
Permitir que o usuário crie regras de automação do tipo: "quando um lead chegar na etapa X do funil A, mover automaticamente para a etapa Y do funil B". A execução acontece via trigger no banco de dados.

## 1. Migração — Tabela `automations`

```sql
CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  trigger_funnel_id uuid NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  trigger_stage_id uuid NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  action_funnel_id uuid NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  action_stage_id uuid REFERENCES stages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

-- RLS (same pattern as other org tables)
CREATE POLICY "Members can view automations" ON public.automations
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin can insert automations" ON public.automations
  FOR INSERT WITH CHECK (get_user_org_role(organization_id) IN ('owner','admin'));

CREATE POLICY "Owner/admin can update automations" ON public.automations
  FOR UPDATE USING (get_user_org_role(organization_id) IN ('owner','admin'));

CREATE POLICY "Owner/admin can delete automations" ON public.automations
  FOR DELETE USING (get_user_org_role(organization_id) IN ('owner','admin'));

-- updated_at trigger
CREATE TRIGGER set_automations_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 2. Migração — Trigger `BEFORE UPDATE` na tabela `leads`

```sql
CREATE OR REPLACE FUNCTION public.execute_automations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_automation RECORD;
  v_target_stage_id uuid;
BEGIN
  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  FOR v_automation IN
    SELECT * FROM automations
    WHERE trigger_stage_id = NEW.stage_id
      AND organization_id = NEW.organization_id
      AND is_active = true
  LOOP
    v_target_stage_id := v_automation.action_stage_id;
    IF v_target_stage_id IS NULL THEN
      SELECT id INTO v_target_stage_id FROM stages
      WHERE funnel_id = v_automation.action_funnel_id
      ORDER BY position ASC LIMIT 1;
    END IF;

    IF v_target_stage_id IS NOT NULL THEN
      NEW.funnel_id := v_automation.action_funnel_id;
      NEW.stage_id := v_target_stage_id;
      NEW.stage_entered_at := now();
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_execute_automations
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION execute_automations();
```

## 3. Frontend — Novos arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/types/index.ts` | Adicionar interface `Automation` |
| `src/services/automations.ts` | CRUD via Supabase client (list, create, update, delete) |
| `src/hooks/useAutomations.ts` | Hooks react-query seguindo padrão existente |
| `src/pages/AutomationsPage.tsx` | Lista de automações com botão criar, toggle ativo/inativo, delete |
| `src/components/automations/AutomationFormDialog.tsx` | Dialog com selects cascata: Funil origem → Etapa trigger, Funil destino → Etapa destino (opcional) |
| `src/pages/SettingsPage.tsx` | Adicionar aba "Automações" com ícone `Zap` |

## 4. UI do formulário

- **Nome**: campo texto
- **Quando**: Select funil origem → Select etapa do funil (carrega stages do funil selecionado)
- **Então**: Select funil destino → Select etapa destino (opcional, padrão = primeira etapa)
- **Ativo**: Switch

A lista mostra cada automação como card com descrição visual: "Lead chega em **[Etapa]** do **[Funil A]** → entra em **[Etapa]** do **[Funil B]**" e toggle on/off.

## 5. Aba em Settings

Adicionar ao array de tabs em `SettingsPage.tsx`:
```ts
{ value: 'automations', label: 'Automações', icon: Zap }
```
E o respectivo `TabsContent` renderizando `AutomationsPage`.

