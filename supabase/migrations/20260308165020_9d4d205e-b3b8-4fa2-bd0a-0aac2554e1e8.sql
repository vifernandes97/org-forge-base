
-- Automations table
CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
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

CREATE POLICY "Members can view automations" ON public.automations
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin can insert automations" ON public.automations
  FOR INSERT WITH CHECK (get_user_org_role(organization_id) IN ('owner','admin'));

CREATE POLICY "Owner/admin can update automations" ON public.automations
  FOR UPDATE USING (get_user_org_role(organization_id) IN ('owner','admin'));

CREATE POLICY "Owner/admin can delete automations" ON public.automations
  FOR DELETE USING (get_user_org_role(organization_id) IN ('owner','admin'));

CREATE TRIGGER set_automations_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to execute automations on lead stage change
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
