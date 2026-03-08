
-- Table: stage_task_templates
CREATE TABLE public.stage_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'follow_up',
  priority text NOT NULL DEFAULT 'medium',
  due_hours integer NOT NULL DEFAULT 24,
  assign_to_lead_owner boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stage_task_templates ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY "Members can view stage task templates"
  ON public.stage_task_templates FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin can insert stage task templates"
  ON public.stage_task_templates FOR INSERT
  WITH CHECK (get_user_org_role(organization_id) = ANY(ARRAY['owner','admin']));

CREATE POLICY "Owner/admin can update stage task templates"
  ON public.stage_task_templates FOR UPDATE
  USING (get_user_org_role(organization_id) = ANY(ARRAY['owner','admin']));

CREATE POLICY "Owner/admin can delete stage task templates"
  ON public.stage_task_templates FOR DELETE
  USING (get_user_org_role(organization_id) = ANY(ARRAY['owner','admin']));

-- updated_at trigger
CREATE TRIGGER update_stage_task_templates_updated_at
  BEFORE UPDATE ON public.stage_task_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_stage_task_template_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.task_type NOT IN ('follow_up','call','email','meeting','other') THEN
    RAISE EXCEPTION 'Invalid task_type: %', NEW.task_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_stage_task_template_type_trigger
  BEFORE INSERT OR UPDATE ON public.stage_task_templates
  FOR EACH ROW EXECUTE FUNCTION validate_stage_task_template_type();

CREATE OR REPLACE FUNCTION public.validate_stage_task_template_priority()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.priority NOT IN ('low','medium','high','urgent') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_stage_task_template_priority_trigger
  BEFORE INSERT OR UPDATE ON public.stage_task_templates
  FOR EACH ROW EXECUTE FUNCTION validate_stage_task_template_priority();

-- Trigger function: auto-create tasks when lead stage changes
CREATE OR REPLACE FUNCTION public.execute_stage_task_automations()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_template RECORD;
  v_assigned_to uuid;
BEGIN
  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  FOR v_template IN
    SELECT * FROM stage_task_templates
    WHERE stage_id = NEW.stage_id
      AND organization_id = NEW.organization_id
      AND is_active = true
  LOOP
    IF v_template.assign_to_lead_owner AND NEW.assigned_to IS NOT NULL THEN
      v_assigned_to := NEW.assigned_to;
    ELSE
      v_assigned_to := COALESCE(NEW.assigned_to, auth.uid());
    END IF;

    INSERT INTO tasks (organization_id, lead_id, assigned_to, title, description, task_type, priority, due_date)
    VALUES (
      NEW.organization_id,
      NEW.id,
      v_assigned_to,
      v_template.title,
      v_template.description,
      v_template.task_type,
      v_template.priority,
      now() + (v_template.due_hours * interval '1 hour')
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER execute_stage_task_automations_trigger
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION execute_stage_task_automations();
