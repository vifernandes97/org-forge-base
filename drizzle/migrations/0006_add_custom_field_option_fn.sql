CREATE OR REPLACE FUNCTION public.add_custom_field_option(p_field_id uuid, p_option text)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field public.custom_field_definitions;
  v_option text;
  v_options text[];
BEGIN
  v_option := btrim(coalesce(p_option, ''));
  IF v_option = '' THEN
    RAISE EXCEPTION 'Opção inválida';
  END IF;

  SELECT * INTO v_field FROM public.custom_field_definitions WHERE id = p_field_id;
  IF v_field.id IS NULL THEN
    RAISE EXCEPTION 'Campo não encontrado';
  END IF;

  IF v_field.organization_id NOT IN (SELECT public.get_user_org_ids()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF v_field.field_type NOT IN ('select', 'multi_select') THEN
    RAISE EXCEPTION 'Campo não aceita opções';
  END IF;

  SELECT coalesce(array_agg(x), ARRAY[]::text[])
    INTO v_options
  FROM jsonb_array_elements_text(coalesce(v_field.options, '[]'::jsonb)) AS t(x);

  IF EXISTS (
    SELECT 1 FROM unnest(v_options) AS o WHERE lower(btrim(o)) = lower(v_option)
  ) THEN
    RETURN v_options;
  END IF;

  v_options := v_options || v_option;

  UPDATE public.custom_field_definitions
     SET options = to_jsonb(v_options), updated_at = now()
   WHERE id = p_field_id;

  RETURN v_options;
END;
$$;

REVOKE ALL ON FUNCTION public.add_custom_field_option(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_custom_field_option(uuid, text) TO authenticated;