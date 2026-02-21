
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
  CONSTRAINT stages_funnel_position_unique UNIQUE(funnel_id, position) DEFERRABLE INITIALLY DEFERRED
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

-- Funnels policies
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

-- Stages policies
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

-- SECURITY DEFINER function for batch reorder stages
CREATE OR REPLACE FUNCTION public.reorder_stages(p_stages jsonb)
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

  -- Get org_id from the first stage to check permissions
  SELECT organization_id INTO v_org_id
  FROM public.stages
  WHERE id = (p_stages->0->>'id')::uuid;

  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Stage not found'; END IF;

  v_role := get_user_org_role(v_org_id);
  IF v_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_stages)
  LOOP
    UPDATE public.stages
    SET position = (v_item->>'position')::integer
    WHERE id = (v_item->>'id')::uuid
      AND organization_id = v_org_id;
  END LOOP;
END;
$$;
