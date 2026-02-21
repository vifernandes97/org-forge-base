
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'follow_up',
  due_date timestamptz NOT NULL,
  completed_at timestamptz,
  priority text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_task_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.task_type NOT IN ('follow_up','call','email','meeting','other') THEN
    RAISE EXCEPTION 'Invalid task_type: %', NEW.task_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_task_type_trigger
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_type();

CREATE OR REPLACE FUNCTION public.validate_task_priority()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.priority NOT IN ('low','medium','high','urgent') THEN
    RAISE EXCEPTION 'Invalid task priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_task_priority_trigger
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_priority();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tasks_organization_id ON public.tasks(organization_id);
CREATE INDEX idx_tasks_lead_id ON public.tasks(lead_id);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_completed_at ON public.tasks(completed_at);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tasks" ON public.tasks
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin/member can insert tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    get_user_org_role(organization_id) IN ('owner','admin','member')
  );

CREATE POLICY "Owner/admin/member can update tasks" ON public.tasks
  FOR UPDATE USING (
    get_user_org_role(organization_id) IN ('owner','admin','member')
  );

CREATE POLICY "Owner/admin can delete tasks" ON public.tasks
  FOR DELETE USING (
    get_user_org_role(organization_id) IN ('owner','admin')
  );
