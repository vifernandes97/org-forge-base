
CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  activity_type text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for activity_type
CREATE OR REPLACE FUNCTION public.validate_activity_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.activity_type NOT IN ('note','call','email','meeting','stage_change','field_update','task_created','task_completed') THEN
    RAISE EXCEPTION 'Invalid activity_type: %', NEW.activity_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_activity_type_trigger
  BEFORE INSERT OR UPDATE ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.validate_activity_type();

-- Indexes
CREATE INDEX idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX idx_lead_activities_created_at ON public.lead_activities(created_at DESC);

-- RLS
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view activities" ON public.lead_activities
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin/member can insert activities" ON public.lead_activities
  FOR INSERT WITH CHECK (
    get_user_org_role(organization_id) IN ('owner','admin','member')
  );

CREATE POLICY "Owner/admin can delete activities" ON public.lead_activities
  FOR DELETE USING (
    get_user_org_role(organization_id) IN ('owner','admin')
  );
