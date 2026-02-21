
-- Leads table
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  funnel_id uuid NOT NULL REFERENCES public.funnels(id),
  stage_id uuid NOT NULL REFERENCES public.stages(id),
  name text NOT NULL,
  email text,
  phone text,
  company text,
  assigned_to uuid REFERENCES public.profiles(id),
  value numeric(12,2) NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  source text,
  priority text NOT NULL DEFAULT 'medium',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  stage_entered_at timestamptz NOT NULL DEFAULT now()
);

-- Priority validation trigger
CREATE OR REPLACE FUNCTION public.validate_lead_priority()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.priority NOT IN ('low','medium','high','urgent') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_lead_priority_trigger
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.validate_lead_priority();

-- Updated_at trigger
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lead timestamps trigger (last_activity_at + stage_entered_at)
CREATE OR REPLACE FUNCTION public.update_lead_timestamps()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.last_activity_at = now();
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    NEW.stage_entered_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_lead_timestamps_trigger
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_lead_timestamps();

-- Indexes
CREATE INDEX idx_leads_organization_id ON public.leads(organization_id);
CREATE INDEX idx_leads_funnel_id ON public.leads(funnel_id);
CREATE INDEX idx_leads_stage_id ON public.leads(stage_id);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_created_at ON public.leads(created_at);
CREATE INDEX idx_leads_last_activity_at ON public.leads(last_activity_at);
CREATE INDEX idx_leads_priority ON public.leads(priority);

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view leads" ON public.leads
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin/member can insert leads" ON public.leads
  FOR INSERT WITH CHECK (
    get_user_org_role(organization_id) IN ('owner','admin','member')
  );

CREATE POLICY "Owner/admin/member can update leads" ON public.leads
  FOR UPDATE USING (
    get_user_org_role(organization_id) IN ('owner','admin','member')
  );

CREATE POLICY "Owner/admin can delete leads" ON public.leads
  FOR DELETE USING (
    get_user_org_role(organization_id) IN ('owner','admin')
  );

-- Add FK to custom_field_values
ALTER TABLE public.custom_field_values
  ADD CONSTRAINT fk_lead
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

-- Allow org members to view profiles of other members (needed for assigned_to select)
CREATE POLICY "Org members can view member profiles" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT om.user_id FROM public.organization_members om
      WHERE om.organization_id IN (SELECT get_user_org_ids())
    )
  );

-- Also allow members to insert/update custom field values (not just owner/admin)
DROP POLICY IF EXISTS "Owner/admin can insert field values" ON public.custom_field_values;
CREATE POLICY "Owner/admin/member can insert field values" ON public.custom_field_values
  FOR INSERT WITH CHECK (
    field_definition_id IN (
      SELECT id FROM public.custom_field_definitions
      WHERE get_user_org_role(organization_id) IN ('owner','admin','member')
    )
  );

DROP POLICY IF EXISTS "Owner/admin can update field values" ON public.custom_field_values;
CREATE POLICY "Owner/admin/member can update field values" ON public.custom_field_values
  FOR UPDATE USING (
    field_definition_id IN (
      SELECT id FROM public.custom_field_definitions
      WHERE get_user_org_role(organization_id) IN ('owner','admin','member')
    )
  );
