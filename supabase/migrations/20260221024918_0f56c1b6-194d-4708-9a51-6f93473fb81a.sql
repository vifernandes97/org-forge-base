
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
