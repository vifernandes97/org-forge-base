DO $$
DECLARE
  v_org_id uuid := 'ff7bbd31-e907-4a2e-8d9f-ad1d53a35aaa';
  v_field_id uuid;
BEGIN
  -- 1. Create custom field definition for oniplataforma
  INSERT INTO public.custom_field_definitions (organization_id, field_name, field_label, field_type, position)
  VALUES (v_org_id, 'media_de_festas', 'Média de festas', 'text', 100)
  RETURNING id INTO v_field_id;

  -- 2. Copy existing values from leads.media_de_festas to custom_field_values
  INSERT INTO public.custom_field_values (lead_id, field_definition_id, value)
  SELECT l.id, v_field_id, l.media_de_festas
  FROM public.leads l
  WHERE l.organization_id = v_org_id
    AND l.media_de_festas IS NOT NULL
    AND l.media_de_festas <> '';
END $$;

-- 3. Drop legacy column
ALTER TABLE public.leads DROP COLUMN media_de_festas;